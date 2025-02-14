import { expect } from 'chai'
import {
    createPromptTemplate,
    paritalPromptTemplate,
    createMessagePromptTemplate,
    createSystemMessagePromptTemplate,
    createAssistantMessagePromptTemplate,
    createUserMessagePromptTemplate,
    createChatPromptTemplate,
    createMessagesPlaceholderPromptTemplate,
    BaseMessage
} from '../src/index.ts'

describe('Prompts', () => {
    describe('createPromptTemplate', () => {
        it('should create a prompt template with the given template string', async () => {
            const template = 'Hello, {name}!'
            const promptTemplate = createPromptTemplate(template)
            expect(promptTemplate.template).to.equal(template)
        })

        it('should format the prompt template with the given values', async () => {
            const template = 'Hello, {name}!'
            const promptTemplate = createPromptTemplate(template)
            const values = { name: 'World' }
            const formattedPrompt = await promptTemplate.format(values)
            expect(formattedPrompt).to.equal('Hello, World!')
        })

        it('should extract input variables from the template', () => {
            const template = 'Hello, {name}! My age is {age}.'
            const promptTemplate = createPromptTemplate(template)
            expect(promptTemplate.inputVariables).to.deep.equal(['name', 'age'])
        })
    })

    describe('paritalPromptTemplate', () => {
        it('should create a partial prompt template with the given values', async () => {
            const template = 'Hello, {name}! My age is {age}.'
            const promptTemplate = createPromptTemplate(template)
            const partialValues = { age: 30 }
            const partialPromptTemplate = paritalPromptTemplate(
                promptTemplate,
                partialValues
            )
            const values = { name: 'World' }
            const formattedPrompt = await partialPromptTemplate.format(values)
            expect(formattedPrompt).to.equal('Hello, World! My age is 30.')
        })

        it('should merge partial values with the given values', async () => {
            const template = 'Hello, {name}! My age is {age}.'
            const promptTemplate = createPromptTemplate(template)
            const partialValues = { age: 30 }
            const partialPromptTemplate = paritalPromptTemplate(
                promptTemplate,
                partialValues
            )
            const partialValues2 = { name: 'World' }
            const partialPromptTemplate2 = paritalPromptTemplate(
                partialPromptTemplate,
                partialValues2
            )
            const values = {}
            const formattedPrompt = await partialPromptTemplate2.format(values)
            expect(formattedPrompt).to.equal('Hello, World! My age is 30.')
        })
    })

    describe('createMessagePromptTemplate', () => {
        it('should create a message prompt template with the given role and prompt', async () => {
            const role = 'user'
            const prompt = 'Hello, {name}!'
            const messagePromptTemplate = createMessagePromptTemplate(
                role,
                prompt
            )
            const values = { name: 'World' }
            const formattedMessage = await messagePromptTemplate.format(values)
            expect(formattedMessage.role).to.equal(role)
            expect(formattedMessage.content).to.equal('Hello, World!')
        })
    })

    describe('createSystemMessagePromptTemplate', () => {
        it('should create a system message prompt template with the given prompt', async () => {
            const prompt = 'Hello, {name}!'
            const messagePromptTemplate =
                createSystemMessagePromptTemplate(prompt)
            const values = { name: 'World' }
            const formattedMessage = await messagePromptTemplate.format(values)
            expect(formattedMessage.role).to.equal('system')
            expect(formattedMessage.content).to.equal('Hello, World!')
        })
    })

    describe('createAssistantMessagePromptTemplate', () => {
        it('should create an assistant message prompt template with the given prompt', async () => {
            const prompt = 'Hello, {name}!'
            const messagePromptTemplate =
                createAssistantMessagePromptTemplate(prompt)
            const values = { name: 'World' }
            const formattedMessage = await messagePromptTemplate.format(values)
            expect(formattedMessage.role).to.equal('assistant')
            expect(formattedMessage.content).to.equal('Hello, World!')
        })
    })

    describe('createUserMessagePromptTemplate', () => {
        it('should create a user message prompt template with the given prompt', async () => {
            const prompt = 'Hello, {name}!'
            const messagePromptTemplate =
                createUserMessagePromptTemplate(prompt)
            const values = { name: 'World' }
            const formattedMessage = await messagePromptTemplate.format(values)
            expect(formattedMessage.role).to.equal('user')
            expect(formattedMessage.content).to.equal('Hello, World!')
        })
    })

    describe('createChatPromptTemplate', () => {
        it('should create a chat prompt template with the given messages', async () => {
            const messages = [
                ['user', 'Hello, {name}!'],
                ['assistant', 'Hi, {name}!']
            ]
            const chatPromptTemplate = createChatPromptTemplate(messages)
            const values = { name: 'World' }
            const formattedMessages = await chatPromptTemplate.format(values)
            expect(formattedMessages.length).to.equal(2)
            expect(formattedMessages[0].role).to.equal('user')
            expect(formattedMessages[0].content).to.equal('Hello, World!')
            expect(formattedMessages[1].role).to.equal('assistant')
            expect(formattedMessages[1].content).to.equal('Hi, World!')
        })

        it('should create a chat prompt template with the given message prompt templates', async () => {
            const messages = [
                createMessagePromptTemplate('user', 'Hello, {name}!'),
                createMessagePromptTemplate('assistant', 'Hi, {name}!')
            ]
            const chatPromptTemplate = createChatPromptTemplate(messages)
            const values = { name: 'World' }
            const formattedMessages = await chatPromptTemplate.format(values)
            expect(formattedMessages.length).to.equal(2)
            expect(formattedMessages[0].role).to.equal('user')
            expect(formattedMessages[0].content).to.equal('Hello, World!')
            expect(formattedMessages[1].role).to.equal('assistant')
            expect(formattedMessages[1].content).to.equal('Hi, World!')
        })

        it('should create a chat prompt template with a messages placeholder', async () => {
            const messages = [
                ['user', 'Hello, {name}!'],
                ['assistant', 'Hi, {name}!'],
                createMessagesPlaceholderPromptTemplate('history')
            ]
            const chatPromptTemplate = createChatPromptTemplate(messages)
            const values = {
                name: 'World',
                history: [{ role: 'user', content: 'How are you?' }]
            }
            const formattedMessages = await chatPromptTemplate.format(values)
            expect(formattedMessages.length).to.equal(3)
            expect(formattedMessages[0].role).to.equal('user')
            expect(formattedMessages[0].content).to.equal('Hello, World!')
            expect(formattedMessages[1].role).to.equal('assistant')
            expect(formattedMessages[1].content).to.equal('Hi, World!')
            expect(formattedMessages[2].role).to.equal('user')
            expect(formattedMessages[2].content).to.equal('How are you?')
        })
    })

    describe('createMessagesPlaceholderPromptTemplate', () => {
        it('should create a messages placeholder prompt template with the given variable name', async () => {
            const variableName = 'messages'
            const messagesPlaceholderPromptTemplate =
                createMessagesPlaceholderPromptTemplate(variableName)
            expect(
                messagesPlaceholderPromptTemplate.inputVariables
            ).to.deep.equal([variableName])
        })

        it('should format the messages placeholder prompt template with the given values', async () => {
            const variableName = 'messages'
            const messagesPlaceholderPromptTemplate =
                createMessagesPlaceholderPromptTemplate(variableName)
            const values = {
                messages: [{ role: 'user', content: 'Hello, World!' }]
            }
            const formattedMessages =
                await messagesPlaceholderPromptTemplate.format(values)
            expect(formattedMessages.length).to.equal(1)
            expect(formattedMessages[0].role).to.equal('user')
            expect(formattedMessages[0].content).to.equal('Hello, World!')
        })

        it('should throw an error if the variable name is not provided', async () => {
            const variableName = 'messages'
            const messagesPlaceholderPromptTemplate =
                createMessagesPlaceholderPromptTemplate(variableName)
            const values = {}
            try {
                await messagesPlaceholderPromptTemplate.format(values)
            } catch (e: any) {
                expect(e.message).to.equal(
                    `The MessagesPlaceholderPromptTemplate requires a value for ${variableName}.`
                )
            }
        })

        it('should return an empty array if the variable name is not provided and optional is true', async () => {
            const variableName = 'messages'
            const messagesPlaceholderPromptTemplate =
                createMessagesPlaceholderPromptTemplate(variableName, true)
            const values = {}
            const formattedMessages =
                await messagesPlaceholderPromptTemplate.format(values)
            expect(formattedMessages.length).to.equal(0)
        })
    })
})
