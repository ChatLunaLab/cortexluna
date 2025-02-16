import {
    createProviderPool,
    FetchFunction,
    LanguageModel,
    ModelInfo,
    Provider,
    ProviderConfig,
    Strategy
} from 'cortexluna'
import { defaultOpenAIModels } from './types.ts'
import { getLatestModels } from './get-latest-models.ts'

export function createOpenAICompatibleProvider(
    name: 'openai-compatible',
    poolSrategy: Strategy = 'round-robin',
    fetch?: FetchFunction
): Provider {
    if (!fetch) {
        fetch = globalThis.fetch
    }

    const modelsMap: Record<string, LanguageModel> = {}

    let lateastModels: ModelInfo[] = defaultOpenAIModels

    const configPool =
        createProviderPool<OpenAICompatibleProviderConfig>(poolSrategy)

    const getModels: () => [ModelInfo[], Promise<ModelInfo[]>] = () => {
        if (lateastModels !== defaultOpenAIModels) {
            return [lateastModels, Promise.resolve(lateastModels)]
        }

        const latestModels = getLatestModels(configPool, fetch)
            .then((models) => {
                lateastModels = models
                return models
            })
            .catch((err) => {
                console.error(err)
                return defaultOpenAIModels
            })

        return [defaultOpenAIModels, latestModels]
    }

    const createLanguageModel = (modelId: string) => {
        throw new Error('Not implemented')
    }

    const createTextEmbeddingModel = (modelId: string) => {
        throw new Error('Not implemented')
    }

    const provider = function (modelId: string) {
        return createLanguageModel(modelId)
    }

    provider.name = name
    provider.languageModel = createLanguageModel
    provider.textEmbeddingModel = createTextEmbeddingModel
    provider.models = getModels
    provider.configPool = configPool

    return provider
}

export interface OpenAICompatibleProviderConfig extends ProviderConfig {
    headers?: Record<string, string>
    url: (subPath: string) => string
}

export const openaiCompatible =
    createOpenAICompatibleProvider('openai-compatible')

// Add new environment variables
// OPENAI_COMPATIBLE_API_KEY
// OPENAI_COMPATIBLE_API_URL
// OPENAI_API_KEY
// OPENAI_API_URL

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace NodeJS {
        interface ProcessEnv {
            OPENAI_COMPATIBLE_API_KEY?: string
            OPENAI_COMPATIBLE_API_URL?: string
            OPENAI_API_KEY?: string
            OPENAI_API_URL?: string
        }
    }
}
