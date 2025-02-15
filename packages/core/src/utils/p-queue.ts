type Task<T> = () => Promise<T>

interface ConcurrentQueue {
    add: <T>(task: Task<T>) => Promise<T>
    onIdle: () => Promise<void>
    size: number
    pending: number
}

export function createConcurrencyLimiter(concurrency: number): ConcurrentQueue {
    // 通过闭包管理状态
    let pending = 0
    const queue: {
        task: Task<unknown>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolve: (v: any) => void
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        reject: (e: any) => void
    }[] = []

    // 核心调度器
    const next = () => {
        if (pending >= concurrency || queue.length === 0) return

        const { task, resolve, reject } = queue.shift()!
        pending++

        task()
            .then(resolve)
            .catch(reject)
            .finally(() => {
                pending--
                next() // 递归调度
            })

        next() // 尝试并行执行多个任务
    }

    return {
        get size() {
            return queue.length
        },

        get pending() {
            return pending
        },

        add<T>(task: Task<T>) {
            return new Promise<T>((resolve, reject) => {
                queue.push({ task, resolve, reject })
                next()
            })
        },

        onIdle() {
            return new Promise<void>((resolve) => {
                const check = () => {
                    if (queue.length === 0 && pending === 0) {
                        resolve()
                    } else {
                        setTimeout(check, 0)
                    }
                }
                check()
            })
        }
    }
}
