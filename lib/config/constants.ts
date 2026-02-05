/**
 * Centralized Configuration Constants
 */

export const API_CONFIG = {
    // Pagination
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,

    // Search
    DEFAULT_SEARCH_LIMIT: 20,
    MAX_SEARCH_LIMIT: 50,
    VECTOR_SIMILARITY_THRESHOLD: 0.6,

    // Retrieval
    DEFAULT_TOP_K: 6,
    MAX_TOP_K: 12,

    // Indexing
    CHUNK_BATCH_SIZE: 20,

    // Caching
    CACHE_TTL_SECONDS: 60,

    // Rate Limiting
    MAX_REQUESTS_PER_MINUTE: 60,
} as const;

export const DB_CONFIG = {
    // Connection
    MAX_CONNECTIONS: 20,
    CONNECTION_TIMEOUT_MS: 10000,

    // Query
    DEFAULT_LIMIT: 50,
    MAX_LIMIT: 1000,
} as const;
