import { Context } from 'cordis'
import { Config } from './config.ts'
import { createOpenAICompatibleProvider } from './provider.ts'
import type {} from '@cordisjs/plugin-http'
import { buildRequestUrl } from './utils.ts'

export * from './provider.ts'
export * from './types.ts'
export * from './config.ts'

export function apply(ctx: Context, config: Config) {
    // TODO: fetch

    ctx.http.decoder('raw', (respose) => respose)

    ctx.cortex_luna.registerProvider({
        id: config.providerName,
        provider: createOpenAICompatibleProvider(
            config.providerName,
            {
                temperature: config.temperature,
                frequencyPenalty: config.frequencyPenalty,
                presencePenalty: config.presencePenalty,
                topP: config.topP
            },
            async (info, init) => {
                const response = await ctx.http(
                    info as string,
                    Object.assign(init ?? {}, {
                        responseType: 'raw',
                        method: init?.method ?? 'GET',
                        data: init?.body
                    }) as {
                        responseType: 'raw'
                    }
                )

                return response.data
            },
            'weighted-random',
            config.apiKeys.map(([apiKey, baseURL]) => ({
                apiKey,
                baseURL,
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    Cookies: config.additionCookies
                        .map(([key, value]) => `${key}=${value}`)
                        .join('; ')
                },
                url: (subPath: string) => buildRequestUrl(baseURL, subPath),
                timeout: 300000
            }))
        )
    })
}

export const name = '@cortexluna/openai-compatible'
export const inject = ['cortex_luna', 'http']

type FetchResponse = globalThis.Response

declare module '@cordisjs/plugin-http' {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    export namespace HTTP {
        export interface ResponseTypes {
            raw: FetchResponse
        }
    }
}
