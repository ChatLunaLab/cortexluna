export interface Document<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Metadata extends Record<string, unknown> = Record<string, unknown>
> {
    pageContent: string
    metadata?: Metadata
    id?: string
}
