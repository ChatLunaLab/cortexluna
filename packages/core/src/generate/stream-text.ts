import { Callback } from '../callback/index.ts'
import {
    addLanguageModelUsage,
    LanguageModel,
    LanguageModelCallOptions,
    LanguageModelFinishReason,
    LanguageModelSource,
    LanguageModelUsage,
    LanguageResponseMetadata
} from '../language-models/index.ts'
import {
    AssistantMessage,
    BaseMessage,
    BaseMessageChunk,
    createMessageChunk,
    UserMessage
} from '../messages/messages.ts'
import { TextPart, ToolCallPart, ToolResultPart } from '../messages/part.ts'
import { BaseTool } from '../tools/index.ts'
import {
    AsyncIterableStream,
    createAsyncIterableStream
} from '../utils/async-iterable-stream.ts'
import { formatToolsToLanguageModelTools } from '../utils/format-tools-to-language-model-tool.ts'
import { StepResult } from './generate-text.ts'
import { DelayedPromise } from '../utils/delayed-promise.ts'
import { executeTools } from './tool-call.ts'

interface StreamState {
    stepText: string
    fullText: string
    reasoningText?: string
    stepSources: LanguageModelSource[]
    sources: LanguageModelSource[]
    toolCalls: ToolCallPart[]
    toolResults: ToolResultPart[]
    finishReason?: LanguageModelFinishReason
    usage?: LanguageModelUsage
    steps: StepResult[]
    metadata: LanguageResponseMetadata[]
    currentStep: number
    currentStepState: 'initial' | 'continue' | 'tool-result' | 'done'
    currentStepMetadata?: LanguageResponseMetadata
}

function createInitialState(): StreamState {
    return {
        stepText: '',
        fullText: '',
        stepSources: [],
        sources: [],
        toolCalls: [],
        toolResults: [],
        steps: [],
        metadata: [],
        currentStep: -1,
        currentStepState: 'initial'
    }
}

/**
 * Creates a stream of BaseMessageChunk objects from an input source
 * @param source The source stream of text or message parts
 * @param role The role of the message chunks (default: 'assistant')
 * @returns An AsyncIterableStream of BaseMessageChunk objects
 */
export function streamMessageChunks(
    source:
        | ReadableStream<TextStreamPart>
        | TransformStream<unknown, TextStreamPart>,
    role: 'assistant' | 'user' | 'system' | 'tool' = 'assistant'
): AsyncIterableStream<BaseMessageChunk> {
    const outputStream = new TransformStream<unknown, BaseMessageChunk>()
    const writer = outputStream.writable.getWriter()

    // Create a reader for the source stream
    const readableStream =
        source instanceof TransformStream ? source.readable : source
    const reader = readableStream.getReader()

    // Process the stream
    let accumulatedText = ''
    let reasoningText = ''
    const currentToolCalls: ToolCallPart[] = []
    const currentToolResults: ToolResultPart[] = []

    // Process the stream asynchronously
    ;(async () => {
        try {
            while (true) {
                const { done, value } = await reader.read()

                if (done) {
                    // When the stream is done, emit a final message chunk if there's accumulated content
                    if (
                        accumulatedText ||
                        currentToolCalls.length > 0 ||
                        currentToolResults.length > 0
                    ) {
                        const content = createFinalContent(
                            accumulatedText,
                            currentToolCalls,
                            currentToolResults
                        )
                        const chunk = createMessageChunk({
                            role,
                            content,
                            metadata: reasoningText
                                ? { reasoning: reasoningText }
                                : undefined
                        })
                        await writer.write(chunk)
                    }
                    break
                }

                // Process different types of stream parts
                if (value.type === 'text-delta') {
                    accumulatedText += value.textDelta

                    // Create a message chunk with the current text
                    const chunk = createMessageChunk({
                        role,
                        content: accumulatedText,
                        metadata: reasoningText
                            ? { reasoning: reasoningText }
                            : undefined
                    })

                    await writer.write(chunk)
                } else if (value.type === 'reasoning') {
                    // Accumulate reasoning text
                    reasoningText += value.textDelta

                    // Create a message chunk with the current content and updated reasoning
                    const chunk = createMessageChunk({
                        role,
                        content: accumulatedText,
                        metadata: { reasoning: reasoningText }
                    })

                    await writer.write(chunk)
                } else if (value.type === 'tool-call') {
                    // Add a new tool call
                    const toolCall: ToolCallPart = {
                        type: 'tool-call',
                        toolCallId: value.toolCallId,
                        toolName: value.toolName,
                        args: JSON.parse(value.args)
                    }

                    currentToolCalls.push(toolCall)

                    // Create a message chunk with the current content
                    const content = createFinalContent(
                        accumulatedText,
                        currentToolCalls,
                        currentToolResults
                    )
                    const chunk = createMessageChunk({
                        role,
                        content,
                        metadata: reasoningText
                            ? { reasoning: reasoningText }
                            : undefined
                    })

                    await writer.write(chunk)
                } else if (value.type === 'tool-result') {
                    // Add a new tool result
                    const toolResult: ToolResultPart = {
                        type: 'tool-result',
                        toolCallId: value.toolCallId,
                        toolName: '', // This will be filled in by matching with tool calls
                        result: JSON.parse(value.toolResult)
                    }

                    // Try to find matching tool call to get the tool name
                    const matchingToolCall = currentToolCalls.find(
                        (tc) => tc.toolCallId === value.toolCallId
                    )
                    if (matchingToolCall) {
                        toolResult.toolName = matchingToolCall.toolName
                    }

                    currentToolResults.push(toolResult)

                    // Create a message chunk with the current content
                    const content = createFinalContent(
                        accumulatedText,
                        currentToolCalls,
                        currentToolResults
                    )
                    const chunk = createMessageChunk({
                        role,
                        content,
                        metadata: reasoningText
                            ? { reasoning: reasoningText }
                            : undefined
                    })

                    await writer.write(chunk)
                }
                // Other types (source, etc.) are ignored for message chunks
            }

            await writer.close()
        } catch (error) {
            await writer.abort(error)
            throw error
        } finally {
            reader.releaseLock()
        }
    })()

    return createAsyncIterableStream(outputStream)
}

/**
 * Helper function to create the final content for a message chunk
 */
function createFinalContent(
    text: string,
    toolCalls: ToolCallPart[],
    toolResults: ToolResultPart[]
): string | (TextPart | ToolCallPart | ToolResultPart)[] {
    if (!text && toolCalls.length === 0 && toolResults.length === 0) {
        return ''
    }

    const parts: (TextPart | ToolCallPart | ToolResultPart)[] = []

    // Add text part if there's text
    if (text) {
        parts.push({
            type: 'text',
            text
        })
    }

    // Add tool calls
    parts.push(...toolCalls)

    // Add tool results
    parts.push(...toolResults)

    // If there's only text and no tool calls/results, return as string
    if (parts.length === 1 && parts[0].type === 'text') {
        return parts[0].text
    }

    return parts
}

export function streamText({
    model,
    prompt,
    maxRetries,
    maxTokens,
    responseFormat,
    callback,
    maxSteps,
    signal,
    tools,
    ...settings
}: Omit<LanguageModelCallOptions, 'tools' | 'prompt'> & {
    model: LanguageModel
    prompt: BaseMessage[] | string
    callback?: Callback
    tools?: BaseTool[]
    maxSteps?: number
}): StreamTextResult {
    const state = createInitialState()
    const promises = {
        usage: new DelayedPromise<LanguageModelUsage>(),
        sources: new DelayedPromise<LanguageModelSource[]>(),
        finishReason: new DelayedPromise<LanguageModelFinishReason>(),
        text: new DelayedPromise<string>(),
        reasoning: new DelayedPromise<string | undefined>(),
        steps: new DelayedPromise<StepResult[]>(),
        metadata: new DelayedPromise<LanguageResponseMetadata[]>(),
        toolCalls: new DelayedPromise<ToolCallPart[]>(),
        toolResults: new DelayedPromise<ToolResultPart[]>()
    }

    const baseStream = new TransformStream<TextStreamPart, TextStreamPart>()
    const writer = baseStream.writable.getWriter()

    const formattedPrompt =
        typeof prompt === 'string'
            ? [{ role: 'user', content: prompt } satisfies UserMessage]
            : prompt

    let lastPartType: 'reasoning' | 'source' | 'tool-call' | 'text' | '' = ''

    const responseMessages: BaseMessage[] = []

    if (maxSteps != null && maxSteps < 1) {
        throw new Error('maxSteps must be greater than 0')
    }
    maxSteps = maxSteps ?? 5

    const languageModelTools = formatToolsToLanguageModelTools(tools ?? [])

    async function handleStreamPart(value: TextStreamPart) {
        switch (value.type) {
            case 'text-delta':
                state.fullText += value.textDelta
                state.stepText += value.textDelta
                state.currentStepState =
                    state.currentStepState === 'initial'
                        ? 'continue'
                        : state.currentStepState

                writer.write(value)
                break
            case 'reasoning':
                state.reasoningText =
                    (state.reasoningText ?? '') + value.textDelta
                writer.write(value)
                break
            case 'source':
                state.sources.push(value.source)
                state.stepSources.push(value.source)
                writer.write(value)
                break
            case 'tool-call': {
                if (!tools) {
                    break
                }
                const part: ToolCallPart = {
                    toolCallId: value.toolCallId,
                    toolName: value.toolName,
                    args: value.args,
                    type: 'tool-call'
                }

                if (part) {
                    state.toolCalls.push(part)
                    state.currentStepState = 'tool-result'
                    writer.write(value)
                }

                break
            }
            case 'tool-result':
                responseMessages.push({
                    role: 'tool',
                    content: state.toolResults
                })
                writer.write(value)
                break
            case 'response-metadata': {
                state.metadata.push(value.metadata)
                break
            }
            case 'step-start':
                state.currentStep++

                state.stepText = ''
                state.stepSources = []
                state.toolCalls = []
                state.toolResults = []
                state.currentStepState = 'initial'
                writer.write(value)
                break
            case 'step-finish':
                if (state.toolCalls.length > 0) {
                    const [results, returnDirectly] = await executeTools({
                        toolCalls: state.toolCalls,
                        tools: tools ?? [],
                        callback,
                        messages: [...formattedPrompt, ...responseMessages]
                    })
                    state.toolResults = results
                    if (returnDirectly) {
                        state.currentStepState = 'done'
                    } else {
                        state.currentStepState = 'continue'
                    }
                } else {
                    state.currentStepState = 'done'
                }
                if (state.stepText) {
                    const messageContent: AssistantMessage['content'] = [
                        {
                            type: 'text',
                            text: state.stepText
                        }
                    ]

                    if (state.toolCalls.length > 0) {
                        for (const toolCall of state.toolCalls) {
                            messageContent.push({
                                type: 'tool-call',
                                toolCallId: toolCall.toolCallId,
                                toolName: toolCall.toolName,
                                args: toolCall.args
                            })
                        }
                    }

                    responseMessages.push({
                        role: 'assistant',
                        content: messageContent
                    })
                }

                writer.write(value)

                state.steps.push({
                    text: state.stepText,
                    sources: state.stepSources,
                    toolCalls: state.toolCalls,
                    toolResults: state.toolResults,
                    finishReason: state.finishReason ?? 'stop',
                    usage: state.usage ?? {
                        promptTokens: 0,
                        completionTokens: 0,
                        totalTokens: 0
                    },
                    metadata: state.metadata
                })

                break
            case 'finish':
                state.finishReason = value.finishReason
                if (value.usage) {
                    state.usage = state.usage
                        ? addLanguageModelUsage(state.usage, value.usage)
                        : value.usage
                }
                state.currentStepState = 'done'
                writer.write(value)
                callback?.onLLMEnd?.({
                    text: state.fullText,
                    modelId: model.model,
                    ...settings,
                    ...state
                })
                break
            case 'error':
                callback?.onError?.(value.error as Error, {
                    modelId: model.model,
                    ...settings
                })
                throw value.error
        }

        let currentPartType:
            | 'reasoning'
            | 'source'
            | 'tool-call'
            | 'text'
            | '' = ''

        if (value.type === 'tool-result' || value.type === 'tool-call') {
            currentPartType = 'tool-call'
        } else if (value.type === 'text-delta') {
            currentPartType = 'text'
        } else if (value.type === 'reasoning') {
            currentPartType = 'reasoning'
        } else if (value.type === 'source') {
            currentPartType = 'source'
        }

        if (currentPartType !== lastPartType && currentPartType !== '') {
            const metadata = {
                type: 'response-metadata',
                metadata: {
                    timestamp: new Date(),
                    model: settings.modelId ?? model.model,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    responseType: currentPartType as any
                }
            } satisfies TextStreamPart
            writer.write(metadata)
            state.metadata.push(metadata.metadata)
            lastPartType = currentPartType
        }
    }

    async function processStream() {
        if (maxSteps == null) {
            maxSteps = 5
        }
        try {
            while (
                state.currentStepState !== 'done' &&
                !(signal?.aborted ?? false)
            ) {
                callback?.onLLMStart?.({
                    messages: formattedPrompt,
                    tools: languageModelTools,
                    modelId: model.model,
                    ...settings
                })

                state.currentStepState = 'done'

                const stream = await model.doStream({
                    prompt: [...formattedPrompt, ...responseMessages],
                    maxTokens,
                    tools: languageModelTools,
                    signal,
                    ...settings
                })

                const reader = stream.getReader()

                await handleStreamPart({
                    type: 'step-start'
                })

                try {
                    while (!(signal?.aborted ?? false)) {
                        const { done, value } = await reader.read()

                        if (done) break

                        await handleStreamPart(value)

                        if (state.toolCalls.length > 0) {
                            const [toolResults, returnDirectly] =
                                await executeTools({
                                    toolCalls: state.toolCalls,
                                    tools: tools ?? [],
                                    messages: [
                                        ...formattedPrompt,
                                        ...responseMessages
                                    ],
                                    callback
                                })
                            state.toolResults = toolResults
                            state.currentStep += 1
                            state.currentStepState = returnDirectly
                                ? 'done'
                                : 'continue'
                            break // Break inner loop to get new stream
                        }
                    }
                } finally {
                    reader.releaseLock()
                }

                if (state.currentStepState === 'done') break
            }

            if (state.currentStep >= maxSteps) {
                state.finishReason = 'other'
                state.currentStepState = 'done'
            }

            promises.text.resolve(state.fullText)
            promises.reasoning.resolve(state.reasoningText)
            promises.sources.resolve(state.sources)
            promises.finishReason.resolve(state.finishReason ?? 'stop')
            promises.usage.resolve(
                state.usage ?? {
                    promptTokens: 0,
                    completionTokens: 0,
                    totalTokens: 0
                }
            )
            promises.toolCalls.resolve(state.toolCalls)
            promises.toolResults.resolve(state.toolResults)
            promises.steps.resolve(state.steps)
            promises.metadata.resolve(state.metadata)

            await writer.close()
        } catch (error) {
            writer.abort(error)
            promises.text.reject(error)
            promises.reasoning.reject(error)
            promises.sources.reject(error)
            promises.finishReason.reject(error)
            promises.usage.reject(error)
            promises.toolCalls.reject(error)
            promises.toolResults.reject(error)
            promises.steps.reject(error)
            promises.metadata.reject(error)
            throw error
        }
    }

    processStream().catch((error) => {
        writer.abort(error)
    })

    return {
        get textStream() {
            return createAsyncIterableStream<string>(
                baseStream.readable.pipeThrough(
                    new TransformStream<TextStreamPart, string>({
                        transform(chunk, controller) {
                            if (chunk.type === 'text-delta') {
                                controller.enqueue(chunk.textDelta)
                            }
                        },
                        flush(controller) {
                            controller.terminate()
                        }
                    })
                )
            )
        },

        get messageStream() {
            return streamMessageChunks(baseStream, 'assistant')
        },

        get fullStream() {
            return createAsyncIterableStream<TextStreamPart>(baseStream)
        },

        get usage() {
            return promises.usage.promise
        },

        get sources() {
            return promises.sources.promise
        },

        get finishReason() {
            return promises.finishReason.promise
        },

        get text() {
            return promises.text.promise
        },

        get reasoning() {
            return promises.reasoning.promise
        },

        get steps() {
            return promises.steps.promise
        },

        get metadata() {
            return promises.metadata.promise
        },

        get toolCalls() {
            return promises.toolCalls.promise
        },

        get toolResults() {
            return promises.toolResults.promise
        }
    }
}

export interface StreamTextResult {
    readonly usage: Promise<LanguageModelUsage>

    readonly sources: Promise<LanguageModelSource[]>

    readonly finishReason: Promise<LanguageModelFinishReason>

    readonly text: Promise<string>

    readonly reasoning: Promise<string | undefined>

    readonly toolCalls: Promise<ToolCallPart[]>

    readonly toolResults: Promise<ToolResultPart[]>

    readonly steps: Promise<StepResult[]>

    readonly metadata: Promise<LanguageResponseMetadata[]>

    readonly textStream: AsyncIterableStream<string>

    readonly messageStream: AsyncIterableStream<BaseMessageChunk>

    readonly fullStream: AsyncIterableStream<TextStreamPart>
}

export type TextStreamPart =
    | {
          type: 'text-delta'
          textDelta: string
      }
    | {
          type: 'reasoning'
          textDelta: string
      }
    | {
          type: 'source'
          source: LanguageModelSource
      }
    | {
          type: 'tool-call'
          toolCallId: string
          toolName: string
          args: string
      }
    | {
          type: 'tool-result'
          toolCallId: string
          toolResult: string
      }
    | {
          type: 'step-start'
      }
    | {
          type: 'step-finish'
      }
    | {
          type: 'finish'
          finishReason: LanguageModelFinishReason
          usage?: LanguageModelUsage
      }
    | {
          type: 'error'
          error: unknown
      }
    | {
          type: 'response-metadata'
          metadata: LanguageResponseMetadata
      }
