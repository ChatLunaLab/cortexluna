import { Context, Schema } from 'cordis'
import { ChatLunaPlatformPlugin } from '@chatluna/service'
import { OpenAIClient } from './client.ts'
import { OpenAIClientConfig } from './types.ts'
import * as configType from './config.ts'
class OpenAIPlugin extends ChatLunaPlatformPlugin<
    OpenAIClientConfig,
    OpenAIPlugin.Config
> {
    constructor(ctx: Context, config: OpenAIPlugin.Config) {
        super(ctx, config)
    }

    createClient(ctx: Context) {
        return new OpenAIClient(
            this.config,
            this.config.platform,
            ctx,
            undefined,
            this._request
        )
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
