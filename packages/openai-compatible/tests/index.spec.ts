import { expect } from 'chai'
import { openaiCompatible } from '../src/provider'
import {
    bindPromptTemplate,
    generatateText,
    promptTemplate,
    tool
} from 'cortexluna'
import { z } from 'zod'

describe('Chat', () => {
    describe('test chat', () => {
        it('should chat successful', async function () {
            this.timeout(100000)
            return new Promise(async (resolve, reject) => {
                const { text, usage, finishReason } = await generatateText({
                    model: openaiCompatible('gemini-2.0-flash'),
                    prompt: '讲一个程序员笑话'
                })

                console.log(text, usage, finishReason)

                expect(text).to.be.a('string')

                resolve()
            })
        })

        it('should chat successful with prompt', async function () {
            this.timeout(100000)
            return new Promise(async (resolve, reject) => {
                const prompt = promptTemplate(
                    'Now is {time}.  I will ask you a question: {question}. Please answer it.'
                )

                const chain = bindPromptTemplate(prompt, generatateText)
                const { text, usage, finishReason } = await chain({
                    model: openaiCompatible('gemini-2.0-flash'),
                    input: {
                        time: new Date().toLocaleString(),
                        question: 'what time is it'
                    }
                })

                console.log(text, usage, finishReason)

                expect(text).to.be.a('string')

                resolve()
            })
        })

        it('should chat with tool', async function () {
            this.timeout(100000)
            return new Promise(async (resolve, reject) => {
                const { text, usage, finishReason, steps } =
                    await generatateText({
                        model: openaiCompatible('gemini-2.0-flash'),
                        prompt: 'Query the current weather in Beijing, China',
                        tools: [
                            tool(
                                async (input) => {
                                    return {
                                        location: input.location,
                                        temperature: '10',
                                        unit: 'celsius'
                                    }
                                },
                                {
                                    name: 'get_current_weather',
                                    description:
                                        'Get the current weather in a given location',
                                    schema: z.object({
                                        location: z.string()
                                    })
                                }
                            )
                        ]
                    })

                console.log(text, usage, finishReason, steps)

                resolve()
            })
        })
    })
})
