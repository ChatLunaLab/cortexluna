import { z } from 'zod'
import { DataContent, DataContentSchema } from './data-content.ts'

export interface TextPart {
    type: 'text'
    text: string
}

/** @internal  */
export const TextPartSchema: z.ZodType<TextPart> = z.object({
    type: z.literal('text'),
    text: z.string()
})

export interface ThinkPart {
    type: 'think'
    think: string
}

/** @internal  */
export const ThinkPartSchema: z.ZodType<ThinkPart> = z.object({
    type: z.literal('think'),
    think: z.string()
})

export interface ImagePart {
    type: 'image'
    image: DataContent | URL
    mineType?: string
}

/** @internal  */
export const ImagePartSchema: z.ZodType<ImagePart> = z.object({
    type: z.literal('image'),
    image: DataContentSchema,
    mineType: z.string().optional()
})

export interface AudioPart {
    type: 'audio'
    audio: DataContent | URL
}

/** @internal  */
export const AudioPartSchema: z.ZodType<AudioPart> = z.object({
    type: z.literal('audio'),
    audio: DataContentSchema
})

export interface FilePart {
    type: 'file'
    file: DataContent | URL
    mineType?: string
}

/** @internal  */
export const FilePartSchema: z.ZodType<FilePart> = z.object({
    type: z.literal('file'),
    file: DataContentSchema,
    mineType: z.string().optional()
})

export interface ToolCallPart {
    type: 'tool-call'
    toolCallId?: string
    toolName: string
    args: unknown
}

export const ToolCallPartSchema: z.ZodType<ToolCallPart> = z.object({
    type: z.literal('tool-call'),
    toolCallId: z.string().optional(),
    toolName: z.string(),
    args: z.unknown()
}) as z.ZodType<ToolCallPart> // necessary bc args is optional on Zod type

/**
Tool result content part of a prompt. It contains the result of the tool call with the matching ID.
 */
export interface ToolResultPart {
    type: 'tool-result'

    toolCallId?: string

    toolName: string

    result: unknown

    arg?: unknown

    isError?: boolean
}

/** @internal  */
export const ToolResultPartSchema: z.ZodType<ToolResultPart> = z.object({
    type: z.literal('tool-result'),
    toolCallId: z.string(),
    toolName: z.string(),
    result: z.unknown(),
    isError: z.boolean().optional()
}) as z.ZodType<ToolResultPart> // necessary bc args is optional on Zod type

export type Part =
    | TextPart
    | ImagePart
    | AudioPart
    | FilePart
    | ToolCallPart
    | ToolResultPart
    | ThinkPart

export type MessageContent = string | Part[]

/** @internal */
export const PartSchema: z.ZodType<Part> = z.union([
    TextPartSchema,
    ImagePartSchema,
    AudioPartSchema,
    FilePartSchema,
    ToolCallPartSchema,
    ToolResultPartSchema
])

export const MessageContentSchema: z.ZodType<MessageContent> = z.union([
    z.string(),
    z.array(PartSchema)
])

export function getTextInMessageContent(content: MessageContent): string {
    if (typeof content === 'string') {
        return content
    }

    return content.reduce((acc, part) => {
        if (part.type === 'text') {
            return acc + part.text
        }
        return acc
    }, '')
}
