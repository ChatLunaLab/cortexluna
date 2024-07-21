import { ClientConfig } from '@chatluna/core/platform'

export interface OpenAIClientConfig extends ClientConfig {
    additionCookies?: Record<string, string>
}
