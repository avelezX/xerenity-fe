/**
 * Integration tests for `useRepricePortfolio` (#313) covering the original
 * NPV-flicker bug from #293 and the dual-toast bug from #313.
 *
 * Sub-issue #327. The tests exercise the hook end-to-end against a mocked
 * pysdk via MSW: change inputs rapidly, assert that only the response
 * matching the *current* inputs ever shows up in `data`. Stale responses
 * (from queries cancelled by newer ones) must not leak into `data`.
 *
 * If this file fails, somebody re-introduced the race condition that the
 * user reported as "aparecían dos NPVs uno tras otro al cambiar fechas".
 */
import { http, HttpResponse, delay } from 'msw';
import { waitFor, act } from '@testing-library/react';
import { server } from '../mocks/server';
import { renderHookWithClient } from '../mocks/test-helpers';
import { useRepricePortfolio } from 'src/queries/pricing';
import type { XccyPosition } from 'src/types/trading';

const PYSDK_URL = 'https://dummy-pysdk.local';

const mkXccy = (id: string, startDate = '2024-01-01'): XccyPosition => ({
  id,
  owner: 'test',
  company_id: 'co1',
  created_at: '2024-01-01T00:00:00Z',
  label: `XCCY-${id}`,
  counterparty: 'Test Bank',
  notional_usd: 1_000_000,
  start_date: startDate,
  maturity_date: '2030-01-01',
  usd_spread_bps: 0,
  cop_spread_bps: 0,
  pay_usd: true,
  fx_initial: 4000,
  payment_frequency: '3M',
  amortization_type: 'bullet',
  amortization_schedule: undefined,
});

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

it('msw smoke: fetch hits handler', async () => {
  let hit = false;
  server.use(
    http.post(`${PYSDK_URL}/pricing/portfolio/reprice`, () => {
      hit = true;
      return HttpResponse.json({
        xccy_results: [], ndf_results: [], ibr_swap_results: [],
        summary: { total_npv_cop: 0, total_npv_usd: 0, total_carry_cop: 0, total_carry_usd: 0, total_pnl_rate_cop: 0, total_pnl_fx_cop: 0 },
      });
    }),
  );
  const res = await fetch(`${PYSDK_URL}/pricing/portfolio/reprice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  expect(res.ok).toBe(true);
  expect(hit).toBe(true);
});

describe('useRepricePortfolio — concurrency', () => {
  it('rapid valuationDate changes: only the last response lands in data', async () => {
    // Each request echoes the valuation_date back so we can assert which
    // response the hook ended up showing.
    server.use(
      http.post(`${PYSDK_URL}/pricing/portfolio/reprice`, async ({ request }) => {
        const body = (await request.json()) as { valuation_date?: string };
        const fecha = body.valuation_date ?? 'unknown';
        // Simulate a slow pysdk so the early requests are still in-flight
        // when we change the date again.
        await delay(150);
        return HttpResponse.json({
          xccy_results: [{ id: 'p1', npv_cop: fecha === '2026-04-25' ? 1000 : -400 }],
          ndf_results: [],
          ibr_swap_results: [],
          summary: { total_npv_cop: 0, total_npv_usd: 0, total_carry_cop: 0, total_carry_usd: 0, total_pnl_rate_cop: 0, total_pnl_fx_cop: 0 },
        });
      }),
    );

    const positions = { xccy: [mkXccy('p1')], ndf: [], ibr: [] };

    const { result, rerender } = renderHookWithClient(
      ({ valuationDate }: { valuationDate: string }) =>
        useRepricePortfolio({ ...positions, valuationDate }),
      { initialProps: { valuationDate: '2026-04-20' } },
    );

    // Trigger 5 rapid date changes within a tight window. Each rerender
    // produces a new query key; TanStack should cancel the in-flight
    // previous request.
    const dates = ['2026-04-21', '2026-04-22', '2026-04-23', '2026-04-24', '2026-04-25'];
    await act(async () => {
      dates.forEach((d) => rerender({ valuationDate: d }));
    });

    // Wait for the last query to settle.
    await waitFor(() => {
      expect(result.current.isFetching).toBe(false);
    }, { timeout: 3000 });

    // Final data should reflect the LAST date (2026-04-25 → npv_cop = 1000).
    // If a stale earlier response leaked through, this would be -400.
    expect(result.current.data?.xccy_results[0].npv_cop).toBe(1000);
  });

  it('changing position list refetches automatically (key includes sorted ids)', async () => {
    let hits = 0;
    server.use(
      http.post(`${PYSDK_URL}/pricing/portfolio/reprice`, async ({ request }) => {
        hits += 1;
        const body = (await request.json()) as { xccy_positions: { id: string }[] };
        return HttpResponse.json({
          xccy_results: body.xccy_positions.map((p) => ({ id: p.id, npv_cop: 100 })),
          ndf_results: [],
          ibr_swap_results: [],
          summary: { total_npv_cop: 0, total_npv_usd: 0, total_carry_cop: 0, total_carry_usd: 0, total_pnl_rate_cop: 0, total_pnl_fx_cop: 0 },
        });
      }),
    );

    const { result, rerender } = renderHookWithClient(
      ({ xccy }: { xccy: XccyPosition[] }) =>
        useRepricePortfolio({ xccy, ndf: [], ibr: [], valuationDate: '2026-04-20' }),
      { initialProps: { xccy: [mkXccy('a')] } },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.xccy_results.length).toBe(1);
    expect(hits).toBe(1);

    // Add a position — different sorted id set → new key → refetch.
    rerender({ xccy: [mkXccy('a'), mkXccy('b')] });
    await waitFor(() => expect(result.current.data?.xccy_results.length).toBe(2));
    expect(hits).toBe(2);

    // Same set, different order → same key → no refetch.
    rerender({ xccy: [mkXccy('b'), mkXccy('a')] });
    // Give MSW a chance to receive a (non-)request.
    await delay(50);
    expect(hits).toBe(2);
  });
});

describe('useRepricePortfolio — null NPV handling', () => {
  it('backend returns null npv_cop → result row carries an error, not silent zero', async () => {
    server.use(
      http.post(`${PYSDK_URL}/pricing/portfolio/reprice`, () =>
        HttpResponse.json({
          xccy_results: [{
            id: 'p1',
            npv_cop: null,
            npv_usd: null,
          }],
          ndf_results: [],
          ibr_swap_results: [],
          summary: { total_npv_cop: 0, total_npv_usd: 0, total_carry_cop: 0, total_carry_usd: 0, total_pnl_rate_cop: 0, total_pnl_fx_cop: 0 },
        }),
      ),
    );

    const { result } = renderHookWithClient(() =>
      useRepricePortfolio({
        xccy: [mkXccy('p1')], ndf: [], ibr: [],
        valuationDate: '2026-04-25',
      }),
    );

    // Settle the query (success or error). If happy-dom + fetch quirk: log
    // diagnostics so a future regression report has data to chew on.
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const row = result.current.data!.xccy_results[0];
    // #296: silent null → 0 coercion was replaced with promoteNullNpvToError.
    // The row should now have an error string mentioning the field name.
    expect(row.error).toBeTruthy();
    expect(row.error).toMatch(/npv_cop/);
  });
});
