import { Context, Service } from 'cordis'
import {
    DefaultProviderRegistry,
    PlatformModelInfo,
    Provider
} from '../provider/registry.ts'

export class CortexLunaService extends Service {
    private _registry = new DefaultProviderRegistry()

    constructor(public ctx: Context) {
        super(ctx, 'cortex_luna', true)
    }

    registerProvider({ id, provider }: { id: string; provider: Provider }) {
        const dispose = this._registry.registerProvider({
            id,
            provider
        })

        return this.ctx.effect(() => dispose)
    }

    languageModel(id: `${string}:${string}`) {
        return this._registry.languageModel(id)
    }

    textEmbeddingModel(id: `${string}:${string}`) {
        return this._registry.textEmbeddingModel(id)
    }

    async models(): Promise<PlatformModelInfo[]> {
        const [cached, lateast] = this._registry.models()

        try {
            return await lateast
        } catch {
            return cached
        }
    }
}

declare module 'cordis' {
    interface Context {
        cortex_luna: CortexLunaService
    }
}
