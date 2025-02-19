import {
    NodeContext,
    NodeDefinition,
    NodeDependency,
    NodeExecutionTiming,
    NodeFactory,
    NodeId,
    NodeIO,
    NodeResult,
    WorkflowNode,
    WorkflowOptions
} from './types.ts'

export * from './types.ts'

export function createNodeFactory(): NodeFactory {
    const nodes = new Map<string, NodeDefinition>()

    return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        registerNode: (type: string, definition: NodeDefinition<any, any>) => {
            nodes.set(type, definition)
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getNode: (type: string) => nodes.get(type) as NodeDefinition<any, any>
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

function getExecutableNodes(
    nodes: WorkflowNode[],
    completed: Set<NodeId>,
    failed: Set<NodeId>
): WorkflowNode[] {
    return nodes.filter((node) => {
        if (completed.has(node.id) || failed.has(node.id)) return false
        return node.dependencies.every((dep) => {
            const depId = resolveDependency(dep)
            return completed.has(depId) && !failed.has(depId)
        })
    })
}

function validateNodeInput(
    node: WorkflowNode,
    definition: NodeDefinition,
    input: NodeIO
): boolean {
    if (!definition.inputSchema) return true
    try {
        definition.inputSchema.parse(input)
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
): Promise<Record<NodeId, NodeResult>> {
    const { maxRetries = 3, maxParallel = 4, callbacks = {} } = options

    if (detectCircularDependencies(nodes)) {
        throw new Error('Circular dependencies detected in workflow')
    }

    const completed = new Set<NodeId>()
    const failed = new Set<NodeId>()
    const results: Record<NodeId, NodeResult> = {}
    const context: NodeContext = { ...initialContext }

    while (completed.size + failed.size < nodes.length) {
        const executableNodes = getExecutableNodes(nodes, completed, failed)
        if (executableNodes.length === 0) break

        const executions = executableNodes
            .slice(0, maxParallel)
            .map(async (node) => {
                const definition = factory.getNode(node.type)
                if (!definition) {
                    failed.add(node.id)
                    return
                }

                const timing: NodeExecutionTiming = {
                    startTime: Date.now()
                }

                callbacks.onNodeStart?.(node.id, node.type)

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

                if (!validateNodeInput(node, definition, input)) {
                    const error = new Error(`Invalid input for node ${node.id}`)
                    timing.endTime = Date.now()
                    timing.duration = timing.endTime - timing.startTime
                    callbacks.onNodeError?.(node.id, node.type, error, timing)
                    failed.add(node.id)
                    return
                }

                let retries = 0
                while (retries <= maxRetries) {
                    try {
                        const output = await definition.run(input, context)
                        timing.endTime = Date.now()
                        timing.duration = timing.endTime - timing.startTime

                        const result: NodeResult = {
                            state: 'completed',
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
                        break
                    } catch (error) {
                        retries++
                        if (retries > maxRetries) {
                            timing.endTime = Date.now()
                            timing.duration = timing.endTime - timing.startTime

                            const result: NodeResult = {
                                state: 'failed',
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

    callbacks.onWorkflowComplete?.(results)
    return results
}
