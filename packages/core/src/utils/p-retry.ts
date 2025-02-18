// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface RetryOptions<Args extends any[], Return> {
    retries?: number

    retryTimeout?: number
    maxTimeout?: number
    onRetry?: (
        error: unknown,
        attempt: number,
        retryInfo: {
            args: Args
            previousAttempts: {
                attempt: number
                error: unknown
                result?: Return
            }[]
        }
    ) => void
    shouldRetry?: (
        error: unknown,
        attempt: number,
        retryInfo: {
            args: Args
            previousAttempts: {
                attempt: number
                error: unknown
                result?: Return
            }[]
        }
    ) => boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RetryFunction<Args extends any[], Return> = (
    ...args: Args
) => Promise<Return>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createRetry<Args extends any[], Return>(
    fn: (...args: Args) => Promise<Return>,
    options: RetryOptions<Args, Return> = {}
): RetryFunction<Args, Return> {
    const {
        retries = 3,
        maxTimeout = 1000 * 300,
        onRetry = () => {},
        shouldRetry = () => true,
        retryTimeout = 2000
    } = options

    const retrier = async (
        attempt: number,
        args: Args,
        previousAttempts: {
            attempt: number
            error: unknown
            result?: Return
        }[] = []
    ): Promise<Return> => {
        try {
            return await Promise.race([
                fn(...args),
                // eslint-disable-next-line promise/param-names
                new Promise<never>((_, reject) =>
                    setTimeout(
                        () =>
                            reject(
                                new Error(
                                    `Operation timed out after ${maxTimeout}ms`
                                )
                            ),
                        maxTimeout
                    )
                )
            ])
        } catch (error) {
            const retryInfo = { args, previousAttempts }
            const shouldRetryFlag = shouldRetry(error, attempt, retryInfo)

            if (!shouldRetryFlag || attempt >= retries) {
                throw error
            }

            onRetry(error, attempt, retryInfo)
            return await new Promise<Return>((resolve) => {
                setTimeout(
                    () =>
                        resolve(
                            retrier(attempt + 1, args, [
                                ...previousAttempts,
                                { attempt, error }
                            ])
                        ),
                    retryTimeout
                )
            })
        }
    }

    return (...args: Args) => retrier(0, args)
}
