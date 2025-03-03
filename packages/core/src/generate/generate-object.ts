import {
    addLanguageModelUsage,
    LanguageModel,
    LanguageModelCallOptions,
    LanguageModelFinishReason,
    LanguageModelTool,
    LanguageModelUsage,
    LanguageResponseMetadata
} from '../language-models/index.ts'
import { BaseMessage } from '../messages/messages.ts'
import { Callback } from '../callback/index.ts'
import { Schema, z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

export async function generateObject<T>({
    model,
    prompt,
    mode,
    maxRetries,
    maxTokens,
    callback,
    maxSteps,
    signal,
    schema,
    schemaDescription,
    schemaName,
    ...settings
}: Omit<LanguageModelCallOptions, 'tools' | 'prompt' | 'responseFormat'> & {
    model: LanguageModel
    prompt: BaseMessage[] | string
    callback?: Callback

    /**
The schema of the object that the model should generate.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema: z.Schema<T, z.ZodTypeDef, any> | Schema<T>

    /**
Optional name of the output that should be generated.
Used by some providers for additional LLM guidance, e.g.
via tool or schema name.
*/
    schemaName?: string

    /**
Optional description of the output that should be generated.
Used by some providers for additional LLM guidance, e.g.
via tool or schema description.
*/
    schemaDescription?: string

    /**
The mode to use for object generation.

The schema is converted into a JSON schema and used in one of the following ways

- 'auto': The provider will choose the best mode for the model.
- 'tool': A tool with the JSON schema as parameters is provided and the provider is instructed to use it.
- 'json': The JSON schema and an instruction are injected into the prompt. If the provider supports JSON mode, it is enabled. If the provider supports JSON grammars, the grammar is used.

Please note that most providers do not support all modes.

Default and recommended: 'auto' (best mode for the model).
*/
    mode?: 'auto' | 'json' | 'tool'
    maxSteps?: number
}): Promise<GenerateObjectResult<T>> {
    const formattedPrompt: BaseMessage[] =
        typeof prompt === 'string'
            ? [{ role: 'user', content: prompt }]
            : prompt

    if (mode === 'auto' || mode == null) {
        mode = 'json'
    }

    let currentModelResponse: Awaited<ReturnType<LanguageModel['doGenerate']>> =
        {
            text: '',
            finishReason: 'stop' as const,
            responseMetadata: [],
            usage: {
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: 0
            },
            toolCalls: [],
            response: {
                role: 'assistant',
                content: ''
            }
        }

    const responseMessages: BaseMessage[] = []
    const metadata: LanguageResponseMetadata[] = []

    let usage: LanguageModelUsage = {
        completionTokens: 0,
        promptTokens: 0,
        cachedTokens: 0,
        totalTokens: 0
    }
    const tools: LanguageModelTool[] = [
        {
            type: 'function',
            function: {
                name: schemaName ?? 'generateObject',
                description:
                    schemaDescription ??
                    'Generate an object that matches the given JSON schema.',
                parameters: {
                    type: 'object',
                    properties: {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        object: zodToJsonSchema(schema) as any
                    },
                    required: ['object']
                }
            }
        }
    ]

    let stepType: 'initial' | 'done' = 'initial'

    let parsedResult: T | null = null

    // TODO: check settings

    do {
        const stepInputMessages = [...formattedPrompt, ...responseMessages]

        callback?.onLLMStart?.({
            messages: stepInputMessages,
            modelId: model.model,
            ...settings
        })

        try {
            currentModelResponse = await model.doGenerate({
                prompt: stepInputMessages,
                maxTokens,
                tools: mode === 'tool' ? tools : undefined,
                responseFormat:
                    mode === 'json'
                        ? {
                              type: 'json',
                              // eslint-disable-next-line @typescript-eslint/no-explicit-any
                              schema: zodToJsonSchema(schema) as any,
                              name: schemaName,
                              description: schemaDescription
                          }
                        : undefined,
                ...settings
            })
        } catch (error) {
            callback?.onError?.(error as Error, {
                modelId: model.model,
                ...settings
            })
            if (mode === 'json') {
                mode = 'tool'
                continue
            }
            throw error
        }

        metadata.push(...currentModelResponse.responseMetadata)

        callback?.onLLMEnd?.({
            ...currentModelResponse,
            modelId: model.model,
            ...settings
        })

        const modelRepsponse =
            currentModelResponse.toolCalls?.[0]?.arguments ??
            currentModelResponse.text

        usage = addLanguageModelUsage(
            usage,
            currentModelResponse.usage ?? {
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: 0
            }
        )

        if (modelRepsponse == null) {
            throw new Error(
                `No result returned from model, model result: ${currentModelResponse.text}`
            )
        }

        const parsedModelRepsponse = JSON.parse(modelRepsponse)
        parsedResult = schema.parse(parsedModelRepsponse)

        callback?.onTextGenerated?.(modelRepsponse, {
            ...currentModelResponse,
            ...settings
        })
        stepType = 'done'
    } while (stepType !== 'done')

    if (parsedResult == null) {
        throw new Error(
            `No result returned from model, model result: ${currentModelResponse.text}`
        )
    }
    const result = {
        object: parsedResult,
        reasoning: currentModelResponse.reasoning,

        finishReason: currentModelResponse.finishReason,
        usage,
        metadata
    } satisfies GenerateObjectResult<T>

    callback?.onTextGenerated?.(currentModelResponse.text ?? '', {
        ...result,
        ...settings
    })

    return result
}

export interface GenerateObjectResult<T> {
    readonly object: T

    readonly reasoning?: string | undefined

    readonly finishReason: LanguageModelFinishReason

    readonly usage: LanguageModelUsage

    readonly metadata: LanguageResponseMetadata[]
}
