import { BaseMessage, dataContentToBase64 } from 'cortexluna'

export function convertToOpenAICompatibleChatMessages(
    prompt: BaseMessage[]
): OpenAICompatibleChatPrompt {
    const messages: OpenAICompatibleChatPrompt = []

    for (const message of prompt) {
        const content = message.content

        switch (message.role) {
            case 'system': {
                const content = message.content
                messages.push({
                    role: 'system',
                    content
                })
                continue
            }
            case 'user': {
                const content = message.content

                if (typeof content === 'string') {
                    messages.push({
                        role: 'user',
                        content
                    })
                    continue
                }

                if (
                    Array.isArray(content) &&
                    content.length === 1 &&
                    content[0].type === 'text'
                ) {
                    messages.push({
                        role: 'user',
                        content: content[0].text
                    })
                    continue
                }

                messages.push({
                    role: 'user',
                    content: content.map((part) => {
                        if (part.type === 'text') {
                            return {
                                type: 'text',
                                text: part.text
                            }
                        }
                        if (part.type === 'image') {
                            const imageUrl = part.image
                            return {
                                type: 'image_url',
                                image_url: {
                                    url:
                                        typeof imageUrl === 'string'
                                            ? imageUrl
                                            : imageUrl instanceof URL
                                              ? imageUrl.toString()
                                              : `data:${
                                                    part.mineType ??
                                                    'image/jpeg'
                                                };base64,${dataContentToBase64(imageUrl)}`
                                }
                            }
                        }
                        throw new Error(
                            `Invalid content part type of ${JSON.stringify(part)}`
                        )
                    })
                })

                continue
            }

            case 'assistant': {
                let text = ''
                const toolCalls: {
                    id: string
                    type: 'function'
                    function: { name: string; arguments: string }
                }[] = []

                if (typeof content === 'string') {
                    messages.push({
                        role: 'assistant',
                        content
                    })
                    continue
                }

                for (const part of content) {
                    switch (part.type) {
                        case 'text': {
                            text += part.text
                            break
                        }
                        case 'tool-call': {
                            toolCalls.push({
                                // ??
                                id: part.toolCallId || '',
                                type: 'function',
                                function: {
                                    name: part.toolName,
                                    arguments: JSON.stringify(part.args)
                                }
                            })
                            break
                        }
                        default: {
                            throw new Error(
                                `Unsupported part: ${JSON.stringify(part)}`
                            )
                        }
                    }
                }

                messages.push({
                    role: 'assistant',
                    content: text,
                    tool_calls: toolCalls.length > 0 ? toolCalls : undefined
                })

                break
            }

            case 'tool': {
                const content = message.content

                for (const toolResponse of content) {
                    messages.push({
                        role: 'tool',
                        tool_call_id: toolResponse.toolCallId ?? '',
                        content: JSON.stringify(toolResponse.result)
                    })
                }
                break
            }
        }
    }

    return messages
}

export type OpenAICompatibleChatPrompt = OpenAICompatibleMessage[]

export type OpenAICompatibleMessage =
    | OpenAICompatibleSystemMessage
    | OpenAICompatibleUserMessage
    | OpenAICompatibleAssistantMessage
    | OpenAICompatibleToolMessage

export interface OpenAICompatibleSystemMessage {
    role: 'system'
    content: string
}

export interface OpenAICompatibleUserMessage {
    role: 'user'
    content: string | OpenAICompatibleContentPart[]
}

export type OpenAICompatibleContentPart =
    | OpenAICompatibleContentPartText
    | OpenAICompatibleContentPartImage

export interface OpenAICompatibleContentPartImage {
    type: 'image_url'
    image_url: { url: string }
}

export interface OpenAICompatibleContentPartText {
    type: 'text'
    text: string
}

export interface OpenAICompatibleAssistantMessage {
    role: 'assistant'
    content?: string | null
    tool_calls?: OpenAICompatibleMessageToolCall[]
}

export interface OpenAICompatibleMessageToolCall {
    type: 'function'
    id: string
    function: {
        arguments: string
        name: string
    }
}

export interface OpenAICompatibleToolMessage {
    role: 'tool'
    content: string
    tool_call_id: string
}
