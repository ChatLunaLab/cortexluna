import {
    HttpModelRequester,
    EmbeddingsRequester,
    EmbeddingsRequestParams,
    ModelRequestParams
} from '@chatluna/core/model'
import { Request, DefaultRequest } from '@chatluna/core/service'
import { OpenAIClientConfig } from './types.ts'
import {
    ChatLunaError,
    ChatLunaErrorCode,
    sseIterable,
    Option,
    Require
} from '@chatluna/utils'
import { Logger } from 'cordis'
import {
    convertOpenAIDeltaToMessageChunk,
    formatToolsToOpenAITools,
    langchainMessageToOpenAIMessage,
    OpenAICreateEmbeddingResponse,
    OpenAIMessageRole,
    OpenAIResponse
} from '@chatluna/core/utils'
import { ChatGenerationChunk } from '@langchain/core/outputs'

export class OpenAIRequester
    extends HttpModelRequester
    implements EmbeddingsRequester
{
    requestService: Request
    constructor(
        public config: Require<
            Option<OpenAIClientConfig, 'platform'>,
            'apiEndpoint'
        >,
        request?: Request,
        public _logger?: Logger
    ) {
        super()
        this.requestService = request ?? new DefaultRequest()
    }

    async *completionStream(
        params: ModelRequestParams
    ): AsyncGenerator<ChatGenerationChunk> {
        try {
            const iterator = await this._createChatStream(params)

            let defaultRole: OpenAIMessageRole = 'assistant'
            let errorCount = 0
            let messageChunk: ChatGenerationChunk

            for await (const event of iterator) {
                const chunk = event.data

                if (chunk === '[DONE]') {
                    return
                }

                try {
                    const parsedResult = this._parseChunk(chunk, defaultRole)

                    if (parsedResult.length < 1) {
                        continue
                    }

                    ;[messageChunk, defaultRole] = parsedResult

                    yield messageChunk
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } catch (e: any) {
                    if (errorCount > 5) {
                        this._logger?.error('error with chunk', chunk)
                        throw new ChatLunaError(
                            ChatLunaErrorCode.API_REQUEST_FAILED,
                            e
                        )
                    } else {
                        errorCount++
                        continue
                    }
                }
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            if (e instanceof ChatLunaError) {
                throw e
            } else {
                throw new ChatLunaError(ChatLunaErrorCode.API_REQUEST_FAILED, e)
            }
        }
    }

    private _parseChunk(
        chunk: string,
        defaultRole: OpenAIMessageRole
    ): [ChatGenerationChunk, OpenAIMessageRole] | [] {
        const data = JSON.parse(chunk) as OpenAIResponse

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((data as any).error) {
            throw new ChatLunaError(
                ChatLunaErrorCode.API_REQUEST_FAILED,
                new Error(
                    'error when calling openai completion, Result: ' + chunk
                )
            )
        }

        const choice = data.choices?.[0]
        if (!choice) {
            return []
        }

        const { delta } = choice
        const messageChunk = convertOpenAIDeltaToMessageChunk(
            delta,
            defaultRole
        )

        defaultRole = (
            (delta.role?.length ?? 0) > 0 ? delta.role : defaultRole
        ) as OpenAIMessageRole

        return [
            new ChatGenerationChunk({
                message: messageChunk,
                text: messageChunk.content as string
            }),
            defaultRole
        ]
    }

    private async _createChatStream(params: ModelRequestParams) {
        const response = await this._post(
            'chat/completions',
            {
                model: params.model,
                messages: langchainMessageToOpenAIMessage(
                    params.input,
                    params.model
                ),
                tools:
                    params.tools != null
                        ? formatToolsToOpenAITools(params.tools)
                        : undefined,
                stop: params.stop != null ? params.stop : undefined,
                // remove max_tokens
                max_tokens: params.model.includes('vision')
                    ? undefined
                    : params.maxTokens,
                temperature: params.temperature,
                presence_penalty: params.presencePenalty,
                frequency_penalty: params.frequencyPenalty,
                n: params.n,
                top_p: params.topP,
                user: params.user ?? 'user',
                stream: true,
                logit_bias: params.logitBias
            },
            {
                signal: params.signal
            }
        )

        return sseIterable(response)
    }

    async embeddings(
        params: EmbeddingsRequestParams
    ): Promise<number[] | number[][]> {
        let data: OpenAICreateEmbeddingResponse | string

        return this._runCatch(async () => {
            const response = await this._post('embeddings', {
                input: params.input,
                model: params.model
            })

            data = await response.text()

            data = JSON.parse(data as string) as OpenAICreateEmbeddingResponse

            if (data.data && data.data.length > 0) {
                return (data as OpenAICreateEmbeddingResponse).data.map(
                    (it) => it.embedding
                )
            }

            throw new Error(
                'error when request, Result: ' + JSON.stringify(data)
            )
        }, data)
    }

    async getModels(): Promise<string[]> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let data: any
        try {
            const response = await this._get('models')
            data = await response.text()
            data = JSON.parse(data as string)

            if (data.data?.length < 1) {
                // remove the api key and retry
                const response = await this._get('models', {
                    'Content-Type': 'application/json'
                })
                data = await response.text()
                data = JSON.parse(data as string)
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return (<Record<string, any>[]>data.data).map((model) => model.id)
        } catch (e) {
            throw new Error(
                'error when listing openai models, Result: ' +
                    JSON.stringify(data)
            )
        }
    }

    _buildHeaders() {
        const result = {
            Authorization: `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json'
        }

        if (Object.keys(this.config?.additionCookies ?? {}).length > 0) {
            result['Cookie'] = Object.entries(this.config.additionCookies)
                .map(([key, value]) => `${key}=${value}`)
                .join('; ')
        }

        return result
    }

    _concatUrl(url: string): string {
        // TODO: move to http model requester
        const apiEndPoint = this.config.apiEndpoint

        if (apiEndPoint.endsWith('/')) {
            return apiEndPoint + url
        }

        return apiEndPoint + '/' + url
    }
}
