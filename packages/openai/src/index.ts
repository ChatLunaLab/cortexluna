import { Context, Schema } from 'cordis'
import { ChatLunaPlatformPlugin } from '@chatluna/service'
import { OpenAIClient } from './client.ts'
import { OpenAIClientConfig } from './types.ts'
import { interpolate } from '@chatluna/utils'
import { ChatLunaBaseEmbeddings, ChatLunaChatModel } from '@chatluna/core/model'
import { BasePlatformClient } from '@chatluna/core/platform'
import * as configType from './config.ts'
class OpenAIPlugin extends ChatLunaPlatformPlugin<
    OpenAIClientConfig,
    OpenAIPlugin.Config
> {
    constructor(ctx: Context, config: OpenAIPlugin.Config) {
        super(ctx, config)
    }

    createClient(
        ctx: Context,
        config: OpenAIClientConfig
    ): BasePlatformClient<
        OpenAIClientConfig,
        ChatLunaBaseEmbeddings | ChatLunaChatModel
    > {
        return new OpenAIClient(config, this.config, ctx, this._request)
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

    static reusable = true
    static name = '@chatluna/adapter-openai'
}

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace OpenAIPlugin {
    export type Config = configType.Config
    export const Config: Schema<Config> = configType.Config
}

export default OpenAIPlugin
export * from './requester.ts'
export * from './types.ts'
