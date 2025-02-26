import { BaseMessage } from '../index.ts'
import { BaseChatMessageHistory } from './index.ts'

export function bufferWindowMemory(windowSize: number): BaseChatMessageHistory {
    const messages: BaseMessage[] = []
    return {
        getMessages: async () => messages.slice(-windowSize),
        addMessage: async (message: BaseMessage) => {
            messages.push(message)
            if (messages.length > windowSize) {
                messages.shift()
            }
        },
        addUserMessage: async function (message: string) {
            this.addMessage({
                content: message,
                role: 'user'
            })
        },
        addAssistantChatMessage: async function (message: string) {
            this.addMessage({
                content: message,
                role: 'assistant'
            })
        },
        addMessages: async function (messages: BaseMessage[]) {
            for (const message of messages) {
                this.addMessage(message)
            }
        },
        clear: async function () {
            messages.length = 0
        }
    }
}
