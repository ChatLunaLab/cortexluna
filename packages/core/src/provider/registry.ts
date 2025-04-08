import { EmbeddingModel } from '../embeddings/index.ts'
import { LanguageModel } from '../language-models/index.ts'
import { ProviderConfig } from './config.ts'
import { ProviderPool } from 'cortexluna'

export interface Provider<T extends ProviderConfig = ProviderConfig> {
    providerName: string
    languageModel(modelId: string): LanguageModel

    textEmbeddingModel(modelId: string): EmbeddingModel

    models(): [ModelInfo[], Promise<ModelInfo[]>]

    configPool?: ProviderPool<T>
}

export class DefaultProviderRegistry implements Provider {
    private providers: Record<string, Provider> = {}

    private _providerModels: Record<string, PlatformModelInfo[]> = {}

    providerName: string = 'default'

    registerProvider({
        id,
        provider
    }: {
        id: string
        provider: Provider
    }): () => void {
        this.providers[id] = provider
        ;(async () => {
            await this.models()[1]
        })()

        return () => {
            delete this.providers[id]
            delete this._providerModels[id]
        }
    }

    private getProvider(id: string): Provider {
        const provider = this.providers[id]

        if (provider == null) {
            throw new Error(
                `No such provider: ${id}. Available providers: ${Object.keys(
                    this.providers
                )}`
            )
        }

        return provider
    }

    private splitId(
        id: string,
        modelType: 'languageModel' | 'textEmbeddingModel' | 'imageModel'
    ): [string, string] {
        const index = id.indexOf(':')

        if (index === -1) {
            throw new Error(
                `Invalid ${modelType} id for registry: ${id} ` +
                    `(must be in the format "providerId:modelId")`
            )
        }

        return [id.slice(0, index), id.slice(index + 1)]
    }

    languageModel(id: string): LanguageModel {
        const [providerId, modelId] = this.splitId(id, 'languageModel')
        const model = this.getProvider(providerId).languageModel?.(modelId)

        if (model == null) {
            throw new Error(
                `No such language model: ${modelId}. Available models: ${Object.entries(
                    this._providerModels
                ).flatMap(([k, v]) => v.map((m) => `${k}:${m.name}`))})}`
            )
        }
        return model
    }

    textEmbeddingModel(id: string): EmbeddingModel {
        const [providerId, modelId] = this.splitId(id, 'textEmbeddingModel')
        const provider = this.getProvider(providerId)

        const model = provider.textEmbeddingModel?.(modelId)

        if (model == null) {
            throw new Error(
                `No such text embedding model: ${modelId}. Available models: ${Object.keys(
                    this._providerModels
                )}`
            )
        }

        return model
    }

    models(): [PlatformModelInfo[], Promise<PlatformModelInfo[]>] {
        const result: PlatformModelInfo[] = []
        const promises: Promise<PlatformModelInfo[]>[] = []
        for (const providerId in this.providers) {
            if (this._providerModels[providerId]) {
                const cachedModels = this._providerModels[providerId]
                result.push(...cachedModels)
                promises.push(Promise.resolve(cachedModels))
                continue
            }

            const [hardcodeModels, latestModels] =
                this.providers[providerId].models()

            const cachePlatformModels: PlatformModelInfo[] = hardcodeModels.map(
                (model) => ({
                    ...model,
                    provider: providerId
                })
            )

            result.push(...cachePlatformModels)
            this._providerModels[providerId] = cachePlatformModels

            const latestPlatformModels = latestModels.then((models) => {
                const platformModels = models.map((model) => ({
                    ...model,
                    provider: providerId
                }))

                this._providerModels[providerId] = platformModels

                return platformModels
            })
            promises.push(latestPlatformModels)
        }
        return [result, Promise.all(promises).then((models) => models.flat())]
    }
}

export enum ModelType {
    LANGUAGE_MODEL = 'languageModel',
    TEXT_EMBEDDING_MODEL = 'textEmbeddingModel'
}

export enum ModelCapability {
    IMAGE_INPUT = 'imageInput',
    IMAGE_OUTPUT = 'imageOutput',
    AUDIO_INPUT = 'audioInput',
    AUDIO_OUTPUT = 'audioOutput',
    VIDEO_INPUT = 'videoInput',
    VIDEO_OUTPUT = 'videoOutput'
}

export interface ModelInfo {
    name: string

    type: ModelType

    contextToken?: number

    costPerTokenInput?: number

    costPerTokenOutput?: number

    capability?: ModelCapability[]
}

export type PlatformModelInfo = Readonly<
    ModelInfo & {
        provider: string
    }
>

/**
 * Fetch function type (standardizes the version of fetch used).
 */
export type FetchFunction = typeof globalThis.fetch
