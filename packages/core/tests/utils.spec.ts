import { expect } from 'chai'
import {
    DelayedPromise,
    createAsyncIterableStream,
    createRetry,
    createConcurrencyLimiter,
    safeParseJSON,
    transformMessageRemoveSystem
} from '../src/utils'
import { z } from 'zod'
import { BaseMessage } from '../src/messages/messages'

describe('Utils', () => {
    describe('DelayedPromise', () => {
        it('should resolve successfully', async () => {
            const delayedPromise = new DelayedPromise<string>()

            setTimeout(() => {
                delayedPromise.resolve('test')
            }, 10)

            const result = await delayedPromise.promise
            expect(result).to.equal('test')
        })

        it('should reject with error', async () => {
            const delayedPromise = new DelayedPromise<string>()
            const error = new Error('test error')

            setTimeout(() => {
                delayedPromise.reject(error)
            }, 10)

            try {
                await delayedPromise.promise
                expect.fail('Promise should have rejected')
            } catch (e) {
                expect(e).to.equal(error)
            }
        })
    })

    describe('AsyncIterableStream', () => {
        it('should transform ReadableStream to AsyncIterable', async () => {
            const data = ['test1', 'test2', 'test3']
            const stream = new ReadableStream<string>({
                start(controller) {
                    data.forEach((item) => controller.enqueue(item))
                    controller.close()
                }
            })

            const iterableStream = createAsyncIterableStream(stream)
            const results: string[] = []

            for await (const item of iterableStream) {
                results.push(item)
            }

            expect(results).to.deep.equal(data)
        })

        it('should transform TransformStream to AsyncIterable', async () => {
            const transform = new TransformStream<string, string>({
                transform(chunk, controller) {
                    controller.enqueue(chunk.toUpperCase())
                }
            })

            const writer = transform.writable.getWriter()
            writer.write('test1')
            writer.write('test2')
            writer.close()

            const iterableStream = createAsyncIterableStream(transform)
            const results: string[] = []

            for await (const item of iterableStream) {
                results.push(item)
            }

            expect(results).to.deep.equal(['TEST1', 'TEST2'])
        })
    })

    describe('p-retry', () => {
        it('should retry failed operations', async () => {
            let attempts = 0
            const fn = async () => {
                attempts++
                if (attempts < 3) {
                    throw new Error('Test error')
                }
                return 'success'
            }

            const result = await createRetry(fn, {
                retries: 4,
                retryTimeout: 0
            })()
            expect(result).to.equal('success')
            expect(attempts).to.equal(3)
        })

        it('should respect maxTimeout', async () => {
            const fn = async () => {
                await new Promise((resolve) => setTimeout(resolve, 30))
                return 'success'
            }
            const retry = createRetry(fn, { maxTimeout: 20, retryTimeout: 0 })

            try {
                await retry()
                expect.fail('Should have thrown timeout error')
            } catch (error) {
                expect(error.message).to.equal('Operation timed out after 20ms')
            }
        })
    })

    describe('ConcurrencyLimiter', () => {
        it('should limit concurrent operations', async () => {
            const limiter = createConcurrencyLimiter(2)
            const delays = [100, 50, 150]
            const results: number[] = []

            const tasks = delays.map(
                (delay) => () =>
                    new Promise<number>((resolve) => {
                        setTimeout(() => {
                            results.push(delay)
                            resolve(delay)
                        }, delay)
                    })
            )

            await Promise.all(tasks.map((task) => limiter.add(task)))
            expect(results).to.deep.equal([50, 100, 150])
        })

        it('should track queue size and pending tasks', async () => {
            const limiter = createConcurrencyLimiter(1)
            const task = () => new Promise((resolve) => setTimeout(resolve, 50))

            limiter.add(task)
            limiter.add(task)

            expect(limiter.pending).to.equal(1)
            expect(limiter.size).to.equal(1)

            await limiter.onIdle()
            expect(limiter.pending).to.equal(0)
            expect(limiter.size).to.equal(0)
        })
    })

    describe('SafeParseJSON', () => {
        it('should parse valid JSON without schema', () => {
            const json = '{"name":"test","value":123}'
            const result = safeParseJSON({ text: json })

            expect(result.success).to.be.true
            if (result.success) {
                expect(result.data).to.deep.equal({ name: 'test', value: 123 })
            }
        })

        it('should validate JSON with schema', () => {
            const schema = z.object({
                name: z.string(),
                value: z.number()
            })
            const json = '{"name":"test","value":123}'
            const result = safeParseJSON({ text: json, schema })

            expect(result.success).to.be.true
            if (result.success) {
                expect(result.data).to.deep.equal({ name: 'test', value: 123 })
            }
        })

        it('should handle invalid JSON', () => {
            const result = safeParseJSON({ text: 'invalid json' })
            expect(result.success).to.be.false
            if (!result.success) {
                expect(result.error).to.be.instanceOf(Error)
            }
        })

        it('should handle schema validation failures', () => {
            const schema = z.object({
                name: z.string(),
                value: z.number()
            })
            const json = '{"name":123,"value":"invalid"}'
            const result = safeParseJSON({ text: json, schema })

            expect(result.success).to.be.false
            if (!result.success) {
                expect(result.error).to.be.instanceOf(Error)
            }
        })
    })

    describe('TransformMessageRemoveSystem', () => {
        it('should handle empty message array', () => {
            const messages: any[] = []
            const result = transformMessageRemoveSystem(messages)
            expect(result).to.deep.equal([])
        })

        it('should transform system messages', () => {
            const messages: BaseMessage[] = [
                { role: 'system', content: 'system instruction' }
            ]
            const result = transformMessageRemoveSystem(messages)

            expect(result).to.have.lengthOf(3)
            expect(result[0]).to.deep.equal({
                role: 'user',
                content: 'system instruction'
            })
            expect(result[1]).to.deep.equal({
                role: 'assistant',
                content: 'Okay, what do I need to do?'
            })
            expect(result[2]).to.deep.equal({
                role: 'user',
                content:
                    'Continue what I said to you last user message. Follow these instructions.'
            })
        })

        it('should handle consecutive user messages', () => {
            const messages: BaseMessage[] = [
                { role: 'user', content: 'message1' },
                { role: 'user', content: 'message2' }
            ]
            const result = transformMessageRemoveSystem(messages)

            expect(result).to.have.lengthOf(3)
            expect(result[1]).to.deep.equal({
                role: 'assistant',
                content: 'Okay, what do I need to do?'
            })
        })

        it('should handle consecutive assistant messages', () => {
            const messages: BaseMessage[] = [
                { role: 'assistant', content: 'response1' },
                { role: 'assistant', content: 'response2' }
            ]
            const result = transformMessageRemoveSystem(messages)

            expect(result).to.have.lengthOf(4)
            expect(result[1]).to.deep.equal({ role: 'user', content: 'noop' })
            expect(result[3]).to.deep.equal({
                role: 'user',
                content: 'Continue what I said to you last user message.'
            })
        })
    })
})
