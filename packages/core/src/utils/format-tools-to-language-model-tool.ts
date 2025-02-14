import { zodToJsonSchema } from 'zod-to-json-schema'
import { JSONSchema7 } from 'json-schema'
import { LanguageModelTool } from '../language-models/index.ts'
import { BaseTool } from '../tools/index.ts'

export function formatToolsToLanguageModelTools(
    tools: BaseTool[]
): LanguageModelTool[] | undefined {
    if (tools.length < 1) {
        return undefined
    }
    return tools.map(formatToolToLanguageModelTool)
}

export function formatToolToLanguageModelTool(
    tool: BaseTool
): LanguageModelTool {
    const parameters = removeAdditionalProperties(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        zodToJsonSchema(tool.schema as any) as JSONSchema7
    )

    return {
        type: 'function',
        function: {
            name: tool.name,
            description: tool.description,
            // any?
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            parameters
        }
    }
}

function removeAdditionalProperties(schema: JSONSchema7): JSONSchema7 {
    const updatedSchema = { ...schema }
    if (Object.hasOwn(updatedSchema, 'additionalProperties')) {
        delete updatedSchema['additionalProperties']
    }

    if (Object.hasOwn(updatedSchema, '$schema')) {
        delete updatedSchema['$schema']
    }

    if (updatedSchema['properties']) {
        const keys = Object.keys(updatedSchema['properties'])
        removeProperties(updatedSchema['properties'], keys, 0)
    }
    return updatedSchema
}

function removeProperties(
    properties: JSONSchema7,
    keys: string[],
    index: number
): void {
    if (index >= keys.length) {
        return
    }
    const key = keys[index]
    // eslint-disable-next-line no-param-reassign
    properties[key] = removeAdditionalProperties(properties[key])
    removeProperties(properties, keys, index + 1)
}
