export type EmbeddingsModel = {
    readonly provider: string

    readonly modelId: string

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
