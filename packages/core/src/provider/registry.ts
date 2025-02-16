import { EmbeddingModel } from '../embeddings/index.ts'
import { LanguageModel } from '../language-models/index.ts'
import { ProviderConfig } from './config.ts'
import { ProviderPool } from 'cortexluna'

export interface Provider<T extends ProviderConfig = ProviderConfig> {
    name: string
    languageModel(modelId: string): LanguageModel

    textEmbeddingModel(modelId: string): EmbeddingModel

    models(): [ModelInfo[], Promise<ModelInfo[]>]

    configPool?: ProviderPool<T>
}

export class DefaultProviderRegistry implements Provider {
    private providers: Record<string, Provider> = {}

    private _providerModels: Record<string, ModelInfo[]> = {}

    name: string = 'default'

    registerProvider({
        id,
        provider
    }: {
        id: string
        provider: Provider
    }): void {
        this.providers[id] = provider
        this.models()
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
                ).flatMap(([k, v]) => v.map((m) => `${k}/${m.name}`))})}`
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

    models(): [ModelInfo[], Promise<ModelInfo[]>] {
        const result: ModelInfo[] = []
        const promises: Promise<ModelInfo[]>[] = []
        for (const providerId in this.providers) {
            if (this._providerModels[providerId]) {
                continue
            }
            let [cacheModels, latestModels] =
                this.providers[providerId].models()
            result.push(...cacheModels)
            this._providerModels[providerId] = cacheModels
            latestModels = latestModels.then((models) => {
                this._providerModels[providerId] = models
                return models
            })
            promises.push(latestModels)
        }
        return [result, Promise.all(promises).then((models) => models.flat())]
    }
}

export enum ModelType {
    LANGUAGE_MODEL = 'languageModel',
    TEXT_EMBEDDING_MODEL = 'textEmbeddingModel'
}

export interface ModelInfo {
    name: string

    type: ModelType

    contextToken?: number

    costPerTokenInput?: number

    costPerTokenOutput?: number
}

/**
 * Fetch function type (standardizes the version of fetch used).
 */
export type FetchFunction = typeof globalThis.fetch
