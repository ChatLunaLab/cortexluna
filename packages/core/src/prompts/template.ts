// https://github.com/langchain-ai/langchainjs/blob/a0f1dc9a1c41c743f379f49b452ffc5dd2e750d5/langchain-core/src/prompts/template.ts#L37

import { MessageContent } from '../messages/index.ts'
import { InputValues } from './types.ts'

/**
 * Type that represents a node in a parsed format string. It can be either
 * a literal text or a variable name.
 */
export type ParsedTemplateNode =
    | { type: 'literal'; text: string }
    | { type: 'variable'; name: string }

export type ParsedFStringNode = ParsedTemplateNode

export const parseFString = (template: string): ParsedTemplateNode[] => {
    // Core logic replicated from internals of pythons built in Formatter class.
    // https://github.com/python/cpython/blob/135ec7cefbaffd516b77362ad2b2ad1025af462e/Objects/stringlib/unicode_format.h#L700-L706
    const chars = template.split('')
    const nodes: ParsedTemplateNode[] = []

    const nextBracket = (bracket: '}' | '{' | '{}', start: number) => {
        for (let i = start; i < chars.length; i += 1) {
            if (bracket.includes(chars[i])) {
                return i
            }
        }
        return -1
    }

    let i = 0
    while (i < chars.length) {
        if (chars[i] === '{' && i + 1 < chars.length && chars[i + 1] === '{') {
            nodes.push({ type: 'literal', text: '{' })
            i += 2
        } else if (
            chars[i] === '}' &&
            i + 1 < chars.length &&
            chars[i + 1] === '}'
        ) {
            nodes.push({ type: 'literal', text: '}' })
            i += 2
        } else if (chars[i] === '{') {
            const j = nextBracket('}', i)
            if (j < 0) {
                throw new Error("Unclosed '{' in template.")
            }

            nodes.push({
                type: 'variable',
                name: chars.slice(i + 1, j).join('')
            })
            i = j + 1
        } else if (chars[i] === '}') {
            throw new Error("Single '}' in template.")
        } else {
            const next = nextBracket('{}', i)
            const text = (
                next < 0 ? chars.slice(i) : chars.slice(i, next)
            ).join('')
            nodes.push({ type: 'literal', text })
            i = next < 0 ? chars.length : next
        }
    }
    return nodes
}

export const interpolateFString = (template: string, values: InputValues) => {
    return parseFString(template).reduce((res, node) => {
        if (node.type === 'variable') {
            if (node.name in values) {
                const stringValue =
                    typeof values[node.name] === 'string'
                        ? values[node.name]
                        : JSON.stringify(values[node.name])
                return res + stringValue
            }
            throw new Error(`(f-string) Missing value for input ${node.name}`)
        }

        return res + node.text
    }, '')
}

export const renderTemplate = (template: string, inputValues: InputValues) =>
    interpolateFString(template, inputValues)

export const parseTemplate = (template: string) => parseFString(template)

export const checkValidTemplate = (
    template: MessageContent,
    inputVariables: string[]
) => {
    try {
        const dummyInputs: InputValues = inputVariables.reduce(
            (acc, v) => {
                acc[v] = 'foo'
                return acc
            },
            {} as Record<string, string>
        )
        if (Array.isArray(template)) {
            template.forEach((message) => {
                if (message.type === 'text') {
                    renderTemplate(message.text, dummyInputs)
                } else if (message.type === 'image') {
                    if (typeof message.image === 'string') {
                        renderTemplate(message.image, dummyInputs)
                    } else if (message.image instanceof URL) {
                        const imageUrl = message.image.toString()
                        renderTemplate(imageUrl, dummyInputs)
                    }
                } else {
                    throw new Error(
                        `Invalid message template received. ${JSON.stringify(
                            message,
                            null,
                            2
                        )}`
                    )
                }
            })
        } else {
            renderTemplate(template, dummyInputs)
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
        throw new Error(`Invalid prompt schema: ${e.message}`)
    }
}
