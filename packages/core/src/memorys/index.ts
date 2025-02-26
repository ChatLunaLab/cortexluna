import { BaseMessage } from '../messages/index.ts'
export * from './buffer-window-memory.ts'
export interface BaseChatMessageHistory {
    getMessages(): Promise<BaseMessage[]>

    addMessage(message: BaseMessage): Promise<void>

    addUserMessage(message: string): Promise<void>

    addAssistantChatMessage(message: string): Promise<void>

    addMessages(messages: BaseMessage[]): Promise<void>

    clear(): Promise<void>
}

export function inMemoryChatMessageHistory(): BaseChatMessageHistory {
    const messages: BaseMessage[] = []
    return {
        getMessages: async () => messages.slice(),
        addMessage: async (message) => {
            messages.push(message)
        },
        addUserMessage: async (message) => {
            messages.push({
                role: 'user',
                content: message
            })
        },
        addAssistantChatMessage: async (message) => {
            messages.push({
                role: 'assistant',
                content: message
            })
        },
        addMessages: async (messages) => {
            messages.push(...messages)
        },
        clear: async () => {
            messages.splice(0, messages.length)
        }
    }
}
