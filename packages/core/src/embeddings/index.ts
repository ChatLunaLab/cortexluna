export type EmbeddingModel = {
    readonly provider: string

    readonly model: string

    readonly batchSize: number | undefined

    doEmbed(options: {
        values: string[]
        model?: string
        signal?: AbortSignal
    }): PromiseLike<{
        embeddings: number[][]

        usage?: { tokens: number }
    }>
}
