import {
    BaseMessage,
    createRetry,
    isProviderPool,
    LanguageModel,
    LanguageModelCallOptions,
    LanguageModelCallSettings,
    LanguageModelFinishReason,
    LanguageModelStreamResponseChunk,
    LanguageModelToolCall,
    LanguageModelUsage,
    LanguageResponseMetadata,
    ProviderPool
} from 'cortexluna'
import {
    OpenAICompatibleProvider,
    OpenAICompatibleProviderConfig
} from './provider.ts'
import { convertToOpenAICompatibleChatMessages } from './convert-to-openai-compatible-chat-messages.ts'
import { z } from 'zod'
import { removeAdditionalProperties } from './utils.ts'

export class OpenAICompatibleLanguageModel implements LanguageModel {
    model: string = ''

    provider: string = 'openai-compatible'

    constructor(
        private requestConfig:
            | OpenAICompatibleProviderConfig
            | ProviderPool<OpenAICompatibleProviderConfig>,
        private modelId: string,
        private providerInstance: OpenAICompatibleProvider,
        private settings: LanguageModelCallSettings,
        private fetch: typeof globalThis.fetch = globalThis.fetch
    ) {
        this.model = modelId
        this.provider = providerInstance.name
    }

    getChatRequest(options: LanguageModelCallOptions & { stream?: boolean }) {
        // TODO: top_p check

        return {
            // model id:
            model: options.modelId ?? this.modelId,

            // model specific settings:

            // standardized settings:
            max_tokens: options.maxTokens ?? this.settings.maxTokens,
            temperature: options.temperature ?? this.settings.temperature,
            top_p: options.topP ?? this.settings.topP,
            frequency_penalty:
                options.frequencyPenalty ?? this.settings.frequencyPenalty,
            presence_penalty:
                options.presencePenalty ?? this.settings.presencePenalty,
            response_format:
                options.responseFormat?.type === 'json' &&
                options.responseFormat.schema != null
                    ? {
                          type: 'json_schema',
                          json_schema: {
                              schema: removeAdditionalProperties(
                                  options.responseFormat.schema
                              ),
                              name: options.responseFormat.name ?? 'response',
                              description: options.responseFormat.description
                          }
                      }
                    : undefined,

            stop: options.stopToken,
            seed: options.seed ?? this.settings.seed,
            ...(options.metadata ?? {}),
            tools:
                options.tools == null
                    ? undefined
                    : options.tools?.map((tool) => ({
                          type: 'function',
                          function: {
                              name: tool.function.name,
                              description: tool.function.description,
                              parameters: removeAdditionalProperties(
                                  tool.function.parameters
                              )
                          }
                      })),

            // messages:
            messages: convertToOpenAICompatibleChatMessages(options.prompt)
        }
    }

    async doGenerate(options: LanguageModelCallOptions): Promise<{
        response: BaseMessage
        text?: string
        reasoning?: string | undefined
        finishReason: LanguageModelFinishReason
        usage?: LanguageModelUsage
        responseMetadata: LanguageResponseMetadata[]
        toolCalls?: LanguageModelToolCall[]
    }> {
        const args = this.getChatRequest(options)

        const body = JSON.stringify(args)

        let providerConfig = this.providerConfig
        const generateResponse = async () => {
            const response = await this.fetch(
                providerConfig.url('chat/completions'),
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
                OpenAICompatibleChatResponseSchema.safeParse(responseJSON)

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

        const usage: LanguageModelUsage = {
            promptTokens: parsedResponse.usage?.prompt_tokens ?? 0,
            completionTokens: parsedResponse.usage?.completion_tokens ?? 0,
            totalTokens:
                (parsedResponse.usage?.prompt_tokens ?? 0) +
                (parsedResponse.usage?.completion_tokens ?? 0),
            cachedTokens:
                parsedResponse.usage?.prompt_tokens_details?.cached_tokens ?? 0
        }

        return {
            response: {
                role: 'assistant',
                content: parsedResponse.choices[0].message.content
            },
            text: parsedResponse.choices[0].message.content,
            reasoning: parsedResponse.choices[0].message.reasoning_content as
                | string
                | undefined,
            finishReason: mapOpenAICompatibleFinishReason(
                parsedResponse.choices[0].finish_reason
            ),
            usage,
            responseMetadata: [],
            toolCalls: parsedResponse.choices[0].message.tool_calls?.map(
                (toolCall) => ({
                    toolId: toolCall.id ?? '',
                    toolName: toolCall.function.name,
                    arguments: toolCall.function.arguments
                })
            )
        }
    }

    doStream(
        options: LanguageModelCallOptions
    ): PromiseLike<ReadableStream<LanguageModelStreamResponseChunk>> {
        const args = this.getChatRequest({
            ...options,
            stream: true
        })

        throw new Error('Not implemented')
    }

    private get providerConfig(): OpenAICompatibleProviderConfig {
        if (isProviderPool(this.requestConfig)) {
            return this.requestConfig.getProvider().config
        }
        return this.requestConfig
    }
}

const OpenAICompatibleChatResponseSchema = z.object({
    id: z.string().nullish(),
    created: z.number().nullish(),
    model: z.string().nullish(),
    choices: z.array(
        z.object({
            message: z.object({
                role: z.literal('assistant').nullish(),
                content: z.string(),
                reasoning_content: z.string().nullish(),
                tool_calls: z
                    .array(
                        z.object({
                            id: z.string().nullish(),
                            type: z.literal('function'),
                            function: z.object({
                                name: z.string(),
                                arguments: z.string()
                            })
                        })
                    )
                    .nullish()
            }),
            finish_reason: z.string().nullish()
        })
    ),
    usage: z
        .object({
            prompt_tokens: z.number(),
            completion_tokens: z.number(),

            prompt_tokens_details: z
                .object({
                    cached_tokens: z.number()
                })
                .nullish()
        })
        .nullish()
})

const OpenAICompatibleStreamChunkSchema = z.object({
    id: z.string().nullish(),
    created: z.number().nullish(),
    model: z.string().nullish(),
    choices: z
        .array(
            z.object({
                delta: z.object({
                    role: z.literal('assistant').nullish(),
                    content: z.string().nullish(),
                    tool_calls: z
                        .array(
                            z.object({
                                id: z.string().nullish(),
                                type: z.literal('function'),
                                function: z.object({
                                    name: z.string(),
                                    arguments: z.string()
                                })
                            })
                        )
                        .nullish()
                }),
                finish_reason: z.string().nullish()
            })
        )
        .nullish(),
    usage: z
        .object({
            prompt_tokens: z.number(),
            completion_tokens: z.number(),
            prompt_tokens_details: z
                .object({
                    cached_tokens: z.number()
                })
                .nullish()
        })
        .nullish()
})

export function mapOpenAICompatibleFinishReason(
    finishReason: string | null | undefined
): LanguageModelFinishReason {
    switch (finishReason) {
        case 'stop':
            return 'stop'
        case 'length':
            return 'length'
        case 'content_filter':
            return 'content-filter'
        case 'function_call':
        case 'tool_calls':
            return 'tool-calls'
        default:
            return 'unknown'
    }
}
