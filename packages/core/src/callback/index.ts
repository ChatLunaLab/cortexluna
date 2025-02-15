export interface Callback {
    onToolCallStart?: (
        name: string,
        value?: Record<string, unknown>,
        meta?: Record<string, unknown>
    ) => void
    onToolCallEnd?: (
        name: string,
        value?: Record<string, unknown>,
        meta?: Record<string, unknown>
    ) => void
    onTextGenerated?: (output: string, meta?: Record<string, unknown>) => void
    onMeta?: (meta: Record<string, unknown>) => void
    onLLMStart?: (meta?: Record<string, unknown>) => void
    onLLMEnd?: (meta?: Record<string, unknown>) => void
    onError?: (error: Error, meta?: Record<string, unknown>) => void
}

export class CallbackHandler implements Callback {
    private callbacks: Callback[]

    constructor(callbacks: Callback[] = []) {
        this.callbacks = callbacks
    }

    addCallback(callback: Callback) {
        this.callbacks.push(callback)
    }

    removeCallback(callback: Callback) {
        this.callbacks = this.callbacks.filter((cb) => cb !== callback)
    }

    onToolCallStart(
        name: string,
        value?: Record<string, unknown>,
        meta?: Record<string, unknown>
    ) {
        this.callbacks.forEach((callback) => {
            callback.onToolCallStart?.(name, value, meta)
        })
    }

    onToolCallEnd(
        name: string,
        value?: Record<string, unknown>,
        meta?: Record<string, unknown>
    ) {
        this.callbacks.forEach((callback) => {
            callback.onToolCallEnd?.(name, value, meta)
        })
    }

    onTextGenerated(output: string, meta?: Record<string, unknown>) {
        this.callbacks.forEach((callback) => {
            callback.onTextGenerated?.(output, meta)
        })
    }

    onMeta(meta: Record<string, unknown>) {
        this.callbacks.forEach((callback) => {
            callback.onMeta?.(meta)
        })
    }

    onLLMStart(meta?: Record<string, unknown>) {
        this.callbacks.forEach((callback) => {
            callback.onLLMStart?.(meta)
        })
    }

    onLLMEnd(meta?: Record<string, unknown>) {
        this.callbacks.forEach((callback) => {
            callback.onLLMEnd?.(meta)
        })
    }

    onError(error: Error, meta?: Record<string, unknown>) {
        this.callbacks.forEach((callback) => {
            callback.onError?.(error, meta)
        })
    }
}
