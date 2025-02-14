import { expect } from 'chai'
import { dataContentToBase64, DataContent } from '../src/messages/data-content'
import {
    BaseMessage,
    BaseMessageChunk,
    concatChunks,
    createMessageChunk,
    _mergeDicts,
    _mergeLists,
    _mergeObj,
    AssistantMessage,
    SystemMessage,
    ToolMessage,
    UserMessage
} from '../src/messages/messages'
import {
    AudioPart,
    FilePart,
    ImagePart,
    Part,
    TextPart,
    ToolCallingPart,
    ToolResultPart
} from '../src/messages/part'

describe('data-content', () => {
    it('should convert string to base64', () => {
        const data: DataContent = 'test'
        expect(dataContentToBase64(data)).to.equal('test')
    })

    it('should convert Uint8Array to base64', () => {
        const data: DataContent = new Uint8Array([116, 101, 115, 116])
        expect(dataContentToBase64(data)).to.equal('dGVzdA==')
    })

    it('should convert ArrayBuffer to base64', () => {
        const data: DataContent = new ArrayBuffer(4)
        const uint8View = new Uint8Array(data)
        uint8View[0] = 116
        uint8View[1] = 101
        uint8View[2] = 115
        uint8View[3] = 116
        expect(dataContentToBase64(data)).to.equal('dGVzdA==')
    })

    it('should convert Buffer to base64', () => {
        const data: DataContent = Buffer.from('test')
        expect(dataContentToBase64(data)).to.equal('dGVzdA==')
    })
})

describe('messages', () => {
    describe('concatChunks', () => {
        it('should concat chunks with string content', () => {
            const chunk1 = createMessageChunk<BaseMessageChunk>({
                role: 'user',
                content: 'hello'
            })
            const chunk2 = createMessageChunk<BaseMessageChunk>({
                role: 'user',
                content: ' world'
            })
            const result = concatChunks(chunk1, chunk2)
            expect(result.content).to.equal('hello world')
        })

        it('should concat chunks with array content', () => {
            const chunk1 = createMessageChunk<BaseMessageChunk>({
                role: 'assistant',
                content: [{ type: 'text', text: 'hello' }]
            })
            const chunk2 = createMessageChunk<BaseMessageChunk>({
                role: 'assistant',
                content: [{ type: 'text', text: ' world' }]
            })
            const result = concatChunks(chunk1, chunk2)
            console.log(result)
            expect(result.content).to.deep.equal([
                { type: 'text', text: 'hello world' }
            ])
        })

        it('should merge metadata', () => {
            const chunk1 = createMessageChunk<BaseMessageChunk>({
                role: 'user',
                content: 'hello',
                metadata: { a: 1 }
            })
            const chunk2 = createMessageChunk<BaseMessageChunk>({
                role: 'user',
                content: ' world',
                metadata: { b: 2 }
            })
            const result = concatChunks(chunk1, chunk2)
            expect(result.metadata).to.deep.equal({ a: 1, b: 2 })
        })

        it('should throw error when metadata has different types', () => {
            const chunk1 = createMessageChunk<BaseMessageChunk>({
                role: 'user',
                content: 'hello',
                metadata: { a: 1 }
            })
            const chunk2 = createMessageChunk<BaseMessageChunk>({
                role: 'user',
                content: ' world',
                metadata: { a: '2' }
            })
            expect(() => concatChunks(chunk1, chunk2)).to.throw()
        })
    })

    describe('_mergeDicts', () => {
        it('should merge two dictionaries', () => {
            const left = { a: 1 }
            const right = { b: 2 }
            expect(_mergeDicts(left, right)).to.deep.equal({ a: 1, b: 2 })
        })

        it('should merge two dictionaries with the same key', () => {
            const left = { a: 1 }
            const right = { a: 2 }
            expect(_mergeDicts(left, right) as any).to.deep.equal({ a: 1 })
        })

        it('should merge nested dictionaries', () => {
            const left = { a: { b: 1 } }
            const right = { a: { c: 2 } }
            expect(_mergeDicts(left, right)).to.deep.equal({ a: { b: 1, c: 2 } })
        })

        it('should throw error when nested dictionaries have different types', () => {
            const left = { a: { b: 1 } }
            const right = { a: 2 }
            expect(() => _mergeDicts(left, right)).to.throw()
        })
    })

    describe('_mergeLists', () => {
        it('should merge two lists', () => {
            const left = [1, 2]
            const right = [3, 4]
            expect(_mergeLists(left, right)).to.deep.equal([1, 2, 3, 4])
        })

        it('should merge two lists with objects and index', () => {
            const left = [{ index: 1, text: 'hello' }]
            const right = [{ index: 2, text: 'world' }]
            expect(_mergeLists(left, right)).to.deep.equal([
                { index: 1, text: 'hello' },
                { index: 2, text: 'world' }
            ])
        })

        it('should merge two lists with objects and same index', () => {
            const left = [{ index: 1, text: 'hello' }]
            const right = [{ index: 1, text: 'world' }]
            expect(_mergeLists(left, right)).to.deep.equal([
                { index: 1, text: 'helloworld' }
            ])
        })
    })

    describe('_mergeObj', () => {
        it('should merge two strings', () => {
            const left = 'hello'
            const right = ' world'
            expect(_mergeObj(left, right)).to.equal('hello world')
        })

        it('should merge two lists', () => {
            const left = [1, 2]
            const right = [3, 4]
            expect(_mergeObj(left, right)).to.deep.equal([1, 2, 3, 4])
        })

        it('should merge two dictionaries', () => {
            const left = { a: 1 }
            const right = { b: 2 }
            expect(_mergeObj(left, right)).to.deep.equal({ a: 1, b: 2 })
        })

        it('should return left if right is undefined', () => {
            const left = { a: 1 }
            const right = undefined
            expect(_mergeObj(left, right)).to.deep.equal({ a: 1 })
        })

        it('should return right if left is undefined', () => {
            const left = undefined
            const right = { a: 1 }
            expect(_mergeObj(left, right)).to.deep.equal({ a: 1 })
        })

        it('should throw error if both are undefined', () => {
            const left = undefined
            const right = undefined
            expect(() => _mergeObj(left, right)).to.throw()
        })
    })
})

describe('part', () => {
    it('TextPartSchema should have type text and text', () => {
        const textPart: TextPart = {
            type: 'text',
            text: 'hello'
        }
        expect(textPart.type).to.equal('text')
        expect(textPart.text).to.equal('hello')
    })

    it('ImagePartSchema should have type image and image', () => {
        const imagePart: ImagePart = {
            type: 'image',
            image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w+bAwP/U8JoVAQYAIfwH6jWJt2UAAAAASUVORK5CYII='
        }
        expect(imagePart.type).to.equal('image')
        expect(imagePart.image).to.equal(
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w+bAwP/U8JoVAQYAIfwH6jWJt2UAAAAASUVORK5CYII='
        )
    })

    it('AudioPartSchema should have type audio and audio', () => {
        const audioPart: AudioPart = {
            type: 'audio',
            audio: 'data:audio/ogg;base64,T2dnUw=='
        }
        expect(audioPart.type).to.equal('audio')
        expect(audioPart.audio).to.equal('data:audio/ogg;base64,T2dnUw==')
    })

    it('FilePartSchema should have type file and file', () => {
        const filePart: FilePart = {
            type: 'file',
            file: 'data:application/pdf;base64,JVBERi0xLjUKJcfsxw=='
        }
        expect(filePart.type).to.equal('file')
        expect(filePart.file).to.equal('data:application/pdf;base64,JVBERi0xLjUKJcfsxw==')
    })

    it('ToolCallingPartSchema should have type tool_calling, toolCallId, toolName and args', () => {
        const toolCallingPart: ToolCallingPart = {
            type: 'tool_calling',
            toolCallId: '123',
            toolName: 'test',
            args: { a: 1 }
        }
        expect(toolCallingPart.type).to.equal('tool_calling')
        expect(toolCallingPart.toolCallId).to.equal('123')
        expect(toolCallingPart.toolName).to.equal('test')
        expect(toolCallingPart.args).to.deep.equal({ a: 1 })
    })

    it('ToolResultPartSchema should have type tool-result, toolCallId, toolName and result', () => {
        const toolResultPart: ToolResultPart = {
            type: 'tool-result',
            toolCallId: '123',
            toolName: 'test',
            result: { a: 1 }
        }
        expect(toolResultPart.type).to.equal('tool-result')
        expect(toolResultPart.toolCallId).to.equal('123')
        expect(toolResultPart.toolName).to.equal('test')
        expect(toolResultPart.result).to.deep.equal({ a: 1 })
    })
})
