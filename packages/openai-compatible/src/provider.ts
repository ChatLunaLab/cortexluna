import {
    ConcurrentQueue,
    createConcurrencyLimiter,
    createProviderPool,
    EmbeddingModel,
    FetchFunction,
    LanguageModel,
    LanguageModelCallSettings,
    ModelInfo,
    Provider,
    ProviderConfig,
    Strategy
} from 'cortexluna'
import { defaultOpenAIModels } from './types.ts'
import { getLatestModels } from './get-latest-models.ts'
import { OpenAICompatibleLanguageModel } from './language-model.ts'
import { OpenAICompatibleEmbeddingModel } from './embedding-model.ts'

export function createOpenAICompatibleProvider(
    name: 'openai-compatible',
    settings?: LanguageModelCallSettings,
    fetch?: FetchFunction,
    poolSrategy: Strategy = 'round-robin',
    configs?: OpenAICompatibleProviderConfig[]
): OpenAICompatibleProvider & {
    (modelId: string): LanguageModel
    model: (modelId: string) => LanguageModel
    embedding: (modelId: string) => EmbeddingModel
} {
    if (!fetch) {
        fetch = globalThis.fetch
    }

    const modelsMap: Record<string, LanguageModel | EmbeddingModel> = {}

    let lateastModels: ModelInfo[] = defaultOpenAIModels

    const configPool = createProviderPool<OpenAICompatibleProviderConfig>(
        poolSrategy,
        name
    )

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
        if (modelsMap[modelId]) {
            const model = modelsMap[modelId]
            if (!(model instanceof OpenAICompatibleLanguageModel)) {
                throw new Error(
                    `Model ${modelId} is not  an instance of OpenAICompatibleLanguageModel`
                )
            }
        }
        modelsMap[modelId] = new OpenAICompatibleLanguageModel(
            configPool,
            modelId,
            provider as OpenAICompatibleProvider,
            settings ?? {},
            fetch
        )
        return modelsMap[modelId] as OpenAICompatibleLanguageModel
    }

    const createTextEmbeddingModel = (modelId: string) => {
        if (modelsMap[modelId]) {
            const model = modelsMap[modelId]
            if (!(model instanceof OpenAICompatibleEmbeddingModel)) {
                throw new Error(
                    `Model ${modelId} is not  an instance of OpenAICompatibleLanguageModel`
                )
            }
        }
        modelsMap[modelId] = new OpenAICompatibleEmbeddingModel(
            configPool,
            modelId,
            provider as OpenAICompatibleProvider,
            {
                batchSize: 200
            },
            fetch
        )
        return modelsMap[modelId] as OpenAICompatibleEmbeddingModel
    }

    const provider = function (modelId: string) {
        return createLanguageModel(modelId)
    }

    provider.name = name
    provider.languageModel = createLanguageModel
    provider.textEmbeddingModel = createTextEmbeddingModel
    provider.models = getModels
    provider.embedding = createTextEmbeddingModel
    provider.model = createLanguageModel
    provider.configPool = configPool
    provider.concurrencyLimiter = createConcurrencyLimiter(10)

    if (process.env.OPENAI_COMPATIBLE_API_KEY) {
        const url = process.env.OPENAI_COMPATIBLE_API_URL!
        configPool.addProvider({
            apiKey: process.env.OPENAI_COMPATIBLE_API_KEY,
            baseURL: url,
            headers: {
                Authorization: `Bearer ${process.env.OPENAI_COMPATIBLE_API_KEY}`
            },
            url: (subPath: string) => {
                // check has v1
                if (url.endsWith('/v1')) {
                    return url + '/' + subPath
                } else if (url.endsWith('/v1/')) {
                    return url + subPath
                }

                // check has /
                if (url.endsWith('/')) {
                    return url + subPath
                }

                // add /v1
                return url + '/v1/' + subPath
            },
            timeout: 300000
        })
    }

    if (configs) {
        configs.forEach((config) => {
            configPool.addProvider(config)
        })
    }

    return provider
}

export interface OpenAICompatibleProviderConfig extends ProviderConfig {
    headers?: Record<string, string>
    url: (subPath: string) => string
}

export interface OpenAICompatibleProvider
    extends Provider<OpenAICompatibleProviderConfig> {
    concurrencyLimiter: ConcurrentQueue
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
