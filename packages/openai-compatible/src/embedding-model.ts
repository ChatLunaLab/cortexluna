import {
    createRetry,
    EmbeddingModel,
    EmbeddingModelCallOptions,
    EmbeddingModelCallSettings,
    EmbeddingModelResult,
    EmbeddingModelUsage,
    isProviderPool,
    ProviderPool
} from 'cortexluna'
import {
    OpenAICompatibleProvider,
    OpenAICompatibleProviderConfig
} from './provider.ts'
import { z } from 'zod'

export class OpenAICompatibleEmbeddingModel implements EmbeddingModel<string> {
    model: string = ''

    provider: string = 'openai-compatible'

    batchSize: number | undefined

    constructor(
        private requestConfig:
            | OpenAICompatibleProviderConfig
            | ProviderPool<OpenAICompatibleProviderConfig>,
        private modelId: string,
        private providerInstance: OpenAICompatibleProvider,
        private settings: EmbeddingModelCallSettings,
        private fetch: typeof globalThis.fetch = globalThis.fetch
    ) {
        this.model = modelId
        this.provider = providerInstance.providerName
    }

    getChatRequest<T>(options: EmbeddingModelCallOptions<T>) {
        // TODO: top_p check

        return {
            // model id:
            model: options.modelId ?? this.modelId,
            input: options.values
        }
    }

    async doEmbed<T = string>(
        options: EmbeddingModelCallOptions<T>
    ): Promise<EmbeddingModelResult<T>> {
        const args = this.getChatRequest<T>(options)

        const body = JSON.stringify(args)

        let providerConfig = this.providerConfig
        const generateResponse = async () => {
            const response = await this.fetch(
                providerConfig.url('embeddings'),
                {
                    method: 'POST',
                    headers: Object.assign(
                        {
                            'Content-Type': 'application/json'
                        },
                        providerConfig.headers,
                        options.headers
                    ),
                    body,
                    signal: options.signal
                }
            )

            const responseBody = await response.text()

            const responseJSON = JSON.parse(responseBody)

            const parsedResponse =
                OpenAICompatibleEmbeddingResponseSchema.safeParse(responseJSON)

            if (!parsedResponse.success) {
                throw new Error(`Invalid response from API: ${responseBody}`)
            }

            return parsedResponse.data
        }

        const parsedResponse =
            await this.providerInstance.concurrencyLimiter.add(
                createRetry(
                    async () => {
                        providerConfig = this.providerConfig
                        return await generateResponse()
                    },
                    {
                        maxTimeout: this.providerConfig.timeout,
                        retries: this.providerConfig.maxRetries,
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        onRetry: (e: any) => {
                            console.warn(
                                `Retrying due to error: ${e.message}. ${
                                    e.cause != null ? `Cause: ${e.cause}` : ''
                                }`
                            )
                        }
                    }
                )
            )

        const usage: EmbeddingModelUsage = {
            tokens: parsedResponse.usage.total_tokens
        }
        const embeddings: number[][] = []
        for (const embedding of parsedResponse.data) {
            embeddings.push(embedding.embedding)
        }
        return {
            usage,
            embeddings: (Array.isArray(options.values)
                ? embeddings
                : embeddings[0]) as EmbeddingModelResult<T>['embeddings']
        }
    }

    private get providerConfig(): OpenAICompatibleProviderConfig {
        if (isProviderPool(this.requestConfig)) {
            return this.requestConfig.getProvider().config
        }
        return this.requestConfig
    }
}

const OpenAICompatibleEmbeddingResponseSchema = z.object({
    object: z.literal('list'),
    data: z.array(
        z.object({
            object: z.literal('embedding'),
            embedding: z.array(z.number()),
            index: z.number()
        })
    ),
    model: z.string(),
    usage: z.object({
        prompt_tokens: z.number(),
        total_tokens: z.number()
    })
})
