import { ZodSchema } from 'zod'
import { ParseResult, safeParseJSON } from './safe-parse-json.ts'
import {
    EventSourceMessage,
    EventSourceParserStream
} from 'eventsource-parser/stream'

export const createEventSourceResponseHandler =
    <T>(chunkSchema: ZodSchema<T>) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (response: ReadableStream<any>) => {
        return response
            .pipeThrough(new TextDecoderStream())
            .pipeThrough(new EventSourceParserStream())
            .pipeThrough(
                new TransformStream<EventSourceMessage, ParseResult<T>>({
                    transform({ data }, controller) {
                        // ignore the 'DONE' event that e.g. OpenAI sends:
                        if (data === '[DONE]') {
                            return
                        }

                        controller.enqueue(
                            safeParseJSON({
                                text: data,
                                schema: chunkSchema
                            })
                        )
                    }
                })
            )
    }
