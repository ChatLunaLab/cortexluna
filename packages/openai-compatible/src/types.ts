import { ModelInfo, ModelType } from 'cortexluna'

export const defaultOpenAIModels: ModelInfo[] = [
    {
        name: 'o3-mini',
        type: ModelType.LANGUAGE_MODEL,
        contextToken: 200000
    },
    {
        name: 'o1',
        type: ModelType.LANGUAGE_MODEL,
        contextToken: 200000
    },
    {
        name: 'o1-preview',
        type: ModelType.LANGUAGE_MODEL,
        contextToken: 200000
    },
    {
        name: 'o1-preview',
        type: ModelType.LANGUAGE_MODEL,
        contextToken: 128000
    },
    {
        name: 'o1-mini',
        type: ModelType.LANGUAGE_MODEL,
        contextToken: 128000
    },
    {
        name: 'gpt-4o',
        type: ModelType.LANGUAGE_MODEL,
        contextToken: 128000
    },
    {
        name: 'gpt-4o-mini',
        type: ModelType.LANGUAGE_MODEL,
        contextToken: 128000
    },

    {
        name: 'chatgpt-4o-latest',
        type: ModelType.LANGUAGE_MODEL,
        contextToken: 128000
    },
    {
        name: 'gpt-4-turbo',
        type: ModelType.LANGUAGE_MODEL,
        contextToken: 128000
    },

    {
        name: 'gpt-4',
        type: ModelType.LANGUAGE_MODEL,
        contextToken: 8192
    },
    {
        name: 'gpt-3.5-turbo',
        type: ModelType.LANGUAGE_MODEL,
        contextToken: 16385
    }
]
