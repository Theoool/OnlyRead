I will refactor the AI and vector-related code using `@langchain/core`, `@langchain/openai`, and `ai` (Vercel AI SDK) to improve maintainability, type safety, and performance.

### 1. Infrastructure Layer (`lib/infrastructure/ai/embedding.ts`)
**Current:** Uses raw `OpenAI` client.
**Refactor:**
- Replace with `OpenAIEmbeddings` from `@langchain/openai`.
- Export a shared `embeddings` instance.
- Rewrite `generateEmbedding` to use `embeddings.embedQuery`.
- **Optimization:** This standardizes error handling and retry logic provided by LangChain.

### 2. Service Layer (`lib/core/indexing/service.ts`)
**Current:** Processes chunks in batches of 5, making individual API calls in parallel (`Promise.all`).
**Refactor:**
- Use `embeddings.embedDocuments(texts)` which sends a single API request for multiple chunks.
- Increase batch size (e.g., to 20 or 50) for significantly faster indexing and fewer network round-trips.
- **Optimization:** Reduces API latency and overhead.

### 3. QA Route (`app/api/qa/route.ts`)
**Current:** Manual prompt concatenation, raw `OpenAI` chat completion, and fragile manual JSON parsing.
**Refactor:**
- Use `ChatOpenAI` model.
- Use `ChatPromptTemplate` for cleaner prompt management.
- Use `.withStructuredOutput(zodSchema)` for robust, type-safe JSON generation (guaranteed by the model).
- **Optimization:** Eliminates JSON parsing errors and provides better TypeScript integration.

### 4. Search Routes (`app/api/search/*`)
**Refactor:**
- Update `app/api/search/route.ts` to use the new `generateEmbedding` helper.
- Ensure consistent embedding model usage across the application.

### Implementation Steps
1.  **Modify `lib/infrastructure/ai/embedding.ts`**: Implement LangChain embeddings.
2.  **Update `lib/core/indexing/service.ts`**: Implement batched embedding generation.
3.  **Rewrite `app/api/qa/route.ts`**: Implement LangChain Chat Model with Structured Output.
4.  **Verify**: Check that search and QA features continue to work as expected.
