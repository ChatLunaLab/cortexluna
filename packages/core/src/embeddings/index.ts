export type EmbeddingModel<T = string> = {
    readonly provider: string

    readonly model: string

    readonly batchSize: number | undefined

    doEmbed<R extends T | T[] = T>(
        options: EmbeddingModelCallOptions<R>
    ): PromiseLike<EmbeddingModelResult<R>>
}

export type EmbeddingModelUsage = {
    tokens: number
}

export type EmbeddingModelCallSettings = {
    batchSize: number
}

export type EmbeddingModelResult<R> = {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    embeddings: R extends (infer U)[] ? number[][] : number[]
    usage?: EmbeddingModelUsage
}

export type EmbeddingModelCallOptions<T> = {
    values: T
    modelId?: string
    signal?: AbortSignal
    headers?: Record<string, string>
} & Partial<EmbeddingModelCallSettings>

export function addEmbeddingModelUsage(
    left?: EmbeddingModelUsage,
    right?: EmbeddingModelUsage
) {
    if (left == null) {
        return right
    }
    if (right == null) {
        return left
    }
    return {
        tokens: left.tokens + right.tokens
    }
}
