/**
 * Integration tests for semantic search pipeline.
 *
 * Tests the full search flow using semantic-aware mock embeddings
 * to verify that related code is found correctly.
 */

import { MockVectorStore, createMockRecord } from '../mocks/store.mock.js';
import {
  mockEmbedSemantic,
  mockEmbedQuerySemantic,
  cosineSimilarity,
} from '../mocks/embedder.mock.js';
import { boostKeywordMatches } from '../../src/search/reranker.js';
import { buildSafeFilter } from '../../src/search/filter-builder.js';
import type { SearchResult } from '../../src/store/index.js';

describe('Semantic Search Integration', () => {
  let store: MockVectorStore;

  beforeEach(async () => {
    store = new MockVectorStore();
    await store.initialize();
  });

  afterEach(async () => {
    await store.close();
  });

  describe('Full Search Pipeline', () => {
    it('should find semantically related authentication code', async () => {
      // Index several code chunks with semantic embeddings
      const records = [
        createMockRecord({
          id: 'auth_login_ts_L1',
          content: `function login(username: string, password: string) {
            const user = await findUser(username);
            if (!user) throw new Error('User not found');
            const valid = await verifyPassword(password, user.hash);
            if (!valid) throw new Error('Invalid credentials');
            return createSession(user);
          }`,
          name: 'login',
          nodeType: 'function_declaration',
          language: 'typescript',
          filePath: '/src/auth/login.ts',
          vector: mockEmbedSemantic('function login username password user session authentication').embedding,
        }),
        createMockRecord({
          id: 'auth_logout_ts_L1',
          content: `function logout(sessionId: string) {
            await destroySession(sessionId);
            return { success: true };
          }`,
          name: 'logout',
          nodeType: 'function_declaration',
          language: 'typescript',
          filePath: '/src/auth/logout.ts',
          vector: mockEmbedSemantic('function logout session authentication destroy').embedding,
        }),
        createMockRecord({
          id: 'db_query_ts_L1',
          content: `function queryUsers(filter: Filter) {
            return db.collection('users').find(filter).toArray();
          }`,
          name: 'queryUsers',
          nodeType: 'function_declaration',
          language: 'typescript',
          filePath: '/src/db/users.ts',
          vector: mockEmbedSemantic('function query database users collection filter').embedding,
        }),
        createMockRecord({
          id: 'api_handler_ts_L1',
          content: `function handleRequest(req: Request, res: Response) {
            const data = await fetchData(req.params.id);
            res.json(data);
          }`,
          name: 'handleRequest',
          nodeType: 'function_declaration',
          language: 'typescript',
          filePath: '/src/api/handler.ts',
          vector: mockEmbedSemantic('function handle request response api http json').embedding,
        }),
      ];

      await store.upsert(records);

      // Search for authentication-related code
      const queryVector = mockEmbedQuerySemantic('user authentication login').embedding;
      const results = await store.vectorSearch(queryVector, 4);

      // Auth-related results should be ranked higher
      expect(results.length).toBe(4);

      // The login function should be the top result
      expect(results[0]?.record.name).toBe('login');

      // Verify the auth functions have higher similarity than unrelated code
      const loginSim = results.find((r) => r.record.name === 'login')?.score ?? 0;
      const dbSim = results.find((r) => r.record.name === 'queryUsers')?.score ?? 0;

      expect(loginSim).toBeGreaterThan(dbSim);
    });

    it('should find database-related code when searching for data queries', async () => {
      const records = [
        createMockRecord({
          id: 'db_insert_ts_L1',
          content: `async function insertRecord(table: string, data: Record<string, unknown>) {
            const result = await db.execute(
              \`INSERT INTO \${table} SET ?\`,
              [data]
            );
            return result.insertId;
          }`,
          name: 'insertRecord',
          nodeType: 'function_declaration',
          language: 'typescript',
          filePath: '/src/db/operations.ts',
          vector: mockEmbedSemantic('function insert record database table sql query data').embedding,
        }),
        createMockRecord({
          id: 'db_select_ts_L1',
          content: `async function findById(table: string, id: number) {
            const rows = await db.query(
              \`SELECT * FROM \${table} WHERE id = ?\`,
              [id]
            );
            return rows[0];
          }`,
          name: 'findById',
          nodeType: 'function_declaration',
          language: 'typescript',
          filePath: '/src/db/operations.ts',
          vector: mockEmbedSemantic('function find select database table sql query id').embedding,
        }),
        createMockRecord({
          id: 'util_format_ts_L1',
          content: `function formatDate(date: Date): string {
            return date.toISOString().split('T')[0];
          }`,
          name: 'formatDate',
          nodeType: 'function_declaration',
          language: 'typescript',
          filePath: '/src/utils/format.ts',
          vector: mockEmbedSemantic('function format date string utility helper').embedding,
        }),
      ];

      await store.upsert(records);

      // Search for database query code
      const queryVector = mockEmbedQuerySemantic('database query SQL select').embedding;
      const results = await store.vectorSearch(queryVector, 3);

      // Database functions should be ranked higher than utilities
      expect(results.length).toBe(3);

      const dbResults = results.filter((r) =>
        r.record.filePath.includes('/db/')
      );
      expect(dbResults.length).toBeGreaterThan(0);

      // Database results should appear before utility functions
      const firstDbIndex = results.findIndex((r) =>
        r.record.filePath.includes('/db/')
      );
      const utilIndex = results.findIndex((r) =>
        r.record.filePath.includes('/utils/')
      );

      expect(firstDbIndex).toBeLessThan(utilIndex);
    });

    it('should boost results with keyword matches', async () => {
      const records = [
        createMockRecord({
          id: 'auth_validate_ts_L1',
          content: `function validateToken(token: string) {
            return jwt.verify(token, SECRET);
          }`,
          name: 'validateToken',
          nodeType: 'function_declaration',
          vector: mockEmbedSemantic('function validate token jwt verify auth').embedding,
        }),
        createMockRecord({
          id: 'auth_decode_ts_L1',
          content: `function decodeToken(token: string) {
            return jwt.decode(token);
          }`,
          name: 'decodeToken',
          nodeType: 'function_declaration',
          vector: mockEmbedSemantic('function decode token jwt auth').embedding,
        }),
      ];

      await store.upsert(records);

      // Get vector results
      const queryVector = mockEmbedQuerySemantic('validate token').embedding;
      let results = await store.vectorSearch(queryVector, 2);

      // Apply keyword boosting
      results = boostKeywordMatches('validate token', results);

      // The validateToken function should be boosted
      expect(results[0]?.record.name).toBe('validateToken');
      expect(results[0]?.score).toBeGreaterThan(0.5);
    });
  });

  describe('Filter Integration', () => {
    it('should filter by language', async () => {
      const records = [
        createMockRecord({
          id: 'ts_func_L1',
          language: 'typescript',
          content: 'function tsFunc() {}',
          vector: mockEmbedSemantic('function typescript').embedding,
        }),
        createMockRecord({
          id: 'py_func_L1',
          language: 'python',
          content: 'def py_func(): pass',
          vector: mockEmbedSemantic('function python').embedding,
        }),
        createMockRecord({
          id: 'go_func_L1',
          language: 'go',
          content: 'func goFunc() {}',
          vector: mockEmbedSemantic('function golang').embedding,
        }),
      ];

      await store.upsert(records);

      // Search with TypeScript filter
      const filter = buildSafeFilter({ filePattern: '*.ts' });
      const queryVector = mockEmbedQuerySemantic('function').embedding;
      const results = await store.vectorSearch(queryVector, 10, filter);

      expect(results.length).toBe(1);
      expect(results[0]?.record.language).toBe('typescript');
    });

    it('should filter by path prefix', async () => {
      const records = [
        createMockRecord({
          id: 'src_auth_login_ts_L1',
          filePath: '/project/src/auth/login.ts',
          content: 'function login() {}',
          vector: mockEmbedSemantic('login auth').embedding,
        }),
        createMockRecord({
          id: 'src_api_user_ts_L1',
          filePath: '/project/src/api/user.ts',
          content: 'function getUser() {}',
          vector: mockEmbedSemantic('user api').embedding,
        }),
        createMockRecord({
          id: 'test_auth_test_ts_L1',
          filePath: '/project/test/auth.test.ts',
          content: 'describe("auth") {}',
          vector: mockEmbedSemantic('test auth').embedding,
        }),
      ];

      await store.upsert(records);

      // Search with path filter
      const filter = buildSafeFilter({ path: 'src_auth' });
      const queryVector = mockEmbedQuerySemantic('auth').embedding;
      const results = await store.vectorSearch(queryVector, 10, filter);

      // Only src/auth files should match
      expect(results.length).toBe(1);
      expect(results[0]?.record.id).toContain('src_auth');
    });
  });

  describe('Semantic Similarity Verification', () => {
    it('should produce higher similarity for related content', () => {
      // Generate embeddings for related and unrelated content
      const authEmbed1 = mockEmbedSemantic('function login(user, password) { authenticate(user); }');
      const authEmbed2 = mockEmbedSemantic('function authenticate(credentials) { verifyPassword(); }');
      const dataEmbed = mockEmbedSemantic('function queryDatabase(sql) { return db.execute(sql); }');
      const httpEmbed = mockEmbedSemantic('function handleRequest(req, res) { res.json(data); }');

      // Auth embeddings should be similar to each other
      const authSimilarity = cosineSimilarity(authEmbed1.embedding, authEmbed2.embedding);

      // Auth and data should be less similar
      const authDataSimilarity = cosineSimilarity(authEmbed1.embedding, dataEmbed.embedding);

      // Auth and HTTP should be less similar
      const authHttpSimilarity = cosineSimilarity(authEmbed1.embedding, httpEmbed.embedding);

      // Related content should have higher similarity
      expect(authSimilarity).toBeGreaterThan(authDataSimilarity);
      expect(authSimilarity).toBeGreaterThan(authHttpSimilarity);
    });

    it('should handle queries matching document embeddings', () => {
      const docEmbed = mockEmbedSemantic('function validateUserCredentials(username, password) {}');
      const queryEmbed = mockEmbedQuerySemantic('user authentication credentials validation');

      const similarity = cosineSimilarity(docEmbed.embedding, queryEmbed.embedding);

      // Query and relevant document should have positive similarity
      expect(similarity).toBeGreaterThan(0);
    });
  });
});
