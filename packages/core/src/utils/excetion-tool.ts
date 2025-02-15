import { z } from 'zod'
import { tool } from '../tools/index.ts'

export function excetionTool(message: string) {
    return tool(async () => message, {
        name: 'exception',
        description: 'Useful for throwing exceptions to model',
        schema: z.object({})
    })
}
