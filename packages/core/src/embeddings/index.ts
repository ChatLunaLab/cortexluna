export type EmbeddingModel<T = string> = {
    readonly provider: string

    readonly model: string

    readonly batchSize: number | undefined

    doEmbed<R extends T | T[] = T>(options: {
        values: R
        modelId?: string
        signal?: AbortSignal
        headers?: Record<string, string>
    }): PromiseLike<{
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        embeddings: R extends (infer U)[] ? number[][] : number[]
        usage?: EmbeddingModelUsage
    }>
}

export type EmbeddingModelUsage = {
    tokens: number
}
