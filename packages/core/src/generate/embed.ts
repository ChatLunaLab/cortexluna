/* eslint-disable @typescript-eslint/no-explicit-any */
import { EmbeddingModel, EmbeddingModelUsage } from '../embeddings/index.ts'

export async function doEmbed<T = string>({
    model,
    value,
    signal,
    headers
}: {
    model: EmbeddingModel<T>
    value: T | T[]
    signal?: AbortSignal
    headers?: Record<string, string>
}): Promise<EmbedResult<T>> {
    const response = await model.doEmbed({
        values: Array.isArray(value) ? value : [value],
        signal,
        headers
    })

    return {
        embedding: Array.isArray(value)
            ? (response.embeddings as number[][] as any)
            : (response.embeddings[0] as number[] as any),
        value,
        usage: response.usage ?? {
            tokens: NaN
        }
    }
}

export interface EmbedResult<T> {
    readonly value: T | T[]

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    readonly embedding: this['value'] extends (infer U)[]
        ? number[][]
        : number[]

    readonly usage: EmbeddingModelUsage
}
