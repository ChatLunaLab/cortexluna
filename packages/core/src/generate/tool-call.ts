import { Callback } from '../callback/index.ts'
import { LanguageModelToolCall } from '../language-models/index.ts'
import { BaseMessage } from '../messages/messages.ts'
import { ToolCallPart, ToolResultPart } from '../messages/part.ts'
import { BaseTool } from '../tools/index.ts'
import { safeParseJSON } from '../utils/safe-parse-json.ts'

export function parseToolCall({
    toolCall,
    tools
}: {
    toolCall: LanguageModelToolCall
    tools: BaseTool[] | undefined
}): ToolCallPart {
    if (tools == null) {
        throw new Error(`No tools provided for ${toolCall.toolName}`)
    }

    return doParseToolCall({ toolCall, tools })
}

function doParseToolCall({
    toolCall,
    tools
}: {
    toolCall: LanguageModelToolCall
    tools: BaseTool[]
}): ToolCallPart {
    const toolName = toolCall.toolName

    const tool = tools.find((tool) => tool.name === toolName)

    if (tool == null) {
        return {
            type: 'tool-call',
            toolCallId: toolCall.toolId,
            toolName: '_exception',
            args: {
                error: `The tool ${toolName} does not exist`
            }
        }
    }

    const schema = tool.schema

    // when the tool call has no arguments, we try passing an empty object to the schema
    // (many LLMs generate empty strings for tool calls with no arguments)
    const parseResult =
        toolCall.arguments.trim() === ''
            ? schema.safeParse({})
            : safeParseJSON({ text: toolCall.arguments, schema })

    if (parseResult.success === false) {
        return {
            type: 'tool-call',
            toolCallId: toolCall.toolId,
            toolName: '_exception',
            args: {
                error: `The tool ${toolName} returned invalid arguments: ${parseResult.error.message}`
            }
        }
    }

    return {
        type: 'tool-call',
        toolCallId: toolCall.toolId,
        toolName,
        args: parseResult.data
    }
}

function executeExcetionTool({
    toolCallId,
    callback,
    messages,
    toolName,
    args
}: {
    toolCallId: string | undefined
    callback: Callback | undefined
    messages: BaseMessage[]
    toolName: string
    args: unknown
}): ToolResultPart {
    const result = {
        type: 'tool-result',
        toolCallId,
        toolName,
        args,
        result: args
    } as const
    callback?.onToolCallStart?.(
        result.toolName,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        result.args as any,
        {
            messages
        }
    )

    callback?.onToolCallEnd?.(
        result.toolName,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        result.result as any,
        {
            messages
        }
    )

    return result
}

export async function executeTools({
    toolCalls,
    tools,
    callback,
    messages
}: {
    toolCalls: ToolCallPart[]
    tools: BaseTool[]
    callback: Callback | undefined
    messages: BaseMessage[]
}): Promise<[ToolResultPart[], boolean]> {
    let returnDirectly = false
    const toolResults = await Promise.all(
        toolCalls.map(async ({ toolCallId, toolName, args }) => {
            if (toolName === '_exception') {
                return executeExcetionTool({
                    toolCallId,
                    callback,
                    toolName,
                    messages,
                    args
                })
            }
            const tool = tools.find((tool) => tool.name === toolName)!

            if (tool.returnDirect) {
                returnDirectly = true
            }

            let toolResult: unknown
            try {
                callback?.onToolCallStart?.(
                    toolName,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    args as any,
                    {
                        messages
                    }
                )
                toolResult = await tool.call!(args)
            } catch (error) {
                return executeExcetionTool({
                    toolCallId,
                    callback,
                    toolName,
                    messages,
                    args: {
                        error: `The tool ${toolName} failed to execute: ${error}`
                    }
                })
            }

            const result = {
                type: 'tool-result',
                toolCallId,
                toolName,
                args,
                result: toolResult
            } as ToolResultPart

            callback?.onToolCallEnd?.(
                result.toolName,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                result.result as any,
                {
                    messages
                }
            )

            return result
        })
    )

    return [
        toolResults.filter(
            (result): result is NonNullable<typeof result> => result != null
        ),
        returnDirectly
    ] as const
}
