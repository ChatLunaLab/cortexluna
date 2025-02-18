export type AsyncIterableStream<T> = AsyncIterable<T> &
    (ReadableStream<T> | TransformStream<unknown, T>)

export function createAsyncIterableStream<T>(
    source: ReadableStream<T> | TransformStream<unknown, T>
): AsyncIterableStream<T> {
    const readableStream =
        source instanceof TransformStream ? source.readable : source
    const stream = readableStream.pipeThrough(new TransformStream<T, T>())

    const asyncIterableStream = stream as AsyncIterableStream<T>
    asyncIterableStream[Symbol.asyncIterator] = () => {
        const reader = stream.getReader()
        return {
            async next(): Promise<IteratorResult<T>> {
                try {
                    const { done, value } = await reader.read()
                    return done
                        ? { done: true, value: undefined }
                        : { done: false, value }
                } catch (error) {
                    reader.releaseLock()
                    throw error
                }
            },
            async return(): Promise<IteratorResult<T>> {
                reader.releaseLock()
                return { done: true, value: undefined }
            }
        }
    }

    return asyncIterableStream
}
