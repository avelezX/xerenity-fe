/**
 * Lightweight telemetry for Fase 0 instrumentation.
 * Tracks request timing, concurrent in-flight operations, and silently
 * nullified numeric fields so we can diagnose the pricing/loans flicker and
 * 68-loan timeout issues with data instead of guesses.
 *
 * Tracked in epic #297 (Fase 0 — Instrumentación de pricing y loans).
 */

const SHORT_ID_LEN = 8;

export type TelemetryNamespace = 'pricing' | 'reprice' | 'loans' | 'store';

/** Default HTTP timeout for pricing/loans fetchers. Also used when no external
 *  signal is provided. Tracked in sub-issue #292. */
export const DEFAULT_FETCH_TIMEOUT_MS = 30_000;

/**
 * Combine an optional external AbortSignal with a timeout signal.
 * Returns a signal that aborts when either the external one aborts or the
 * timeout fires. Falls back to a manual aggregator when AbortSignal.any is
 * not available (older browsers / Node < 20).
 */
export function combineAbortSignals(
  external: AbortSignal | undefined,
  timeoutMs: number,
): AbortSignal {
  const timeoutSignal =
    typeof AbortSignal.timeout === 'function'
      ? AbortSignal.timeout(timeoutMs)
      : (() => {
          const c = new AbortController();
          setTimeout(() => c.abort(new DOMException('Timeout', 'TimeoutError')), timeoutMs);
          return c.signal;
        })();

  if (!external) return timeoutSignal;

  // `AbortSignal.any` must be called as a static method on AbortSignal to
  // preserve `this` binding. Extracting it as a free function and invoking
  // it (`anyFn([...])`) fails with "this is not a constructor" in some
  // runtimes (notably happy-dom inside vitest).
  const AbortSignalCtor = AbortSignal as unknown as {
    any?: (signals: AbortSignal[]) => AbortSignal;
  };
  if (typeof AbortSignalCtor.any === 'function') {
    return AbortSignalCtor.any([external, timeoutSignal]);
  }

  const ctrl = new AbortController();
  const forward = (source: AbortSignal) => {
    if (source.aborted) {
      ctrl.abort(source.reason);
      return;
    }
    source.addEventListener('abort', () => ctrl.abort(source.reason), { once: true });
  };
  forward(external);
  forward(timeoutSignal);
  return ctrl.signal;
}

/** True if the given error was caused by an abort/timeout. */
export function isAbortError(e: unknown): boolean {
  if (!e) return false;
  if (e instanceof DOMException) {
    return e.name === 'AbortError' || e.name === 'TimeoutError';
  }
  if (e instanceof Error) {
    return e.name === 'AbortError' || e.name === 'TimeoutError';
  }
  return false;
}

const makeReqId = (): string => {
  try {
    return crypto.randomUUID().slice(0, SHORT_ID_LEN);
  } catch {
    return Math.random().toString(36).slice(2, 2 + SHORT_ID_LEN);
  }
};

const isDev =
  typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';

const inFlightCounters: Record<string, number> = {};
const listeners = new Set<(counts: Record<string, number>) => void>();

const notify = () => {
  const snapshot = { ...inFlightCounters };
  listeners.forEach((l) => l(snapshot));
};

export const telemetry = {
  newReqId: makeReqId,

  info(ns: TelemetryNamespace, msg: string, ctx?: Record<string, unknown>) {
    // eslint-disable-next-line no-console
    console.info(`[${ns}] ${msg}`, ctx ?? '');
  },

  warn(ns: TelemetryNamespace, msg: string, ctx?: Record<string, unknown>) {
    // eslint-disable-next-line no-console
    console.warn(`[${ns}] ${msg}`, ctx ?? '');
  },

  debug(ns: TelemetryNamespace, msg: string, ctx?: Record<string, unknown>) {
    if (!isDev) return;
    // eslint-disable-next-line no-console
    console.debug(`[${ns}] ${msg}`, ctx ?? '');
  },

  /**
   * Time an async operation, logging start and end with a stable reqId.
   * Also bumps an in-flight counter keyed by `ns:op` so concurrent operations
   * are observable (subscribe with onInFlightChange to render a dev badge).
   */
  async time<T>(
    ns: TelemetryNamespace,
    op: string,
    fn: (reqId: string) => Promise<T>,
    ctx?: Record<string, unknown>,
  ): Promise<T> {
    const reqId = makeReqId();
    const key = `${ns}:${op}`;
    inFlightCounters[key] = (inFlightCounters[key] ?? 0) + 1;
    notify();
    telemetry.debug(ns, `${op} start`, { reqId, inFlight: inFlightCounters[key], ...ctx });
    const t0 =
      typeof performance !== 'undefined' && performance.now
        ? performance.now()
        : Date.now();
    try {
      const result = await fn(reqId);
      const durationMs = Math.round(
        (typeof performance !== 'undefined' && performance.now
          ? performance.now()
          : Date.now()) - t0,
      );
      telemetry.info(ns, `${op} ok`, { reqId, durationMs, ...ctx });
      return result;
    } catch (e) {
      const durationMs = Math.round(
        (typeof performance !== 'undefined' && performance.now
          ? performance.now()
          : Date.now()) - t0,
      );
      const message = e instanceof Error ? e.message : String(e);
      const name = e instanceof Error ? e.name : 'Error';
      telemetry.warn(ns, `${op} fail`, { reqId, durationMs, name, message, ...ctx });
      throw e;
    } finally {
      inFlightCounters[key] = Math.max(0, (inFlightCounters[key] ?? 1) - 1);
      notify();
    }
  },

  /**
   * Warn when a numeric field from a backend response is null/undefined.
   * Hides silent "price=0" bugs where the UI cannot tell "not priced" from
   * "priced at zero" (see sub-issue #296).
   */
  assertNumeric(
    ns: TelemetryNamespace,
    field: string,
    value: unknown,
    ctx?: Record<string, unknown>,
  ): boolean {
    if (value === null || value === undefined) {
      telemetry.warn(ns, `null numeric field: ${field}`, ctx);
      return false;
    }
    if (typeof value !== 'number' || Number.isNaN(value)) {
      telemetry.warn(ns, `non-numeric field: ${field}`, { value, ...ctx });
      return false;
    }
    return true;
  },

  getInFlight(): Record<string, number> {
    return { ...inFlightCounters };
  },

  onInFlightChange(listener: (counts: Record<string, number>) => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
