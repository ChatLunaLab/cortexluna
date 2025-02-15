import { z } from 'zod'

import {
    MessageContent,
    MessageContentSchema,
    Part,
    TextPartSchema,
    ToolCallPartSchema,
    ToolResultPartSchema
} from './part.ts'

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool'

export type InferMessageTypeByRole<T extends MessageRole> = T extends 'user'
    ? UserMessage
    : T extends 'assistant'
      ? AssistantMessage
      : T extends 'system'
        ? SystemMessage
        : T extends 'tool'
          ? ToolMessage
          : never

export const MessageRoleSchema = z.union([
    z.literal('user'),
    z.literal('assistant'),
    z.literal('system'),
    z.literal('tool')
])

export interface BaseMessage {
    role: MessageRole
    content: MessageContent
    name?: string
    id?: string
    metadata?: MessageMetadata
}

export const BaseMessageSchema = z.object({
    role: MessageRoleSchema,
    content: MessageContentSchema,
    name: z.string().optional(),
    id: z.string().optional(),
    metadata: z.record(z.unknown()).optional()
})

export const BaseMessageLikeArraySchema: z.ZodType<BaseMessage[]> =
    z.array(BaseMessageSchema)

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
        z.array(z.union([TextPartSchema, ToolCallPartSchema]))
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
export function concatChunks(...chunks: BaseMessageChunk[]): BaseMessageChunk {
    // 预处理所有chunk的content为Part数组
    const allParts: Part[] = []
    let finalName: string | undefined
    const role = chunks[0].role
    let id: string | undefined
    let concatToString = true
    const mergedMetadata: Record<string, unknown> = {}

    for (const chunk of chunks) {
        const parsedChunk = BaseMessageChunkSchema.parse(chunk)

        // 处理content部分
        const content = parsedChunk.content
        if (typeof content === 'string') {
            allParts.push({ type: 'text', text: content })
        } else {
            allParts.push(...content)
            concatToString = false
        }

        // 处理name（最后出现的非空name生效）
        if (parsedChunk.name !== undefined) {
            finalName = parsedChunk.name
        }

        // 合并metadata
        if (parsedChunk.metadata) {
            Object.assign(
                mergedMetadata,
                _mergeDicts(mergedMetadata, parsedChunk.metadata)
            )
        }

        // 处理role（最后出现的非空role生效）
        if (parsedChunk.role !== role) {
            throw new Error(
                `Cannot merge messages with different roles: ${role} and ${parsedChunk.role}`
            )
        }

        // id
        if (parsedChunk.id) {
            id = parsedChunk.id
        }
    }

    // 优化合并算法：线性遍历 + 尾合并策略
    const mergedContent: Part[] = []
    let lastPart: Part | null = null

    for (const currentPart of allParts) {
        if (lastPart && canMerge(lastPart, currentPart)) {
            lastPart = mergeTwoParts(lastPart, currentPart)
            mergedContent[mergedContent.length - 1] = lastPart
        } else {
            mergedContent.push(currentPart)
            lastPart = currentPart
        }
    }

    return {
        content:
            mergedContent.length === 1 &&
            mergedContent[0].type === 'text' &&
            concatToString
                ? mergedContent[0].text
                : mergedContent,
        name: finalName,
        chunk: true,
        role,
        id,
        metadata: mergedMetadata
    }
}

// 合并判断逻辑
function canMerge(a: Part, b: Part): boolean {
    if (a.type !== b.type) return false

    if (a.type === 'text' && b.type === 'text') return true

    if (a.type === 'tool-result' && b.type === 'tool-result') {
        return a.toolCallId === b.toolCallId
    }

    return a.type === b.type
}

// 双元素合并逻辑
function mergeTwoParts(a: Part, b: Part): Part {
    if (a.type === 'text' && b.type === 'text') {
        return { ...a, text: a.text + b.text }
    }

    if (a.type === 'tool-result' && b.type === 'tool-result') {
        return {
            ...a,
            result: _mergeDicts(
                a.result as Record<string, unknown>,
                b.result as Record<string, unknown>
            ),
            isError: a.isError || b.isError
        }
    }

    if (a.type === 'tool-call' && b.type === 'tool-call') {
        return {
            ...a,
            args: _mergeDicts(
                a.args as Record<string, unknown>,
                b.args as Record<string, unknown>
            )
        }
    }

    if (a.type !== b.type) {
        throw new Error(`Cannot merge parts of types ${a.type} and ${b.type}`)
    }

    return _mergeDicts(a, b) as Part
}
export function createMessageChunk<
    T extends BaseMessageChunk = BaseMessageChunk
>(args: Omit<T, 'chunk'>): T {
    return {
        ...args,
        chunk: true
    } as T
}

// eslint-disable-next-line @typescript-eslint/naming-convention
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/naming-convention
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/naming-convention
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
