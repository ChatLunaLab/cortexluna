import { z } from 'zod'
import { DataContent, DataContentSchema } from './data-content.ts'

export interface TextPart {
    type: 'text'
    value: string
}

/** @internal  */
export const TextPartSchema = z.object({
    type: z.literal('text'),
    value: z.string()
})

export interface ImagePart {
    type: 'image'
    image: DataContent | URL
    mine_type?: string
}

/** @internal  */
export const ImagePartSchema = z.object({
    type: z.literal('image'),
    image: DataContentSchema,
    mine_type: z.string().optional()
})

export interface AudioPart {
    type: 'audio'
    audio: DataContent | URL
}

/** @internal  */
export const AudioPartSchema = z.object({
    type: z.literal('audio'),
    audio: DataContentSchema
})

export interface FilePart {
    type: 'file'
    file: DataContent | URL
    mine_type?: string
}

/** @internal  */
export const FilePartSchema = z.object({
    type: z.literal('file'),
    file: DataContentSchema,
    mine_type: z.string().optional()
})

export interface ToolCallingPart {
    type: 'tool_calling'
    toolCallId: string
    toolName: string
    args: unknown
}

export const ToolCallingPartSchema = z.object({
    type: z.literal('tool_calling'),
    toolCallId: z.string(),
    toolName: z.string()
})

/**
Tool result content part of a prompt. It contains the result of the tool call with the matching ID.
 */
export interface ToolResultPart {
    type: 'tool-result'

    toolCallId: string

    toolName: string

    result: unknown

    isError?: boolean
}

/** @internal  */
export const ToolResultPartSchema = z.object({
    type: z.literal('tool-result'),
    toolCallId: z.string(),
    toolName: z.string(),
    result: z.unknown(),
    isError: z.boolean().optional()
})

export type Part =
    | TextPart
    | ImagePart
    | AudioPart
    | FilePart
    | ToolCallingPart
    | ToolResultPart

/** @internal */
export const PartSchema = z.union([
    TextPartSchema,
    ImagePartSchema,
    AudioPartSchema,
    FilePartSchema,
    ToolCallingPartSchema,
    ToolResultPartSchema
])
