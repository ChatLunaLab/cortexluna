export type EmbeddingModel = {
    readonly provider: string

    readonly model: string

    readonly batchSize: number | undefined

    doEmbed(options: {
        values: string[]
        modelId?: string
        signal?: AbortSignal
    }): PromiseLike<{
        embeddings: number[][]

        usage?: { tokens: number }
    }>
}
