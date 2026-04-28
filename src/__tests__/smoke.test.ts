/**
 * Smoke test — verifies that vitest is wired up correctly, including alias
 * resolution to `src/lib/...`. Sub-issue #325 (Fase 4 setup).
 *
 * If this file imports from `src/...` and the test passes, the test harness
 * is ready for the real tests in #326 (property-based) and #327 (integration).
 */
import { isAbortError } from 'src/lib/telemetry';

describe('smoke', () => {
  it('arithmetic still works', () => {
    expect(1 + 1).toBe(2);
  });

  it('can import from src/ alias', () => {
    expect(typeof isAbortError).toBe('function');
  });

  it('isAbortError detects AbortError', () => {
    const err = new DOMException('aborted', 'AbortError');
    expect(isAbortError(err)).toBe(true);
  });

  it('isAbortError rejects regular errors', () => {
    expect(isAbortError(new Error('boom'))).toBe(false);
    expect(isAbortError(null)).toBe(false);
    expect(isAbortError(undefined)).toBe(false);
  });
});
