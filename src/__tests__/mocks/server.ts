/**
 * MSW server for integration tests (sub-issue #327).
 *
 * Tests that exercise hooks calling `pricingApi` register MSW handlers
 * here to simulate pysdk responses without a real network. Each test file
 * should:
 *
 *   import { server } from '../mocks/server';
 *   import { http, HttpResponse } from 'msw';
 *
 *   beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
 *   afterEach(() => server.resetHandlers());
 *   afterAll(() => server.close());
 *
 * `server.use(http.post('https://dummy-pysdk.local/...', ...))` adds
 * test-specific handlers that override the defaults.
 */
import { setupServer } from 'msw/node';

const server = setupServer();

export default server;
