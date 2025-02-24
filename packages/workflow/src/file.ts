import { WorkflowNode } from './types.ts'
import { z } from 'zod'

const workflowNodeSchema = z.object({
    id: z.string(),
    type: z.string(),
    dependencies: z.array(
        z.union([
            z.string(),
            z.object({
                nodeId: z.string(),
                portId: z.string(),
                inputId: z.string().optional()
            })
        ])
    ),
    config: z.record(z.unknown()).optional(),
    data: z.unknown().optional()
})

const workflowSchema = z.array(workflowNodeSchema)

function serializeZodSchema(schema: z.ZodType): unknown {
    if (schema instanceof z.ZodObject) {
        const shape = schema._def.shape()
        const serializedShape: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(shape)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            serializedShape[key] = serializeZodSchema(value as any)
        }
        return { type: 'object', shape: serializedShape }
    } else if (schema instanceof z.ZodArray) {
        return { type: 'array', element: serializeZodSchema(schema.element) }
    } else if (schema instanceof z.ZodString) {
        return { type: 'string' }
    } else if (schema instanceof z.ZodNumber) {
        return { type: 'number' }
    } else if (schema instanceof z.ZodBoolean) {
        return { type: 'boolean' }
    } else if (schema instanceof z.ZodOptional) {
        return { type: 'optional', inner: serializeZodSchema(schema.unwrap()) }
    } else if (schema instanceof z.ZodUnion) {
        return {
            type: 'union',
            options: schema._def.options.map(serializeZodSchema)
        }
    } else if (schema instanceof z.ZodRecord) {
        return {
            type: 'record',
            valueType: serializeZodSchema(schema.valueSchema)
        }
    } else if (schema instanceof z.ZodEnum) {
        return { type: 'enum', values: schema._def.values }
    } else {
        return { type: 'unknown' }
    }
}

function deserializeZodSchema(serialized: unknown): z.ZodType {
    if (!serialized || typeof serialized !== 'object') {
        return z.unknown()
    }

    const schema = serialized as Record<string, unknown>
    switch (schema.type) {
        case 'object': {
            const shape = schema.shape as Record<string, unknown>
            const deserializedShape: Record<string, z.ZodType> = {}
            for (const [key, value] of Object.entries(shape)) {
                deserializedShape[key] = deserializeZodSchema(value)
            }
            return z.object(deserializedShape)
        }
        case 'array':
            return z.array(deserializeZodSchema(schema.element))
        case 'string':
            return z.string()
        case 'number':
            return z.number()
        case 'boolean':
            return z.boolean()
        case 'optional':
            return z.optional(deserializeZodSchema(schema.inner))
        case 'union':
            return z.union(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (schema.options as any[]).map(deserializeZodSchema) as any
            )
        case 'record':
            return z.record(deserializeZodSchema(schema.valueType))
        case 'enum':
            return z.enum(schema.values as [string, ...string[]])
        default:
            return z.unknown()
    }
}

/**
 * Serializes a workflow (array of WorkflowNode) to a JSON string
 * @param workflow The workflow to serialize
 * @returns A JSON string representation of the workflow
 */
export function serializeWorkflow(workflow: WorkflowNode[]): string {
    // Validate workflow against schema before serializing
    workflowSchema.parse(workflow)

    // Process workflow to handle Zod schemas
    const processedWorkflow = workflow.map((node) => ({
        ...node,
        data:
            node.data && typeof node.data === 'object' && 'schema' in node.data
                ? {
                      ...node.data,
                      schema: serializeZodSchema(
                          (node.data as { schema: z.ZodType }).schema
                      )
                  }
                : node.data
    }))

    return JSON.stringify(processedWorkflow)
}

/**
 * Deserializes a JSON string into a workflow (array of WorkflowNode)
 * @param json The JSON string to deserialize
 * @returns The deserialized workflow
 * @throws {Error} If the JSON string is invalid or doesn't match the workflow schema
 */
export function deserializeWorkflow(json: string): WorkflowNode[] {
    try {
        const parsed = JSON.parse(json)
        const validatedWorkflow = workflowSchema.parse(parsed)

        // Process workflow to restore Zod schemas
        return validatedWorkflow.map((node) => ({
            ...node,
            data:
                node.data &&
                typeof node.data === 'object' &&
                'schema' in node.data
                    ? {
                          ...node.data,
                          schema: deserializeZodSchema(
                              (node.data as { schema: unknown }).schema
                          )
                      }
                    : node.data
        }))
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to deserialize workflow: ${error.message}`)
        }
        throw error
    }
}
