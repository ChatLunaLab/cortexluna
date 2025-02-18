export type AsyncIterableStream<T> = AsyncIterable<T> & ReadableStream<T>

export function createAsyncIterableStream<T>(
    source: ReadableStream<T> | TransformStream<unknown, T>
): AsyncIterableStream<T> {
    if (source instanceof TransformStream) {
        source[Symbol.asyncIterator] = () => {
            const reader = source.readable.getReader()
            return {
                async next(): Promise<IteratorResult<T>> {
                    const { done, value } = await reader.read()
                    return done
                        ? { done: true, value: undefined }
                        : { done: false, value }
                }
            }
        }
        return source as unknown as AsyncIterableStream<T>
    }

    const stream = source.pipeThrough(new TransformStream<T, T>())

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    ;(stream as AsyncIterableStream<T>)[Symbol.asyncIterator] = () => {
        const reader = stream.getReader()
        return {
            async next(): Promise<IteratorResult<T>> {
                const { done, value } = await reader.read()
                return done
                    ? { done: true, value: undefined }
                    : { done: false, value }
            }
        }
    }

    return stream as AsyncIterableStream<T>
}
