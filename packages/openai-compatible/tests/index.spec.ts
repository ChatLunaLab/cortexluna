import { expect } from 'chai'
import { openaiCompatible } from '../src/provider'
import {
    bindPromptTemplate,
    bindPromptTemplateToObject,
    generatateObject,
    generatateText,
    promptTemplate,
    tool
} from 'cortexluna'
import { z, ZodSchema } from 'zod'

describe('Chat', () => {
    describe('test chat', () => {
        it('should chat successful', async function () {
            this.timeout(100000)
            return new Promise(async (resolve, reject) => {
                const { text, usage, finishReason } = await generatateText({
                    model: openaiCompatible('gemini-2.0-flash'),
                    prompt: 'Talk a joke about programming'
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

        it('should chat with object result', async function () {
            this.timeout(100000)
            return new Promise(async (resolve, reject) => {
                const objectSchema = z.object({
                    keywords: z.array(z.string())
                })

                const prompt = promptTemplate(
                    'Extract keywords from this text: "{text}"'
                )

                const chain =
                    bindPromptTemplateToObject<z.infer<typeof objectSchema>>(
                        prompt
                    )

                const { object, usage, finishReason } = await chain({
                    model: openaiCompatible('gpt-4o-mini'),
                    input: 'The quick brown fox jumps over the lazy dog',
                    schema: objectSchema
                })
                console.log(object, usage, finishReason)
                resolve()
            })
        })
    })
})
