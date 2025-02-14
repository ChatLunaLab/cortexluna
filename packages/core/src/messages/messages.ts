import { z } from 'zod'

import {
    Part,
    PartSchema,
    TextPartSchema,
    ToolCallingPartSchema,
    ToolResultPartSchema
} from './part.ts'

export interface BaseMessage {
    role: string
    content: string | Part[]
    name?: string
    id?: string
    metadata?: MessageMetadata
}

export const BaseMessageSchema = z.object({
    role: z.union([
        z.literal('user'),
        z.literal('assistant'),
        z.literal('system'),
        z.literal('tool')
    ]),
    content: z.union([z.string(), z.array(PartSchema)]),
    name: z.string().optional(),
    id: z.string().optional(),
    metadata: z.record(z.unknown()).optional()
})

export interface BaseMessageChunk extends BaseMessage {
    chunk: true
}

/** @internal  */
export const BaseMessageChunkSchema = BaseMessageSchema.extend({
    chunk: z.literal(true)
})

export interface MessageMetadata {
    [key: string]: unknown
}

export interface UserMessage extends BaseMessage {
    role: 'user'
}

export const UserMessageSchema = BaseMessageSchema.extend({
    role: z.literal('user')
})

export interface UserMessageChunk extends BaseMessageChunk {
    role: 'user'
}

export const UserMessageChunkSchema = BaseMessageChunkSchema.extend({
    role: z.literal('user')
})

export interface SystemMessage extends BaseMessage {
    role: 'system'
}

export const SystemMessageSchema = BaseMessageSchema.extend({
    role: z.literal('system')
})

export interface SystemMessageChunk extends BaseMessageChunk {
    role: 'system'
}

export const SystemMessageChunkSchema = BaseMessageChunkSchema.extend({
    role: z.literal('system')
})

export interface AssistantMessage extends BaseMessage {
    role: 'assistant'
}

export const AssistantMessageSchema = BaseMessageSchema.extend({
    role: z.literal('assistant'),
    content: z.union([
        z.string(),
        z.array(z.union([TextPartSchema, ToolCallingPartSchema]))
    ])
})

export interface ToolMessage extends BaseMessage {
    role: 'tool'
}

export const ToolMessageSchema = BaseMessageSchema.extend({
    role: z.literal('tool')
})

export interface ToolMessageChunk extends BaseMessageChunk {
    role: 'tool'
}

export const ToolMessageChunkSchema = BaseMessageChunkSchema.extend({
    role: z.literal('tool'),
    content: z.union([
        z.string(),
        z.array(z.union([TextPartSchema, ToolResultPartSchema]))
    ])
})

export function concatChunks(...chunk: BaseMessageChunk[]): BaseMessage {
    return chunk.reduce((acc, chunk) => {
        BaseMessageChunkSchema.parse(chunk)

        const newChunk: BaseMessageChunk = { ...acc }

        newChunk.content =
            typeof chunk.content === 'string'
                ? newChunk.content + chunk.content
                : _mergeLists(chunk.content, newChunk.content as Part[])

        // chechk metadata

        return newChunk
    })
}

export function createMessageChunk<
    T extends BaseMessageChunk = BaseMessageChunk
>(args: Omit<T, 'chunk'>): T {
    return {
        ...args,
        chunk: true
    } as T
}

export function _mergeDicts(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    left: Record<string, any>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    right: Record<string, any>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Record<string, any> {
    const merged = { ...left }
    for (const [key, value] of Object.entries(right)) {
        if (merged[key] == null) {
            merged[key] = value
        } else if (value == null) {
            continue
        } else if (
            typeof merged[key] !== typeof value ||
            Array.isArray(merged[key]) !== Array.isArray(value)
        ) {
            throw new Error(
                `field[${key}] already exists in the message chunk, but with a different type.`
            )
        } else if (typeof merged[key] === 'string') {
            if (key === 'type') {
                // Do not merge 'type' fields
                continue
            }
            merged[key] += value
        } else if (
            typeof merged[key] === 'object' &&
            !Array.isArray(merged[key])
        ) {
            merged[key] = _mergeDicts(merged[key], value)
        } else if (Array.isArray(merged[key])) {
            merged[key] = _mergeLists(merged[key], value)
        } else if (merged[key] === value) {
            continue
        } else {
            console.warn(
                `field[${key}] already exists in this message chunk and value has unsupported type.`
            )
        }
    }
    return merged
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function _mergeLists(left?: any[], right?: any[]) {
    if (left === undefined && right === undefined) {
        return undefined
    } else if (left === undefined || right === undefined) {
        return left || right
    } else {
        const merged = [...left]
        for (const item of right) {
            if (
                typeof item === 'object' &&
                'index' in item &&
                typeof item.index === 'number'
            ) {
                const toMerge = merged.findIndex(
                    (leftItem) => leftItem.index === item.index
                )
                if (toMerge !== -1) {
                    merged[toMerge] = _mergeDicts(merged[toMerge], item)
                } else {
                    merged.push(item)
                }
            } else if (
                typeof item === 'object' &&
                'text' in item &&
                item.text === ''
            ) {
                // No-op - skip empty text blocks
                continue
            } else {
                merged.push(item)
            }
        }
        return merged
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function _mergeObj<T = any>(
    left: T | undefined,
    right: T | undefined
): T {
    if (!left && !right) {
        throw new Error('Cannot merge two undefined objects.')
    }
    if (!left || !right) {
        return left || (right as T)
    } else if (typeof left !== typeof right) {
        throw new Error(
            `Cannot merge objects of different types.\nLeft ${typeof left}\nRight ${typeof right}`
        )
    } else if (typeof left === 'string' && typeof right === 'string') {
        return (left + right) as T
    } else if (Array.isArray(left) && Array.isArray(right)) {
        return _mergeLists(left, right) as T
    } else if (typeof left === 'object' && typeof right === 'object') {
        return _mergeDicts(left, right) as T
    } else if (left === right) {
        return left
    } else {
        throw new Error(
            `Can not merge objects of different types.\nLeft ${left}\nRight ${right}`
        )
    }
}
