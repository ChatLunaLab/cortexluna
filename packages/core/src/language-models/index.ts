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
        usage?: LanguageModelUsage
        responseMetadata: LanguageResponseMetadata[]
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

    // Tool call deltas are only needed for object generation modes.
    // The tool call deltas must be partial JSON strings.
    | {
          type: 'tool-call'
          toolCallType: 'function'
          toolCallId: string
          toolName: string
          args: string
      }

    // the usage stats, finish reason and logprobs should be the last part of the
    // stream:
    | {
          type: 'finish'
          finishReason: LanguageModelFinishReason
          usage?: LanguageModelUsage
      }

    // error parts are streamed, allowing for multiple errors
    | { type: 'error'; error: unknown }

export type LanguageModelUsage = {
    promptTokens: number
    completionTokens: number
    totalTokens: number
    cachedTokens?: number
}

export type LanguageResponseMetadata = {
    id?: string
    timestamp?: Date
    model?: string
    responseType: 'text' | 'reasoning' | 'source' | 'tool-call'
}

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
    modelId?: string
    tools?: LanguageModelTool[]
}

export interface LanguageModelToolCall {
    toolId?: string
    toolName: string
    arguments: string
}

/**
A tool has a name, a description, and a set of parameters.

Note: this is **not** the user-facing tool definition. The AI SDK methods will
map the user-facing tool definitions to this format.
 */
export type LanguageModelTool = {
    /**
The type of the tool (always 'function').
   */
    type: 'function'

    function: {
        /**
The name of the tool. Unique within this model call.
   */
        name: string

        /**
A description of the tool. The language model uses this to understand the
tool's purpose and to provide better completion suggestions.
   */
        description?: string

        /**
The parameters that the tool expects. The language model uses this to
understand the tool's input requirements and to provide matching suggestions.
   */
        parameters: JSONSchema7
    }
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
    signal?: AbortSignal

    /**
  Additional HTTP headers to be sent with the request.
  Only applicable for HTTP-based providers.
     */
    headers?: Record<string, string | undefined>

    /**
     * Maximum number of retries for the request.
     */
    maxRetries?: number

    /**
     * Other metadata for provider
     */
    metadata?: Record<string, unknown>
}

export function addLanguageModelUsage(
    usage1: LanguageModelUsage,
    usage2: LanguageModelUsage
): LanguageModelUsage {
    return {
        promptTokens: usage1.promptTokens + usage2.promptTokens,
        cachedTokens: (usage1?.cachedTokens ?? 0) + (usage2?.cachedTokens ?? 0),
        completionTokens: usage1.completionTokens + usage2.completionTokens,
        totalTokens: usage1.totalTokens + usage2.totalTokens
    }
}
