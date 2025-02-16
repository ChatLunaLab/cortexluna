import { z } from 'zod'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface BaseTool<T = any> {
    /**
     * The name of the tool.
     */
    name: string

    /**
     * A description of the tool.
     */
    description: string

    /**
     * Whether to return the tool's output directly.
     *
     * Setting this to true means that after the tool is called,
     * an agent should stop looping.
     */
    returnDirect?: boolean

    schema: z.ZodType<T>

    call(args: z.input<this['schema']>): PromiseLike<string | unknown>
}

const DEFAULT_INPUT_SCHEMA: z.ZodType<{
    input?: string
}> = z.object({
    input: z.string().optional()
})

export function tool<
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-constraint, @typescript-eslint/no-explicit-any
    T extends any = {
        input?: string
    }
>(
    func: (args: z.input<z.ZodType<T>>) => PromiseLike<string | unknown>,
    config: {
        name: string
        description: string
        schema?: z.ZodType<T>
        returnDirect?: boolean
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): BaseTool<any> {
    config.schema = config.schema ?? (DEFAULT_INPUT_SCHEMA as z.ZodType<T>)

    return {
        name: config.name,
        description: config.description,
        schema: config.schema,
        returnDirect: config.returnDirect,
        async call(args) {
            const isDefaultInputSchema = config.schema === DEFAULT_INPUT_SCHEMA
            if (typeof args === 'string' && !isDefaultInputSchema) {
                try {
                    args = JSON.parse(args)
                } catch (e) {
                    // ignore
                }
            } else if (typeof args === 'string' && isDefaultInputSchema) {
                args = {
                    input: args
                }
            }

            const parsedArgs = config.schema!.parse(args)

            return await func(parsedArgs)
        }
    }
}
