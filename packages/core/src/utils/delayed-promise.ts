export class DelayedPromise<T> {
    private _promise: Promise<T>
    private _resolve: (value: T | PromiseLike<T>) => void = () => {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private _reject: (reason?: any) => void = () => {}
    constructor() {
        this._promise = new Promise<T>((resolve, reject) => {
            this._resolve = resolve
            this._reject = reject
        })
    }

    get promise() {
        return this._promise
    }

    resolve(value: T | PromiseLike<T>) {
        this._resolve(value)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reject(reason?: any) {
        this._reject(reason)
    }
}
