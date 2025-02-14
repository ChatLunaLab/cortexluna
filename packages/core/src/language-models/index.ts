// https://github.com/vercel/ai/blob/main/packages/provider/src/language-model/v1

import type { JSONSchema7 } from 'json-schema'
import { BaseMessage } from '../messages/messages.ts'

export interface LanguageModel {
    readonly provider: string
    readonly model: string

    doGenerate(options: LanguageModelCallOptions): PromiseLike<{
        response: BaseMessage
        text?: string
        reasoning?: string
        finishReason: LanguageModelFinishReason
        usage?: {
            promptTokens: number
            completionTokens: number
            totalTokens: number
            cachedTokens?: number
        }
        toolCalls?: LanguageModelToolCall[]
    }>

    doStream(
        options: LanguageModelCallOptions
    ): PromiseLike<ReadableStream<LanguageModelStreamResponseChunk>>
}

export type LanguageModelStreamResponseChunk =
    // Basic text deltas:
    | { type: 'text-delta'; textDelta: string }

    // Reasoning text deltas:
    | { type: 'reasoning'; textDelta: string }

    // Sources:
    | { type: 'source'; source: LanguageModelSource }

    // Complete tool calls:
    | ({ type: 'tool-call' } & LanguageModelToolCall)

    // Tool call deltas are only needed for object generation modes.
    // The tool call deltas must be partial JSON strings.
    | {
          type: 'tool-call-delta'
          toolCallType: 'function'
          toolCallId: string
          toolName: string
          argsTextDelta: string
      }

    // metadata for the response.
    // separate stream part so it can be sent once it is available.
    | {
          type: 'response-metadata'
          id?: string
          timestamp?: Date
          modelId?: string
      }

    // the usage stats, finish reason and logprobs should be the last part of the
    // stream:
    | {
          type: 'finish'
          finishReason: LanguageModelFinishReason
          usage?: {
              promptTokens: number
              completionTokens: number
              totalTokens: number
              cachedTokens?: number
          }
      }

    // error parts are streamed, allowing for multiple errors
    | { type: 'error'; error: unknown }

/**
 * A source that has been used as input to generate the response.
 */
export type LanguageModelSource = {
    /**
     * A URL source. This is return by web search RAG models.
     */
    sourceType: 'url'

    /**
     * The ID of the source.
     */
    id?: string

    /**
     * The URL of the source.
     */
    url: string

    /**
     * The title of the source.
     */
    title?: string
}

export type LanguageModelCallOptions = LanguageModelCallSettings & {
    prompt: BaseMessage[]
    model?: string
}

export interface LanguageModelToolCall {
    toolId?: string
    toolName?: string
    arguments?: string
}

/**
Reason why a language model finished generating a response.

Can be one of the following:
- `stop`: model generated stop sequence
- `length`: model generated maximum number of tokens
- `content-filter`: content filter violation stopped the model
- `tool-calls`: model triggered tool calls
- `error`: model stopped because of an error
- `other`: model stopped for other reasons
- `unknown`: the model has not transmitted a finish reason
 */
export type LanguageModelFinishReason =
    | 'stop' // model generated stop sequence
    | 'length' // model generated maximum number of tokens
    | 'content-filter' // content filter violation stopped the model
    | 'tool-calls' // model triggered tool calls
    | 'error' // model stopped because of an error
    | 'other' // model stopped for other reasons
    | 'unknown' // the model has not transmitted a finish reason

export type LanguageModelCallSettings = {
    /**
  Maximum number of tokens to generate.
     */
    maxTokens?: number

    /**
  Temperature setting.

  It is recommended to set either `temperature` or `topP`, but not both.
     */
    temperature?: number

    /**
  Stop sequences.
  If set, the model will stop generating text when one of the stop sequences is generated.
  Providers may have limits on the number of stop sequences.
     */
    stopToken?: string[]

    /**
  Nucleus sampling.

  It is recommended to set either `temperature` or `topP`, but not both.
     */
    topP?: number

    /**
  Only sample from the top K options for each subsequent token.

  Used to remove "long tail" low probability responses.
  Recommended for advanced use cases only. You usually only need to use temperature.
     */
    topK?: number

    /**
  Presence penalty setting. It affects the likelihood of the model to
  repeat information that is already in the prompt.
     */
    presencePenalty?: number

    /**
  Frequency penalty setting. It affects the likelihood of the model
  to repeatedly use the same words or phrases.
     */
    frequencyPenalty?: number

    /**
  Response format. The output can either be text or JSON. Default is text.

  If JSON is selected, a schema can optionally be provided to guide the LLM.
     */
    responseFormat?:
        | { type: 'text' }
        | {
              type: 'json'

              /**
               * JSON schema that the generated output should conform to.
               */
              schema?: JSONSchema7

              /**
               * Name of output that should be generated. Used by some providers for additional LLM guidance.
               */
              name?: string

              /**
               * Description of the output that should be generated. Used by some providers for additional LLM guidance.
               */
              description?: string
          }

    /**
  The seed (integer) to use for random sampling. If set and supported
  by the model, calls will generate deterministic results.
     */
    seed?: number

    /**
  Abort signal for cancelling the operation.
     */
    singal?: AbortSignal

    /**
  Additional HTTP headers to be sent with the request.
  Only applicable for HTTP-based providers.
     */
    headers?: Record<string, string | undefined>
}
