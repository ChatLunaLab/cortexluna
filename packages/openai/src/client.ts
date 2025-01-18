import {
    ClientConfigPoolMode,
    ModelCapability,
    ModelInfo,
    ModelType,
    PlatformModelAndEmbeddingsClient
} from '@chatluna/core/platform'
import { OpenAIRequester } from './requester.ts'
import { ChatLunaChatModel, ChatLunaEmbeddings } from '@chatluna/core/model'
import {
    ChatLunaError,
    ChatLunaErrorCode,
    interpolate,
    notNull
} from '@chatluna/utils'
import { Request } from '@chatluna/core/service'
import OpenAIPlugin, { OpenAIClientConfig } from './index.ts'
import { Context } from 'cordis'

export class OpenAIClient extends PlatformModelAndEmbeddingsClient<
    OpenAIClientConfig,
    OpenAIPlugin.Config
> {
    platform = 'openai'

    private _requester: OpenAIRequester

    private _models: Record<string, ModelInfo>

    private _config: OpenAIPlugin.Config

    constructor(
        config: OpenAIPlugin.Config,
        platform: string,
        ctx?: Context,
        configPoolMode?: ClientConfigPoolMode,
        request?: Request
    ) {
        super(
            config,
            platform,
            ctx,
            (configPoolMode ?? config.configMode === 'default')
                ? ClientConfigPoolMode.AlwaysTheSame
                : ClientConfigPoolMode.LoadBalancing
        )

        this._config = Object.assign(
            {},
            {
                platform: 'openai',
                pullModels: true,
                additionalModels: [],
                maxTokens: 4096,
                temperature: 0.8,
                presencePenalty: 0.2,
                frequencyPenalty: 0.2,
                timeout: 1000 * 60 * 5,
                maxRetries: 3,
                additionCookies: [],
                configMode: 'default',
                apiKeys: [],
                proxyAddress: undefined,
                proxyMode: 'system'
            },
            config ?? {}
        )
        this.platform = config.platform
        this._requester = new OpenAIRequester(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            this.configPool,
            request,
            ctx?.logger('@chatluna/adapter-openai')
        )
    }

    parseConfig(config: OpenAIPlugin.Config): OpenAIClientConfig[] {
        return config.apiKeys.map(([apiKey, apiEndpoint]) => {
            return {
                apiKey: interpolate(apiKey),
                apiEndpoint: interpolate(apiEndpoint),
                platform: config.platform,
                timeout: config.timeout,
                maxRetries: config.maxRetries,
                concurrentMaxSize: config.chatConcurrentMaxSize,
                // [string,string][] => Record<string,string>
                additionCookies: config.additionCookies.reduce(
                    (acc, [key, value]) => {
                        acc[key] = value
                        return acc
                    },
                    {} as Record<string, string>
                )
            }
        })
    }

    async init(): Promise<void> {
        await this.getModels()
    }

    async refreshModels(): Promise<ModelInfo[]> {
        try {
            const rawModels = this._config?.pullModels
                ? await this._requester.getModels()
                : []

            const additionalModels = this._config?.additionalModels?.map(
                ({ model, modelType: llmType, contextSize: token }) => {
                    const type =
                        llmType === 'Embeddings 嵌入模型'
                            ? ModelType.embeddings
                            : ModelType.llm
                    return {
                        name: model,
                        type,
                        capabilities: notNull([
                            llmType === 'LLM 大语言模型（函数调用）'
                                ? ModelCapability.FUNCTION_CALL
                                : undefined,
                            ModelCapability.INPUT_TEXT,
                            type === ModelType.llm
                                ? ModelCapability.OUTPUT_TEXT
                                : undefined,
                            type === ModelType.llm
                                ? ModelCapability.INPUT_IMAGE
                                : undefined
                        ]),

                        maxTokens: token ?? 4096
                    } as ModelInfo
                }
            )

            return rawModels
                .filter(
                    (model) =>
                        !(
                            model.includes('whisper') ||
                            model.includes('tts') ||
                            model.includes('dall-e') ||
                            model.includes('image')
                        )
                )
                .map((model) => {
                    const type = model.includes('text-embedding')
                        ? ModelType.embeddings
                        : ModelType.llm
                    return {
                        name: model,
                        type: model.includes('text-embedding')
                            ? ModelType.embeddings
                            : ModelType.llm,
                        capabilities: notNull([
                            type === ModelType.llm
                                ? ModelCapability.FUNCTION_CALL
                                : undefined,
                            ModelCapability.INPUT_TEXT,
                            type === ModelType.llm
                                ? ModelCapability.OUTPUT_TEXT
                                : undefined,
                            type === ModelType.llm
                                ? ModelCapability.INPUT_IMAGE
                                : undefined
                        ])
                    } as ModelInfo
                })
                .concat(additionalModels)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            throw new ChatLunaError(ChatLunaErrorCode.MODEL_INIT_ERROR, e)
        }
    }

    async getModels(): Promise<ModelInfo[]> {
        if (this._models) {
            return Object.values(this._models)
        }

        const models = await this.refreshModels()

        this._models = {}

        for (const model of models) {
            this._models[model.name] = model
        }
    }

    protected _createModel(
        model: string
    ): ChatLunaChatModel | ChatLunaEmbeddings {
        const info = this._models[model]

        if (info == null) {
            throw new ChatLunaError(ChatLunaErrorCode.MODEL_NOT_FOUND)
        }

        if (info.type === ModelType.llm) {
            return new ChatLunaChatModel({
                modelInfo: info,
                requester: this._requester,
                model,
                maxTokens: this._config.maxTokens,
                frequencyPenalty: this._config.frequencyPenalty,
                presencePenalty: this._config.presencePenalty,
                timeout: this._config.timeout,
                temperature: this._config.temperature,
                maxRetries: this._config.maxRetries,
                llmType: this._config.platform
            })
        }

        return new ChatLunaEmbeddings({
            client: this._requester,
            model,
            maxRetries: this._config.maxRetries
        })
    }
}
