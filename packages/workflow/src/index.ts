import {
    NodeContext,
    NodeDefinition,
    NodeDependency,
    NodeExecutionTiming,
    NodeFactory,
    NodeId,
    NodeIO,
    NodeResult,
    WorkflowCallbacks,
    WorkflowNode,
    WorkflowOptions,
    WorkflowResult
} from './types.ts'

export * from './types.ts'

export function createNodeFactory(): NodeFactory {
    const nodes = new Map<string, NodeDefinition>()

    return {
        registerNode: (
            type: string,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            definition: NodeDefinition<any, any, any>
        ) => {
            nodes.set(type, definition)
        },

        getNode: (type: string) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            nodes.get(type) as NodeDefinition<any, any, any>
    }
}

function resolveDependency(dep: NodeDependency): string {
    return typeof dep === 'string' ? dep : dep.nodeId
}

function detectCircularDependencies(nodes: WorkflowNode[]): boolean {
    const visited = new Set<NodeId>()
    const recursionStack = new Set<NodeId>()

    function hasCycle(nodeId: NodeId): boolean {
        if (recursionStack.has(nodeId)) return true
        if (visited.has(nodeId)) return false

        visited.add(nodeId)
        recursionStack.add(nodeId)

        const node = nodes.find((n) => n.id === nodeId)
        if (node) {
            for (const dep of node.dependencies) {
                const depId = resolveDependency(dep)
                if (hasCycle(depId)) return true
            }
        }

        recursionStack.delete(nodeId)
        return false
    }

    return nodes.some((node) => hasCycle(node.id))
}

function validateNodeInput(
    node: WorkflowNode,
    definition: NodeDefinition,
    input: NodeIO,
    context: NodeContext
): boolean {
    if (!definition.inputSchema) return true
    try {
        const schema =
            typeof definition.inputSchema === 'function'
                ? definition.inputSchema(node)
                : definition.inputSchema
        schema.parse(input)
        return true
    } catch {
        return false
    }
}

function validateNodeOutput(
    definition: NodeDefinition,
    output: NodeIO,
    context: NodeContext,
    node: WorkflowNode
): boolean {
    if (!definition.outputSchema) return true
    try {
        const schema =
            typeof definition.outputSchema === 'function'
                ? definition.outputSchema(node)
                : definition.outputSchema
        for (const [key, schemaType] of Object.entries(schema)) {
            if (key in output) {
                schemaType.parse(output[key])
            }
        }
        return true
    } catch {
        return false
    }
}

function checkAndMarkSkippedNodes(
    nodes: WorkflowNode[],
    completed: Set<NodeId>,
    failed: Set<NodeId>,
    skipped: Set<NodeId>,
    results: Record<NodeId, NodeResult>,
    callbacks?: WorkflowCallbacks
): void {
    nodes.forEach((node) => {
        if (
            completed.has(node.id) ||
            failed.has(node.id) ||
            skipped.has(node.id)
        ) {
            return
        }

        const cannotBeExecuted = node.dependencies.some((dep) => {
            const depId = resolveDependency(dep)
            if (failed.has(depId)) return true

            if (completed.has(depId) && typeof dep === 'object' && dep.portId) {
                const depOutput = results[depId]?.output || {}
                return depOutput[dep.portId] === undefined
            }

            return false
        })

        if (cannotBeExecuted) {
            skipped.add(node.id)
            results[node.id] = {
                state: 'skipped' as const,
                output: {}
            }
            callbacks?.onNodeSkipped?.(node.id, node.type)
        }
    })
}

function getExecutableNodes(
    nodes: WorkflowNode[],
    completed: Set<NodeId>,
    failed: Set<NodeId>,
    skipped: Set<NodeId>,
    results: Record<NodeId, NodeResult>
): WorkflowNode[] {
    return nodes.filter((node) => {
        if (
            completed.has(node.id) ||
            failed.has(node.id) ||
            skipped.has(node.id)
        )
            return false

        return node.dependencies.every((dep) => {
            const depId = resolveDependency(dep)
            const depResult = completed.has(depId)

            if (typeof dep === 'object' && dep.portId) {
                const depOutput = results[depId]?.output || {}
                return depResult && depOutput[dep.portId] !== undefined
            }

            return depResult && !failed.has(depId)
        })
    })
}

function validateNodeData(
    node: WorkflowNode,
    definition: NodeDefinition,
    context: NodeContext
): boolean {
    if (!definition.dataSchema || !node.data) return true
    try {
        definition.dataSchema.parse(node.data)
        return true
    } catch {
        return false
    }
}

export async function executeWorkflow(
    nodes: WorkflowNode[],
    factory: NodeFactory,
    initialContext: NodeContext = { variables: {}, metadata: {} },
    options: WorkflowOptions = {}
): Promise<WorkflowResult> {
    const { maxRetries = 3, maxParallel = 4, callbacks = {} } = options
    const results: Record<NodeId, NodeResult> = {}

    if (detectCircularDependencies(nodes)) {
        throw new Error('Circular dependencies detected in workflow')
    }

    const completed = new Set<NodeId>()
    const failed = new Set<NodeId>()
    const skipped = new Set<NodeId>()
    const context: NodeContext = { ...initialContext }
    let lastExecutedNode: WorkflowNode | undefined

    while (completed.size + failed.size + skipped.size < nodes.length) {
        const executableNodes = getExecutableNodes(
            nodes,
            completed,
            failed,
            skipped,
            results
        )
        if (executableNodes.length === 0) break

        const executions = executableNodes
            .slice(0, maxParallel)
            .map(async (node) => {
                lastExecutedNode = node
                const definition = factory.getNode(node.type)
                if (!definition) {
                    failed.add(node.id)
                    return
                }

                const timing: NodeExecutionTiming = {
                    startTime: Date.now()
                }

                callbacks.onNodeStart?.(node.id, node.type)

                if (!validateNodeData(node, definition, context)) {
                    const error = new Error(`Invalid data for node ${node.id}`)
                    timing.endTime = Date.now()
                    timing.duration = timing.endTime - timing.startTime
                    callbacks.onNodeError?.(node.id, node.type, error, timing)
                    failed.add(node.id)
                    return
                }

                const input =
                    node.dependencies.length === 0
                        ? { ...context.variables }
                        : node.dependencies.reduce((acc, dep) => {
                              const depId = resolveDependency(dep)
                              const depOutput = results[depId]?.output || {}

                              if (typeof dep === 'object' && dep.portId) {
                                  const inputId = dep.inputId || dep.portId
                                  return {
                                      ...acc,
                                      [inputId]: depOutput[dep.portId]
                                  }
                              }

                              return { ...acc, ...depOutput }
                          }, {} as NodeIO)

                if (!validateNodeInput(node, definition, input, context)) {
                    console.log(node, input)
                    const error = new Error(`Invalid input for node ${node.id}`)
                    timing.endTime = Date.now()
                    timing.duration = timing.endTime - timing.startTime
                    callbacks.onNodeError?.(node.id, node.type, error, timing)
                    failed.add(node.id)
                    results[node.id] = {
                        state: 'failed' as const,
                        output: {},
                        error
                    }
                    return
                }

                let retries = 0
                while (retries <= maxRetries) {
                    try {
                        const output = await definition.run(
                            input,
                            context,
                            node.data
                        )
                        timing.endTime = Date.now()
                        timing.duration = timing.endTime - timing.startTime

                        if (
                            !validateNodeOutput(
                                definition,
                                output,
                                context,
                                node
                            )
                        ) {
                            throw new Error(
                                `Invalid output for node ${node.id}`
                            )
                        }

                        const result: NodeResult = {
                            state: 'completed' as const,
                            output
                        }

                        results[node.id] = result
                        completed.add(node.id)
                        callbacks.onNodeComplete?.(
                            node.id,
                            node.type,
                            result,
                            timing
                        )

                        // Check for nodes that should be skipped after this node completes
                        checkAndMarkSkippedNodes(
                            nodes,
                            completed,
                            failed,
                            skipped,
                            results,
                            callbacks
                        )
                        break
                    } catch (error) {
                        retries++
                        if (retries > maxRetries) {
                            timing.endTime = Date.now()
                            timing.duration = timing.endTime - timing.startTime

                            const result: NodeResult = {
                                state: 'failed' as const,
                                output: {},
                                error: error as Error
                            }
                            results[node.id] = result
                            failed.add(node.id)
                            callbacks.onNodeError?.(
                                node.id,
                                node.type,
                                error as Error,
                                timing
                            )
                        }
                    }
                }
            })

        await Promise.all(executions)
    }

    const lastNodeResult: NodeResult = lastExecutedNode
        ? results[lastExecutedNode.id]
        : {
              state: 'skipped' as const,
              output: {}
          }

    callbacks.onWorkflowComplete?.(results)
    return [lastNodeResult, results]
}
