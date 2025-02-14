import { MessageContentSchema } from '../messages/index.ts'
import {
    BaseMessage,
    BaseMessageLikeArraySchema,
    InferMessageTypeByRole,
    MessageRole,
    MessageRoleSchema,
    UserMessage
} from '../messages/messages.ts'
import {
    BasePromptTemplate,
    paritalPromptTemplate,
    promptTemplate
} from './base.ts'
import { InputValues } from './types.ts'

export interface BaseMessagePromptTemplate<T extends BaseMessage = BaseMessage>
    extends BasePromptTemplate<T> {
    formatMessages(values: InputValues): Promise<T[]>
    role: MessageRole
    _type: 'base_message_prompt_template'
}

export interface BaseMessagesPromptTemplate<
    T extends BaseMessage[] = BaseMessage[]
> extends BasePromptTemplate<T> {
    formatMessages(values: InputValues): Promise<T>
    _type: 'base_messages_prompt_template'
}

export function messagesPlaceholderPromptTemplate(
    variableName: string,
    optional: boolean = false
): BaseMessagesPromptTemplate {
    return {
        inputVariables: [variableName],
        template: `{${variableName}}`,
        format(values) {
            return this.formatMessages(values)
        },
        formatMessages: async (values: InputValues) => {
            const inputValue = values[variableName]

            if (inputValue === undefined && !optional) {
                throw new Error(
                    `The MessagesPlaceholderPromptTemplate requires a value for ${variableName}.`
                )
            }

            if (inputValue === undefined) {
                return []
            }

            if (Array.isArray(inputValue)) {
                return BaseMessageLikeArraySchema.parse(inputValue)
            } else {
                return [
                    {
                        role: 'user',
                        content: MessageContentSchema.parse(inputValue)
                    } satisfies UserMessage
                ]
            }
        },
        partial(values) {
            throw new Error(
                `The MessagesPlaceholderPromptTemplate does not support partial values.`
            )
        },
        _type: 'base_messages_prompt_template'
    }
}

export function messagePromptTemplate<T extends MessageRole = 'user'>(
    role: T,
    prompt: string | BasePromptTemplate
): BaseMessagePromptTemplate<InferMessageTypeByRole<T>> {
    const template =
        typeof prompt === 'string' ? promptTemplate(prompt) : prompt

    return {
        role,
        inputVariables: template.inputVariables,
        template: template.template,
        async format(values) {
            const content = await template.format(values)
            return {
                role,
                content
            } as InferMessageTypeByRole<T>
        },
        async formatMessages(values) {
            return [await this.format(values)]
        },
        partial(values) {
            return messagePromptTemplate(role, template.partial(values))
        },
        _type: 'base_message_prompt_template'
    }
}

export function systemMessagePromptTemplate(
    prompt: string | BasePromptTemplate
) {
    return messagePromptTemplate('system', prompt)
}

export function assistantMessagePromptTemplate(
    prompt: string | BasePromptTemplate
) {
    return messagePromptTemplate('assistant', prompt)
}

export function userMessagePromptTemplate(prompt: string | BasePromptTemplate) {
    return messagePromptTemplate('user', prompt)
}

export function chatPromptTemplate(
    message: (
        | BaseMessagePromptTemplate
        | BaseMessagesPromptTemplate
        | [MessageRole, string | BasePromptTemplate]
        | (string | BasePromptTemplate)[]
    )[]
): BaseMessagesPromptTemplate {
    const templates = message.map((item) => {
        if (Array.isArray(item)) {
            return messagePromptTemplate(
                MessageRoleSchema.parse(item[0]),
                item[1]
            )
        }
        return item
    })

    const inputVariables = [
        ...new Set(
            templates
                .filter((v) => v !== undefined)
                .map((prompt) => prompt.inputVariables)
                .flat()
        )
    ]

    return {
        inputVariables,
        template: `chatPromptTemplate`,
        async format(values) {
            const first = templates[0]

            if (first === undefined) {
                return []
            }

            let result: BaseMessage[] = await first.formatMessages(values)

            for (const prompt of templates.slice(1)) {
                const messages = await prompt.formatMessages(values)
                result = result.concat(messages)
            }

            return result
        },
        async formatMessages(values) {
            return this.format(values)
        },
        partial(values) {
            return paritalPromptTemplate(this, values)
        },
        _type: 'base_messages_prompt_template'
    }
}
