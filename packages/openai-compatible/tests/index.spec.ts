import { expect } from 'chai'
import { openaiCompatible } from '../src/provider'
import { generatateText, tool } from 'cortexluna'
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

        it('should chat with tool', async function () {
            this.timeout(100000)
            return new Promise(async (resolve, reject) => {
                const { text, usage, finishReason } = await generatateText({
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

                console.log(text, usage, finishReason)

                resolve()
            })
        })
    })
})
