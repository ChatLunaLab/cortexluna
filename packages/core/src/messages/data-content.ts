import { z } from 'zod'

export type DataContent = string | Uint8Array | ArrayBuffer | Buffer

export const DataContentSchema = z.union([
    z.string(),
    z.instanceof(Uint8Array),
    z.instanceof(ArrayBuffer),
    z.instanceof(Buffer)
])

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
