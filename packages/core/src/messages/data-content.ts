import { z } from 'zod'

export const DataContentSchema = z.union([
    z.string(),
    z.instanceof(Uint8Array),
    z.instanceof(ArrayBuffer),
    z.instanceof(Buffer)
])

export type DataContent = z.infer<typeof DataContentSchema>

export function dataContentToBase64(data: DataContent): string {
    if (typeof data === 'string') {
        return data
    }

    if (data instanceof Uint8Array) {
        return Buffer.from(data).toString('base64')
    }

    if (data instanceof Buffer) {
        return data.toString('base64')
    }

    return Buffer.from(data).toString('base64')
}
