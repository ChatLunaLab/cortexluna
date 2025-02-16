import {
    addLanguageModelUsage,
    LanguageModel,
    LanguageModelCallOptions,
    LanguageModelFinishReason,
    LanguageModelSource,
    LanguageModelUsage,
    LanguageResponseMetadata
} from '../language-models/index.ts'
import { AssistantMessage, BaseMessage } from '../messages/messages.ts'
import { ToolCallPart, ToolResultPart } from '../messages/part.ts'
import { BaseTool } from '../tools/index.ts'
import { formatToolsToLanguageModelTools } from '../utils/format-tools-to-language-model-tool.ts'
import { Callback } from '../callback/index.ts'
import { executeTools, parseToolCall } from './tool-call.ts'

export async function generatateText({
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
}): Promise<GenerateTextResult> {
    const formattedPrompt: BaseMessage[] =
        typeof prompt === 'string'
            ? [{ role: 'user', content: prompt }]
            : prompt

    if (responseFormat?.type === 'json') {
        throw new Error(
            'JSON response format not supported yet, please use the generateObject function instead'
        )
    }

    if (maxSteps != null && maxSteps < 1) {
        throw new Error('maxSteps must be greater than 0')
    } else if (maxSteps == null) {
        maxSteps = 5
    }

    let currentModelResponse: Awaited<ReturnType<LanguageModel['doGenerate']>>

    let currentToolCalls: ToolCallPart[] = []
    let currentToolResults: ToolResultPart[] = []
    let stepCount = 0
    let returnDirectly = false
    const responseMessages: BaseMessage[] = []
    const metadata: LanguageResponseMetadata[] = []
    const stepResults: StepResult[] = []
    let text = ''

    let usage: LanguageModelUsage = {
        completionTokens: 0,
        promptTokens: 0,
        cachedTokens: 0,
        totalTokens: 0
    }

    let stepType: 'initial' | 'tool-result' | 'continue' | 'done' = 'initial'

    const languageModelTools = formatToolsToLanguageModelTools(tools ?? [])
    // TODO: check settings

    do {
        const stepInputMessages = [...formattedPrompt, ...responseMessages]

        callback?.onLLMStart?.({
            messages: stepInputMessages,
            tools: languageModelTools,
            modelId: model.model,
            ...settings
        })

        try {
            currentModelResponse = await model.doGenerate({
                prompt: stepInputMessages,
                maxTokens,
                tools: languageModelTools,
                ...settings
            })
        } catch (error) {
            callback?.onError?.(error as Error, {
                modelId: model.model,
                ...settings
            })
            throw error
        }

        metadata.push(...currentModelResponse.responseMetadata)

        callback?.onLLMEnd?.({
            ...currentModelResponse,
            modelId: model.model,
            ...settings
        })

        currentToolCalls = (currentModelResponse.toolCalls ?? []).map(
            (toolCall) =>
                parseToolCall({
                    toolCall,
                    tools
                })
        )

        // execute tools:
        ;[currentToolResults, returnDirectly] =
            tools == null
                ? [[], false]
                : await executeTools({
                      toolCalls: currentToolCalls,
                      tools,
                      callback,
                      messages: stepInputMessages
                  })

        usage = addLanguageModelUsage(
            usage,
            currentModelResponse.usage ?? {
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: 0
            }
        )

        // check if another step is needed:
        let nextStepType: 'done' | 'continue' | 'tool-result' = 'done'
        if (++stepCount < maxSteps) {
            if (
                currentModelResponse.finishReason === 'length' &&
                // only use continue when there are no tool calls:
                currentToolCalls.length === 0
            ) {
                nextStepType = 'continue'
            } else if (
                // there are tool calls:
                currentToolCalls.length > 0 &&
                // all current tool calls have results:
                currentToolResults.length === currentToolCalls.length
            ) {
                nextStepType = 'tool-result'
            }
        }

        if (returnDirectly) {
            stepType = 'done'
        }

        // text:
        const originalText = currentModelResponse.text ?? ''

        text =
            nextStepType === 'continue' || stepType === 'continue'
                ? text + originalText
                : originalText

        // sources:

        // append to messages for potential next step:
        if (stepType === 'continue') {
            // continue step: update the last assistant message
            // continue is only possible when there are no tool calls,
            // so we can assume that there is a single last assistant message:
            const lastMessage = responseMessages[
                responseMessages.length - 1
            ] as AssistantMessage

            if (typeof lastMessage.content === 'string') {
                lastMessage.content += originalText
            } else {
                lastMessage.content.push({
                    text: originalText,
                    type: 'text'
                })
            }
        } else {
            responseMessages.push(
                ...toResponseMessages({
                    text,
                    toolCalls: currentToolCalls,
                    toolResults: currentToolResults
                })
            )
        }

        stepResults.push({
            text,
            reasoning: currentModelResponse.reasoning,
            toolCalls: currentToolCalls,
            toolResults: currentToolResults,
            finishReason: currentModelResponse.finishReason,
            usage,
            metadata,
            sources: []
        })

        callback?.onTextGenerated?.(text, {
            ...stepResults[stepResults.length - 1],
            ...settings
        })
        stepType = nextStepType
    } while (stepType !== 'done')

    const result = {
        text,
        reasoning: currentModelResponse.reasoning,
        toolCalls: currentToolCalls,
        toolResults: currentToolResults,
        finishReason: currentModelResponse.finishReason,
        usage,
        steps: stepResults,
        metadata,
        sources: []
    } satisfies GenerateTextResult

    callback?.onTextGenerated?.(text, {
        ...result,
        ...settings
    })

    return result
}

// TODO: steps
export interface GenerateTextResult {
    readonly text: string

    readonly reasoning?: string | undefined

    readonly sources: LanguageModelSource[]

    readonly toolCalls: ToolCallPart[]

    readonly toolResults: ToolResultPart[]

    readonly finishReason: LanguageModelFinishReason

    readonly usage: LanguageModelUsage

    readonly metadata: LanguageResponseMetadata[]

    readonly steps: StepResult[]
}

export interface StepResult {
    readonly text: string

    readonly reasoning?: string | undefined

    readonly sources: LanguageModelSource[]

    readonly toolCalls: ToolCallPart[]

    readonly toolResults: ToolResultPart[]

    readonly finishReason: LanguageModelFinishReason

    readonly usage: LanguageModelUsage

    readonly metadata: LanguageResponseMetadata[]
}

/**
Converts the result of a `generateText` call to a list of response messages.
 */
export function toResponseMessages({
    text = '',
    toolCalls,
    toolResults
}: {
    text: string | undefined
    toolCalls: ToolCallPart[]
    toolResults: ToolResultPart[]
}): BaseMessage[] {
    const responseMessages: BaseMessage[] = []

    responseMessages.push({
        role: 'assistant',
        content: [{ type: 'text', text }, ...toolCalls]
    })

    if (toolResults.length > 0) {
        responseMessages.push({
            role: 'tool',

            content: toolResults
        })
    }

    return responseMessages
}
