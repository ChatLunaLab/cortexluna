import { Context, Schema } from 'cordis'
import { CortexLunaService } from './services/cortex-luna-service.ts'

export * from './messages/index.ts'
export * from './prompts/index.ts'
export * from './documents/index.ts'
export * from './memorys/index.ts'
export * from './embeddings/index.ts'
export * from './language-models/index.ts'
export * from './tools/index.ts'
export * from './utils/index.ts'
export * from './provider/index.ts'
export * from './generate/index.ts'
export * from './callback/index.ts'
export * from './retrievers/index.ts'
export * from './vector-stores/index.ts'

export function apply(ctx: Context) {
    ctx.plugin(CortexLunaService)
}

export const name = 'cortexluna'

export interface Config {}

export const Config: Schema<Config> = Schema.object({})
