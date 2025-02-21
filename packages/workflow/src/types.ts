import { z } from 'zod'

export type NodeId = string

export type NodeIO<T = unknown> = Record<string, T>

export type NodeContext = {
    variables: Record<string, unknown>
    metadata: Record<string, unknown>
}

export type NodeState =
    | 'pending'
    | 'running'
    | 'completed'
    | 'failed'
    | 'skipped'

export type NodeResult = {
    state: NodeState
    output: NodeIO
    error?: Error
}

export type WorkflowResult = [NodeResult, Record<NodeId, NodeResult>]

export type NodeDefinition<
    TInput extends NodeIO = NodeIO,
    TOutput extends NodeIO = NodeIO,
    TData = unknown
> = {
    run: (input: TInput, context: NodeContext, data?: TData) => Promise<TOutput>
    inputSchema?:
        | z.ZodType<TInput>
        | ((node: WorkflowNode) => z.ZodType<TInput>)
    outputSchema?:
        | Record<string, z.ZodType<unknown>>
        | ((node: WorkflowNode) => Record<string, z.ZodType<unknown>>)
    dataSchema?: z.ZodType<TData>
}

export type NodeDependency =
    | string
    | {
          nodeId: NodeId
          portId: string
          inputId?: string
      }

export type WorkflowNode = {
    id: NodeId
    type: string
    dependencies: NodeDependency[]
    config?: Record<string, unknown>
    data?: unknown
}

export type NodeExecutionTiming = {
    startTime: number
    endTime?: number
    duration?: number
}

export type WorkflowCallbacks = {
    onNodeStart?: (nodeId: NodeId, nodeType: string) => void
    onNodeComplete?: (
        nodeId: NodeId,
        nodeType: string,
        result: NodeResult,
        timing: NodeExecutionTiming
    ) => void
    onNodeError?: (
        nodeId: NodeId,
        nodeType: string,
        error: Error,
        timing: NodeExecutionTiming
    ) => void
    onNodeSkipped?: (nodeId: NodeId, nodeType: string) => void
    onWorkflowComplete?: (results: Record<NodeId, NodeResult>) => void
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onNodeRunning?: (nodeId: NodeId, nodeType: string, value: any) => void
}

export type WorkflowOptions = {
    maxRetries?: number
    maxParallel?: number
    callbacks?: WorkflowCallbacks
}

export type NodeFactory = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerNode<
        TInput extends NodeIO = NodeIO<unknown>,
        TOutput extends NodeIO = NodeIO<unknown>,
        TData = unknown
    >(
        type: string,
        definition: NodeDefinition<TInput, TOutput, TData>
    ): void
    getNode<
        TInput extends NodeIO = NodeIO<unknown>,
        TOutput extends NodeIO = NodeIO<unknown>,
        TData = unknown
    >(
        type: string
    ): NodeDefinition<TInput, TOutput, TData> | undefined
}
