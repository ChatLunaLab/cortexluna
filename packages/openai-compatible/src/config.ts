import { Schema } from 'cordis'

export interface Config {
    providerName: string
    apiKeys: [string, string][]

    additionalModels: {
        model: string
        modelType:
            | 'LLM 大语言模型'
            | 'LLM 大语言模型（函数调用）'
            | 'Embeddings 嵌入模型'
        contextSize: number
    }[]
    additionCookies: [string, string][]

    temperature: number
    presencePenalty: number
    topP: number
    frequencyPenalty: number
}

export const Config: Schema<Config> = Schema.intersect([
    Schema.object({
        providerName: Schema.string()
            .description('适配器平台名称')
            .default('openai'),

        additionalModels: Schema.array(
            Schema.object({
                model: Schema.string().description('模型名称'),
                modelType: Schema.union([
                    'LLM 大语言模型',
                    'LLM 大语言模型（函数调用）',
                    'Embeddings 嵌入模型'
                ])
                    .default('LLM 大语言模型')
                    .description('模型类型'),
                contextSize: Schema.number()
                    .description('模型上下文大小')
                    .default(4096)
            }).role('table')
        )
            .description('额外模型列表')
            .default([])
    }).description('提供者配置'),

    Schema.object({
        apiKeys: Schema.array(
            Schema.tuple([
                Schema.string().role('secret').required(),
                Schema.string()
                    .description('请求 OpenAI API 的地址')
                    .default('https://api.openai.com/v1/')
            ])
        )
            .description('请求地址的 API Key 和请求地址列表')
            .default([['', 'https://api.openai.com/v1/']]),
        additionCookies: Schema.array(
            Schema.tuple([
                Schema.string().description('Cookie 名称'),
                Schema.string().description('Cookie 值')
            ])
        )
            .description('额外的 Cookie')
            .default([])
    }).description('请求设置'),

    Schema.object({
        temperature: Schema.percent()
            .description('回复温度，越高越随机')
            .min(0)
            .max(1)
            .step(0.1)
            .default(0.8),
        presencePenalty: Schema.number()
            .description(
                '重复惩罚，越高越不易重复出现过至少一次的 Token（-2~2，每步0.1）'
            )
            .min(-2)
            .max(2)
            .step(0.1)
            .default(0.2),
        frequencyPenalty: Schema.number()
            .description(
                '频率惩罚，越高越不易重复出现次数较多的 Token（-2~2，每步0.1）'
            )
            .min(-2)
            .max(2)
            .step(0.1)
            .default(0.2),
        topP: Schema.percent()
            .description('回复概率，越高越随机')
            .min(0)
            .max(1)
            .step(0.1)
            .default(0.8)
    }).description('模型设置')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
]) as any
