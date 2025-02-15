import { ZodError, ZodSchema } from 'zod'

export type ParseResult<T> =
    | { success: true; data: T; rawValue: unknown }
    | { success: false; error: Error }

export function safeParseJSON<T>({
    text,
    schema
}: {
    text: string
    schema?: ZodSchema<T>
}): ParseResult<T> {
    try {
        const value = JSON.parse(text)

        if (schema == null) {
            return { success: true, data: value as T, rawValue: value }
        }

        const validationResult = schema.safeParse(value)

        return validationResult.success
            ? { success: true, data: validationResult.data, rawValue: value }
            : {
                  success: false,
                  error: new ZodError(validationResult.error.issues)
              }
    } catch (error) {
        return {
            success: false,
            error:
                error instanceof Error
                    ? error
                    : new Error('Failed to parse JSON')
        }
    }
}
