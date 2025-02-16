import { expect } from 'chai'
import { openaiCompatible } from '../src/provider'
import { generatateText } from 'cortexluna'

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
    })
})
