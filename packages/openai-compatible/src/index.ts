import { Context } from 'cordis'
import { Config } from './config.ts'
import { createOpenAICompatibleProvider } from './provider.ts'
import type {} from '@cordisjs/plugin-http'

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
            config.apiKeys.map(([apiKey, url]) => ({
                apiKey,
                baseURL: url,
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    Cookies: config.additionCookies
                        .map(([key, value]) => `${key}=${value}`)
                        .join('; ')
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
            }))
        )
    })
}

export const name = '@cortexluna/openai-compatible'

type FetchResponse = globalThis.Response

declare module '@cordisjs/plugin-http' {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    export namespace HTTP {
        export interface ResponseTypes {
            raw: FetchResponse
        }
    }
}
