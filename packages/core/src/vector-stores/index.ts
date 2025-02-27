import { Document } from '../documents/index.ts'
import { EmbeddingModel } from '../embeddings/index.ts'
import { Retriever, RetrieverInput } from '../retrievers/index.ts'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AddDocumentOptions = Record<string, any>

/**
 * Options for configuring a maximal marginal relevance (MMR) search.
 *
 * MMR search optimizes for both similarity to the query and diversity
 * among the results, balancing the retrieval of relevant documents
 * with variation in the content returned.
 *
 * Fields:
 *
 * - `fetchK` (optional): The initial number of documents to retrieve from the
 *   vector store before applying the MMR algorithm. This larger set provides a
 *   pool of documents from which the algorithm can select the most diverse
 *   results based on relevance to the query.
 *
 * - `filter` (optional): A filter of type `FilterType` to refine the search
 *   results, allowing additional conditions to target specific subsets
 *   of documents.
 *
 * - `k`: The number of documents to return in the final results. This is the
 *   primary count of documents that are most relevant to the query.
 *
 * - `lambda` (optional): A value between 0 and 1 that determines the balance
 *   between relevance and diversity:
 *   - A `lambda` of 0 emphasizes diversity, maximizing content variation.
 *   - A `lambda` of 1 emphasizes similarity to the query, focusing on relevance.
 *    Values between 0 and 1 provide a mix of relevance and diversity.
 *
 * @template FilterType - The type used for filtering results, as defined
 *                        by the vector store.
 */
export type MaxMarginalRelevanceSearchOptions<FilterType> = {
    k: number
    fetchK?: number
    lambda?: number
    filter?: FilterType
}

/**
 * Options for configuring a maximal marginal relevance (MMR) search
 * when using the `VectorStoreRetriever`.
 *
 * These parameters control how the MMR algorithm balances relevance to the
 * query and diversity among the retrieved documents.
 *
 * Fields:
 * - `fetchK` (optional): Specifies the initial number of documents to fetch
 *   before applying the MMR algorithm. This larger set provides a pool of
 *   documents from which the algorithm can select the most diverse results
 *   based on relevance to the query.
 *
 * - `lambda` (optional): A value between 0 and 1 that determines the balance
 *   between relevance and diversity:
 *   - A `lambda` of 0 maximizes diversity among the results, prioritizing varied content.
 *   - A `lambda` of 1 maximizes similarity to the query, prioritizing relevance.
 *   Values between 0 and 1 provide a mix of relevance and diversity.
 */
export type VectorStoreRetrieverMMRSearchKwargs = {
    fetchK?: number
    lambda?: number
}

/**
 * Input configuration options for creating a `VectorStoreRetriever` instance.
 *
 * This type combines properties from `BaseRetrieverInput` with specific settings
 * for the `VectorStoreRetriever`, including options for similarity or maximal
 * marginal relevance (MMR) search types.
 *
 * Fields:
 *
 * - `callbacks` (optional): An array of callback functions that handle various
 *   events during retrieval, such as logging, error handling, or progress updates.
 *
 * - `tags` (optional): An array of strings used to add contextual tags to
 *   retrieval operations, allowing for easier categorization and tracking.
 *
 * - `metadata` (optional): A record of key-value pairs to store additional
 *   contextual information for retrieval operations, which can be useful
 *   for logging or auditing purposes.
 *
 * - `verbose` (optional): A boolean flag that, if set to `true`, enables
 *   detailed logging and output during the retrieval process. Defaults to `false`.
 *
 * - `vectorStore`: The `VectorStore` instance implementing `VectorStoreInterface`
 *   that will be used for document storage and retrieval.
 *
 * - `k` (optional): Specifies the number of documents to retrieve per search
 *   query. Defaults to 4 if not specified.
 *
 * - `filter` (optional): A filter of type `FilterType` (defined by the vector store)
 *   to refine the set of documents returned, allowing for targeted search results.
 *
 * - `searchType`: Determines the type of search to perform:
 *   - `"similarity"`: Executes a similarity search, retrieving documents based purely
 *     on vector similarity to the query.
 *   - `"mmr"`: Executes a maximal marginal relevance (MMR) search, balancing similarity
 *     and diversity in the search results.
 *
 * - `searchKwargs` (optional): Used only if `searchType` is `"mmr"`, this object
 *   provides additional options for MMR search, including:
 *   - `fetchK`: Specifies the number of documents to initially fetch before applying
 *     the MMR algorithm, providing a pool from which the most diverse results are selected.
 *   - `lambda`: A diversity parameter, where 0 emphasizes diversity and 1 emphasizes
 *     relevance to the query. Values between 0 and 1 provide a balance of relevance and diversity.
 *
 * @template V - The type of vector store implementing `VectorStoreInterface`.
 */
export type VectorStoreRetrieverInput<V extends VectorStore> = RetrieverInput &
    (
        | {
              vectorStore: V
              k?: number
              filter?: V['FilterType']
              searchType?: 'similarity'
          }
        | {
              vectorStore: V
              k?: number
              filter?: V['FilterType']
              searchType: 'mmr'
              searchKwargs?: VectorStoreRetrieverMMRSearchKwargs
          }
    )

/**
 * Class for retrieving documents from a `VectorStore` based on vector similarity
 * or maximal marginal relevance (MMR).
 *
 * `VectorStoreRetriever` extends `BaseRetriever`, implementing methods for
 * adding documents to the underlying vector store and performing document
 * retrieval with optional configurations.
 *
 */
export interface VectorStoreRetriever<V extends VectorStore = VectorStore>
    extends Retriever {
    /**
     * The instance of `VectorStore` used for storing and retrieving document embeddings.
     * This vector store must implement the `VectorStoreInterface` to be compatible
     * with the retriever’s operations.
     */
    vectorStore: V

    /**
     * Specifies the number of documents to retrieve for each search query.
     * Defaults to 4 if not specified, providing a basic result count for similarity or MMR searches.
     */
    k: number

    /**
     * Determines the type of search operation to perform on the vector store.
     *
     * - `"similarity"` (default): Conducts a similarity search based purely on vector similarity
     *   to the query.
     * - `"mmr"`: Executes a maximal marginal relevance (MMR) search, balancing relevance and
     *   diversity in the retrieved results.
     */
    searchType: 'similarity' | 'mmr'

    /**
     * Additional options specific to maximal marginal relevance (MMR) search, applicable
     * only if `searchType` is set to `"mmr"`.
     *
     * Includes:
     * - `fetchK`: The initial number of documents fetched before applying the MMR algorithm,
     *   allowing for a larger selection from which to choose the most diverse results.
     * - `lambda`: A parameter between 0 and 1 to adjust the relevance-diversity balance,
     *   where 0 prioritizes diversity and 1 prioritizes relevance.
     */
    searchKwargs?: VectorStoreRetrieverMMRSearchKwargs

    /**
     * Optional filter applied to search results, defined by the `FilterType` of the vector store.
     * Allows for refined, targeted results by restricting the returned documents based
     * on specified filter criteria.
     */
    filter?: V['FilterType']

    /**
     * Returns the type of vector store, as defined by the `vectorStore` instance.
     *
     * @returns {string} The vector store type.
     */
    _vectorstoreType(): string

    /**
     * Adds an array of documents to the vector store, embedding them as part of
     * the storage process.
     *
     * This method delegates document embedding and storage to the `addDocuments`
     * method of the underlying vector store.
     *
     * @param documents - An array of documents to embed and add to the vector store.
     * @param options - Optional settings to customize document addition.
     * @returns A promise that resolves to an array of document IDs or `void`,
     *          depending on the vector store's implementation.
     */
    addDocuments(
        documents: Document[],
        options?: AddDocumentOptions
    ): Promise<string[] | void>
}

/**
 * Interface defining the structure and operations of a vector store, which
 * facilitates the storage, retrieval, and similarity search of document vectors.
 *
 * `VectorStoreInterface` provides methods for adding, deleting, and searching
 * documents based on vector embeddings, including support for similarity
 * search with optional filtering and relevance-based retrieval.
 *
 * @extends Serializable
 */
export interface VectorStore {
    /**
     * Defines the filter type used in search and delete operations. Can be an
     * object for structured conditions or a string for simpler filtering.
     */
    FilterType: object | string

    /**
     * Instance of `EmbeddingsInterface` used to generate vector embeddings for
     * documents, enabling vector-based search operations.
     */
    embeddings: EmbeddingModel

    /**
     * Returns a string identifying the type of vector store implementation,
     * useful for distinguishing between different vector storage backends.
     *
     * @returns {string} A string indicating the vector store type.
     */
    _vectorstoreType(): string

    /**
     * Adds precomputed vectors and their corresponding documents to the vector store.
     *
     * @param vectors - An array of vectors, with each vector representing a document.
     * @param documents - An array of `Document` instances corresponding to each vector.
     * @param options - Optional configurations for adding documents, potentially covering indexing or metadata handling.
     * @returns A promise that resolves to an array of document IDs or void, depending on implementation.
     */
    addVectors(
        vectors: number[][],
        documents: Document[],
        options?: AddDocumentOptions
    ): Promise<string[] | void>

    /**
     * Adds an array of documents to the vector store.
     *
     * @param documents - An array of documents to be embedded and stored in the vector store.
     * @param options - Optional configurations for embedding and storage operations.
     * @returns A promise that resolves to an array of document IDs or void, depending on implementation.
     */
    addDocuments(
        documents: Document[],
        options?: AddDocumentOptions
    ): Promise<string[] | void>

    /**
     * Deletes documents from the vector store based on the specified parameters.
     *
     * @param _params - A flexible object containing key-value pairs that define
     *                  the conditions for selecting documents to delete.
     * @returns A promise that resolves once the deletion operation is complete.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete(_params?: Record<string, any>): Promise<void>

    /**
     * Searches for documents similar to a given vector query and returns them
     * with similarity scores.
     *
     * @param query - A vector representing the query for similarity search.
     * @param k - The number of similar documents to return.
     * @param filter - Optional filter based on `FilterType` to restrict results.
     * @returns A promise that resolves to an array of tuples, each containing a
     *          `Document` and its corresponding similarity score.
     */
    similaritySearchVectorWithScore(
        query: number[],
        k: number,
        filter?: this['FilterType']
    ): Promise<[Document, number][]>

    /**
     * Searches for documents similar to a text query, embedding the query
     * and retrieving documents based on vector similarity.
     *
     * @param query - The text query to search for.
     * @param k - Optional number of similar documents to return.
     * @param filter - Optional filter based on `FilterType` to restrict results.
     * @param callbacks - Optional callbacks for tracking progress or events
     *                    during the search process.
     * @returns A promise that resolves to an array of `Document`
     *          instances representing similar documents.
     */
    similaritySearch(
        query: string,
        k?: number,
        filter?: this['FilterType']
    ): Promise<Document[]>

    /**
     * Searches for documents similar to a text query and includes similarity
     * scores in the result.
     *
     * @param query - The text query to search for.
     * @param k - Optional number of similar documents to return.
     * @param filter - Optional filter based on `FilterType` to restrict results.
     * @param callbacks - Optional callbacks for tracking progress or events
     *                    during the search process.
     * @returns A promise that resolves to an array of tuples, each containing
     *          a `Document` and its similarity score.
     */
    similaritySearchWithScore(
        query: string,
        k?: number,
        filter?: this['FilterType']
    ): Promise<[Document, number][]>

    /**
     * Return documents selected using the maximal marginal relevance.
     * Maximal marginal relevance optimizes for similarity to the query AND diversity
     * among selected documents.
     *
     * @param {string} query - Text to look up documents similar to.
     * @param {number} options.k - Number of documents to return.
     * @param {number} options.fetchK - Number of documents to fetch before passing to the MMR algorithm.
     * @param {number} options.lambda - Number between 0 and 1 that determines the degree of diversity among the results,
     *                 where 0 corresponds to maximum diversity and 1 to minimum diversity.
     * @param {this["FilterType"]} options.filter - Optional filter
     * @param _callbacks
     *
     * @returns {Promise<Document[]>} - List of documents selected by maximal marginal relevance.
     */
    maxMarginalRelevanceSearch?(
        query: string,
        options: MaxMarginalRelevanceSearchOptions<this['FilterType']>
    ): Promise<Document[]>

    /**
     * Converts the vector store into a retriever, making it suitable for use in
     * retrieval-based workflows and allowing additional configuration.
     *
     * @param kOrFields - Optional parameter for specifying either the number of
     *                    documents to retrieve or partial retriever configurations.
     * @param filter - Optional filter based on `FilterType` for retrieval restriction.
     * @param callbacks - Optional callbacks for tracking retrieval events or progress.
     * @param tags - General-purpose tags to add contextual information to the retriever.
     * @param metadata - General-purpose metadata providing additional context
     *                   for retrieval.
     * @param verbose - If `true`, enables detailed logging during retrieval.
     * @returns An instance of `VectorStoreRetriever` configured with the specified options.
     */
    asRetriever(
        kOrFields?: number | Partial<VectorStoreRetrieverInput<this>>,
        filter?: this['FilterType'],
        tags?: string[],
        metadata?: Record<string, unknown>
    ): VectorStoreRetriever<this>
}

/**
 * Abstract class extending `VectorStore` that defines a contract for saving
 * and loading vector store instances.
 *
 * The `SaveableVectorStore` class allows vector store implementations to
 * persist their data and retrieve it when needed.The format for saving and
 * loading data is left to the implementing subclass.
 *
 * Subclasses must implement the `save` method to handle their custom
 * serialization logic, while the `load` method enables reconstruction of a
 * vector store from saved data, requiring compatible embeddings through the
 * `EmbeddingsInterface`.
 *
 */
export interface SaveableVectorStore extends VectorStore {
    /**
     * Saves the current state of the vector store to the specified directory.
     *
     * This method must be implemented by subclasses to define their own
     * serialization process for persisting vector data. The implementation
     * determines the structure and format of the saved data.
     *
     * @param directory - The directory path where the vector store data
     * will be saved.
     * @abstract
     */
    save(directory: string): Promise<void>
}
