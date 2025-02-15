import { createHash } from 'crypto'

export interface ProviderConfig {
    readonly baseURL?: string
    readonly apiKey: string
    readonly maxRetries?: number
    readonly maxConcurrentRequests?: number
    readonly timeout?: number
}

type Strategy =
    | 'round-robin'
    | 'random'
    | 'least-concurrent'
    | 'weighted-random'
    | 'fallback'

interface ProviderState {
    id: string
    config: ProviderConfig
    currentConcurrent: number
    enabled: boolean
}

interface ProviderHandle {
    id: string
    config: ProviderConfig
    release: () => void
    disable: () => void
    enable: () => void
}

// 生成配置唯一标识（持久化关键）
export function generateConfigId(config: ProviderConfig): string {
    // 标准化对象：排序键名 + 排除undefined
    const normalized = Object.keys(config)
        .sort()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .reduce((obj: Record<string, any>, key) => {
            if (config[key as keyof ProviderConfig] !== undefined) {
                obj[key] = config[key as keyof ProviderConfig]
            }
            return obj
        }, {})

    const str = JSON.stringify(normalized)
    return createHash('sha1').update(str).digest('hex')
}

export function createProviderPool(strategy: Strategy = 'round-robin') {
    let providers: ProviderState[] = []
    let rrIndex = 0

    const strategyHandlers = {
        'round-robin': (available: ProviderState[]) => {
            const index = rrIndex % available.length
            rrIndex = (rrIndex + 1) % available.length
            return available[index]
        },
        random: (available: ProviderState[]) =>
            available[Math.floor(Math.random() * available.length)],
        'least-concurrent': (available: ProviderState[]) =>
            available.reduce((prev, curr) =>
                curr.currentConcurrent < prev.currentConcurrent ? curr : prev
            ),
        'weighted-random': (available: ProviderState[]) => {
            const totalWeight = available.reduce(
                (sum, p) => sum + (p.config.maxConcurrentRequests || 10),
                0
            )
            const random = Math.random() * totalWeight
            let current = 0

            for (const provider of available) {
                current += provider.config.maxConcurrentRequests || 10
                if (random <= current) return provider
            }
            return available[0]
        },
        fallback: (available: ProviderState[]) =>
            available.find((p) => p.currentConcurrent === 0) || available[0]
    }

    function getAvailableProviders() {
        return providers.filter(
            (p) =>
                p.enabled &&
                p.currentConcurrent <
                    (p.config.maxConcurrentRequests || Infinity)
        )
    }

    return {
        addProvider(config: ProviderConfig) {
            const id = generateConfigId(config)
            if (!providers.some((p) => p.id === id)) {
                providers.push({
                    id,
                    config,
                    currentConcurrent: 0,
                    enabled: true
                })
            }
        },

        disableProvider(id: string) {
            const provider = providers.find((p) => p.id === id)
            if (provider) provider.enabled = false
        },

        enableProvider(id: string) {
            const provider = providers.find((p) => p.id === id)
            if (provider) provider.enabled = true
        },

        removeProvider(id: string) {
            providers = providers.filter((p) => p.id !== id)
        },

        getProvider(methodStrategy: Strategy = strategy): ProviderHandle {
            const available = getAvailableProviders()
            if (available.length === 0)
                throw new Error('No available providers')

            const selected = strategyHandlers[methodStrategy](available)
            selected.currentConcurrent++

            return {
                id: selected.id,
                config: selected.config,
                release: () => {
                    selected.currentConcurrent = Math.max(
                        0,
                        selected.currentConcurrent - 1
                    )
                },
                disable: () => {
                    selected.enabled = false
                },
                enable: () => {
                    selected.enabled = true
                }
            }
        },

        setProviderStatus(id: string, enabled: boolean) {
            const provider = providers.find((p) => p.id === id)
            if (provider) provider.enabled = enabled
        },

        getStatus() {
            return providers.map((p) => ({
                id: p.id,
                enabled: p.enabled,
                ...p.config,
                currentConcurrent: p.currentConcurrent
            }))
        },

        setStrategy(newStrategy: Strategy) {
            strategy = newStrategy
        }
    }
}
