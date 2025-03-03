import {
    createRetry,
    FetchFunction,
    ModelInfo,
    ModelType,
    ProviderPool
} from 'cortexluna'
import { OpenAICompatibleProviderConfig } from './provider.ts'
import { z } from 'zod'
import { additionalModels, defaultOpenAIModels } from './types.ts'

export async function getLatestModels(
    pool: ProviderPool<OpenAICompatibleProviderConfig>,
    fetchFunction?: FetchFunction
): Promise<ModelInfo[]> {
    fetchFunction = fetchFunction ?? globalThis.fetch

    let currentConfig = pool.getProvider()

    const latestModels = async (
        config: OpenAICompatibleProviderConfig
    ): Promise<ModelInfo[]> => {
        const url = config.url(`/models`)

        const resposeText = await fetchFunction(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${config.apiKey}`,
                ...(config.headers ?? {})
            }
        }).then((res) => res.text())

        try {
            const models = listModelSchema.parse(JSON.parse(resposeText)).data

            return models
                .filter(
                    (model) =>
                        !model.id.includes('audio') ||
                        !model.id.includes('tts') ||
                        !model.id.includes('whisper') ||
                        !model.id.includes('realtime')
                )

                .map((model): ModelInfo => {
                    // TODO: check gemini, deepseek, ...
                    return {
                        name: model.id,
                        type: model.id.includes('embedding')
                            ? ModelType.TEXT_EMBEDDING_MODEL
                            : ModelType.LANGUAGE_MODEL,
                        contextToken:
                            defaultOpenAIModels.find(
                                (m) =>
                                    model.id.startsWith(m.name) ||
                                    model.id.includes(m.name)
                            )?.contextToken ?? 128000
                    }
                })
                .concat(additionalModels)
        } catch (e) {
            throw new Error(`Failed to parse models: ${resposeText}`)
        }
    }

    const retry = createRetry(latestModels, {
        retries: currentConfig.config.maxRetries,
        maxTimeout: currentConfig.config.timeout,
        onRetry(error, attempt, retryInfo) {
            console.error(`Retry attempt ${attempt} failed with error`, error)
            currentConfig.disable()
            currentConfig = pool.getProvider()
        }
    })

    return retry(currentConfig.config)
}

const listModelSchema = z.object({
    object: z.literal('list').optional(),
    data: z.array(
        z.object({
            id: z.string(),
            object: z.string().optional(),
            owned_by: z.string().optional()
        })
    )
})
