import { BaseMessage } from '../messages/messages.ts'

export function transformMessageRemoveSystem(
    messages: BaseMessage[]
): BaseMessage[] {
    if (messages.length === 0) {
        return messages
    }

    const result: BaseMessage[] = []

    for (let i = 0; i < messages.length; i++) {
        const message = messages[i]

        // 检查 result 的最后一个消息的角色
        if (result.length > 0) {
            const lastMessage = result[result.length - 1]

            // 如果最后一个消息是 user，且当前消息也是 user，插入一个 assistant 消息
            if (lastMessage.role === 'user' && message.role === 'user') {
                result.push({
                    role: 'assistant',
                    content: 'Okay, what do I need to do?'
                })
            }
            // 如果最后一个消息是 assistant，且当前消息也是 assistant，插入一个 user 消息
            else if (
                lastMessage.role === 'assistant' &&
                message.role === 'assistant'
            ) {
                result.push({
                    role: 'user',
                    content: 'noop'
                })
            }
        }

        // 处理 system 消息
        if (message.role === 'system') {
            result.push({
                role: 'user',
                content: message.content
            })

            result.push({
                role: 'assistant',
                content: 'Okay, what do I need to do?'
            })

            result.push({
                role: 'user',
                content:
                    'Continue what I said to you last user message. Follow these instructions.'
            })
        } else {
            // 直接添加非 system 消息
            result.push(message)
        }
    }

    const lastMessage = result[result.length - 1]

    if (lastMessage.role === 'assistant') {
        result.push({
            role: 'user',
            content: 'Continue what I said to you last user message.'
        })
    }

    return result
}
