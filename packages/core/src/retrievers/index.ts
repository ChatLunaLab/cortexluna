import { Document } from '../documents/index.ts'

/**
 * Input configuration options for initializing a retriever that extends
 * the `BaseRetriever` class. This interface provides base properties
 * common to all retrievers, allowing customization of callback functions,
 * tagging, metadata, and logging verbosity.
 *
 * Fields:
 *
 * - `tags` (optional): An array of strings used to add contextual tags to
 *   retrieval operations, allowing for easier categorization and tracking.
 *
 * - `metadata` (optional): A record of key-value pairs to store additional
 *   contextual information for retrieval operations, which can be useful
 *   for logging or auditing purposes.
 *
 */
export interface RetrieverInput {
    tags?: string[]
    metadata?: Record<string, unknown>
}

/**
 * Interface for a base retriever that defines core functionality for
 * retrieving relevant documents from a source based on a query.
 *
 * The `BaseRetrieverInterface` standardizes the `getRelevantDocuments` method,
 * enabling retrieval of documents that match the query criteria.
 *
 * @template Metadata - The type of metadata associated with each document,
 *                      defaulting to `Record<string, any>`.
 */
export interface Retriever<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Metadata extends Record<string, any> = Record<string, any>
> {
    /**
     * Retrieves documents relevant to a given query, allowing optional
     * configurations for customization.
     *
     * @param query - A string representing the query to search for relevant documents.
     * @param config - (optional) Configuration options for the retrieval process,
     *                 which may include callbacks and additional context settings.
     * @returns A promise that resolves to an array of `DocumentInterface` instances,
     *          each containing metadata specified by the `Metadata` type parameter.
     */
    getRelevantDocuments(query: string): Promise<Document<Metadata>[]>
}
