import { StateCreator } from 'zustand';
import {
  XccyPosition,
  NdfPosition,
  IbrSwapPosition,
  TesPosition,
  PricedXccy,
  PricedNdf,
  PricedIbrSwap,
  PricedTesBond,
  PortfolioSummary,
  PortfolioRepriceResponse,
  NewXccyPosition,
  NewNdfPosition,
  NewIbrSwapPosition,
  NewTesPosition,
  UserTradingRole,
  MarketDataConfig,
  DEFAULT_MARKET_DATA_CONFIG,
} from 'src/types/trading';
import type { UserProfile } from 'src/types/user';
import { computePnlRefDates } from 'src/utils/pnlDates';
import {
  fetchXccyPositions,
  fetchNdfPositions,
  fetchIbrSwapPositions,
  fetchTesPositions,
  fetchUserTradingRole,
  createXccyPosition,
  createNdfPosition,
  createIbrSwapPosition,
  createTesPosition,
  deleteXccyPositions,
  deleteNdfPositions,
  deleteIbrSwapPositions,
  deleteTesPositions,
  repricePortfolio,
  fetchMarketDataConfig,
  saveMarketDataConfig,
} from 'src/models/trading';
import { priceTesBond } from 'src/models/pricing/pricingApi';
import { telemetry, isAbortError } from 'src/lib/telemetry';

const genId = () => crypto.randomUUID();

export interface TradingSlice {
  // Raw positions from DB
  xccyPositions: XccyPosition[];
  ndfPositions: NdfPosition[];
  ibrSwapPositions: IbrSwapPosition[];
  tesPositions: TesPosition[];

  // Priced results
  pricedXccy: PricedXccy[];
  pricedNdf: PricedNdf[];
  pricedIbrSwap: PricedIbrSwap[];
  pricedTesBonds: PricedTesBond[];
  summary: PortfolioSummary | null;

  // Company / Role
  userRole: UserTradingRole;
  canEdit: boolean;

  // UI state
  tradingLoading: boolean;
  tradingError: string | undefined;
  tradingSuccess: string | undefined;
  pricedAt: string | undefined;
  tesLoading: boolean;
  tesError: string | undefined;

  // Market data config
  marketDataConfig: MarketDataConfig;

  // Reference prices for P&L (1D, MTD, YTD)
  refPrices: {
    daily: PortfolioRepriceResponse | null;
    mtd: PortfolioRepriceResponse | null;
    ytd: PortfolioRepriceResponse | null;
  };
  refPricesForDate: string | undefined;
  refPricesLoading: boolean;

  // Fase 0 — Observability: counts concurrent reprice operations so we can
  // correlate NPV flicker with overlapping calls (see epic #297).
  inFlightReprices: number;

  // Actions
  loadUserRole: () => Promise<void>;
  loadPositions: (companyId?: string) => Promise<void>;
  repriceAll: () => Promise<void>;
  repriceAllWithMark: (fecha: string) => Promise<void>;
  addXccyPosition: (values: NewXccyPosition) => Promise<void>;
  addNdfPosition: (values: NewNdfPosition) => Promise<void>;
  addIbrSwapPosition: (values: NewIbrSwapPosition) => Promise<void>;
  removeXccyPositions: (ids: string[]) => Promise<void>;
  removeNdfPositions: (ids: string[]) => Promise<void>;
  removeIbrSwapPositions: (ids: string[]) => Promise<void>;
  loadMarketDataConfig: () => Promise<void>;
  updateMarketDataConfig: (config: MarketDataConfig) => Promise<void>;
  loadReferencePrices: (fechaMarca: string) => Promise<void>;
  resetTradingStore: () => void;
  // TES actions
  loadTesPositions: (companyId?: string) => Promise<void>;
  repriceTes: () => Promise<void>;
  addTesPosition: (values: NewTesPosition) => Promise<void>;
  removeTesPositions: (ids: string[]) => Promise<void>;
}

const initialTradingState = {
  xccyPositions: [],
  ndfPositions: [],
  ibrSwapPositions: [],
  tesPositions: [],
  pricedXccy: [],
  pricedNdf: [],
  pricedIbrSwap: [],
  pricedTesBonds: [],
  summary: null,
  userRole: { role: null, company_id: null, company_name: null } as UserTradingRole,
  canEdit: false,
  tradingLoading: false,
  tradingError: undefined,
  tradingSuccess: undefined,
  pricedAt: undefined,
  tesLoading: false,
  tesError: undefined,
  marketDataConfig: { ...DEFAULT_MARKET_DATA_CONFIG },
  refPrices: { daily: null, mtd: null, ytd: null },
  refPricesForDate: undefined,
  refPricesLoading: false,
  inFlightReprices: 0,
};

const createTradingSlice: StateCreator<TradingSlice> = (set, get) => {
  // Track concurrent reprice operations. When N > 1 we have overlapping calls
  // and the race condition that causes NPV flicker is in play. The counter is
  // both in store state (for UI) and logged (for post-mortem).
  const bumpInFlight = (delta: number, origin: string) => {
    const next = Math.max(0, get().inFlightReprices + delta);
    set({ inFlightReprices: next });
    if (next > 1) {
      telemetry.warn('store', 'overlapping reprice detected', {
        origin,
        inFlight: next,
      });
    } else {
      telemetry.debug('store', 'reprice in-flight', {
        origin,
        inFlight: next,
        delta,
      });
    }
  };

  const withInFlight = async <T>(origin: string, fn: () => Promise<T>): Promise<T> => {
    bumpInFlight(+1, origin);
    try {
      return await fn();
    } finally {
      bumpInFlight(-1, origin);
    }
  };

  // #293 — Monotonic tokens guard writes to pricedXccy/pricedNdf/pricedIbrSwap
  // and to refPrices. When repriceAll/repriceAllWithMark/repriceTes or
  // loadReferencePrices is called while a previous one is still in flight, we:
  //   1. Abort the previous request (needs #292's AbortSignal plumbing).
  //   2. Bump the token, capture a local copy.
  //   3. Before every set({priced...}), verify get().repriceToken === myToken.
  //      Stale responses get dropped — no more "last to land wins".
  let repriceToken = 0;
  let refPricesToken = 0;
  let repriceAbort: AbortController | null = null;
  let refPricesAbort: AbortController | null = null;

  const startReprice = (origin: string): { myToken: number; signal: AbortSignal } => {
    if (repriceAbort) {
      telemetry.debug('store', 'aborting prior reprice', { origin, prior: repriceToken });
      repriceAbort.abort();
    }
    repriceToken += 1;
    repriceAbort = new AbortController();
    return { myToken: repriceToken, signal: repriceAbort.signal };
  };

  const isStaleReprice = (myToken: number, origin: string): boolean => {
    if (myToken !== repriceToken) {
      telemetry.debug('store', 'dropping stale reprice result', {
        origin,
        myToken,
        current: repriceToken,
      });
      return true;
    }
    return false;
  };

  const startRefPrices = (origin: string): { myToken: number; signal: AbortSignal } => {
    if (refPricesAbort) {
      telemetry.debug('store', 'aborting prior refPrices', { origin, prior: refPricesToken });
      refPricesAbort.abort();
    }
    refPricesToken += 1;
    refPricesAbort = new AbortController();
    return { myToken: refPricesToken, signal: refPricesAbort.signal };
  };

  const isStaleRefPrices = (myToken: number, origin: string): boolean => {
    if (myToken !== refPricesToken) {
      telemetry.debug('store', 'dropping stale refPrices result', {
        origin,
        myToken,
        current: refPricesToken,
      });
      return true;
    }
    return false;
  };

  return {
  ...initialTradingState,

  loadUserRole: async () => {
    const role = await fetchUserTradingRole();
    // After the role-system migration, userProfile is the canonical source.
    // The legacy trading RPC returns null for new role names, leaving canEdit
    // false and hiding the "Add" buttons in OTC/TES portfolios.
    const profile = (get() as unknown as { userProfile: UserProfile | null }).userProfile;
    const modernCanEdit =
      profile?.role === 'super_admin' ||
      profile?.role === 'corp_admin' ||
      profile?.role === 'gestor';
    const legacyCanEdit = role.role === 'admin' || role.role === 'manager';
    set({
      userRole: role,
      canEdit: modernCanEdit || legacyCanEdit,
    });
  },

  loadPositions: async (companyId?: string) => {
    set({ tradingLoading: true, tradingError: undefined });
    try {
      const [xccy, ndf, ibrSwap] = await Promise.all([
        fetchXccyPositions(companyId),
        fetchNdfPositions(companyId),
        fetchIbrSwapPositions(companyId),
      ]);

      // Only update from DB if at least one succeeded without error
      // If all fail (e.g. tables don't exist), keep current local state
      const allFailed = xccy.error && ndf.error && ibrSwap.error;
      if (allFailed) {
        set({ tradingLoading: false });
        return;
      }

      set({
        xccyPositions: xccy.error ? get().xccyPositions : xccy.data,
        ndfPositions: ndf.error ? get().ndfPositions : ndf.data,
        ibrSwapPositions: ibrSwap.error ? get().ibrSwapPositions : ibrSwap.data,
        tradingLoading: false,
      });
    } catch {
      // Network error or tables don't exist — keep local state
      set({ tradingLoading: false });
    }
  },

  repriceAll: async () => {
    const { xccyPositions, ndfPositions, ibrSwapPositions } = get();
    const total =
      xccyPositions.length + ndfPositions.length + ibrSwapPositions.length;
    if (total === 0) return;

    const { myToken, signal } = startReprice('repriceAll');
    set({ tradingLoading: true, tradingError: undefined });
    try {
      const result = await withInFlight('repriceAll', () =>
        repricePortfolio(xccyPositions, ndfPositions, ibrSwapPositions, { signal }),
      );
      if (isStaleReprice(myToken, 'repriceAll')) return;
      set({
        pricedXccy: result.xccy_results,
        pricedNdf: result.ndf_results,
        pricedIbrSwap: result.ibr_swap_results,
        summary: result.summary,
        tradingLoading: false,
        pricedAt: new Date().toLocaleTimeString('es-CO', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      });
    } catch (e) {
      if (isAbortError(e)) return;
      if (isStaleReprice(myToken, 'repriceAll')) return;
      set({
        tradingLoading: false,
        tradingError: e instanceof Error ? e.message : 'Reprice failed',
      });
    }
  },

  repriceAllWithMark: async (fecha: string) => {
    const { xccyPositions, ndfPositions, ibrSwapPositions, tesPositions } = get();
    const { myToken, signal } = startReprice(`repriceAllWithMark(${fecha})`);
    set({ tradingLoading: true, tesLoading: true, tradingError: undefined });
    await withInFlight(`repriceAllWithMark(${fecha})`, async () => {
    try {
      // Excluir instrumentos cuya fecha de celebración es posterior a la fecha de marca
      const filteredNdf  = ndfPositions.filter((p) => !p.trade_date || p.trade_date <= fecha);
      const filteredXccy = xccyPositions.filter((p) => p.start_date <= fecha);
      const filteredIbr  = ibrSwapPositions.filter((p) => p.start_date <= fecha);

      // Reprice derivatives with historical mark date
      const [portfolioResult, tesResults] = await Promise.allSettled([
        repricePortfolio(filteredXccy, filteredNdf, filteredIbr, {
          valuation_date: fecha,
          signal,
        }),
        Promise.allSettled(
          tesPositions.map((pos) =>
            priceTesBond(
              {
                bond_name: pos.bond_name,
                issue_date: pos.issue_date,
                maturity_date: pos.maturity_date,
                coupon_rate: pos.coupon_rate * 100,
                face_value: pos.face_value,
                include_cashflows: true,
                valuation_date: fecha,
              },
              { signal },
            ).then((r) => ({ pos, result: r }))
          )
        ),
      ]);

      // If a newer reprice replaced us while we were awaiting, drop everything.
      if (isStaleReprice(myToken, `repriceAllWithMark(${fecha})`)) return;

      if (portfolioResult.status === 'fulfilled') {
        const result = portfolioResult.value;
        set({
          pricedXccy: result.xccy_results,
          pricedNdf: result.ndf_results,
          pricedIbrSwap: result.ibr_swap_results,
          summary: result.summary,
          pricedAt: fecha,
        });
      } else if (!isAbortError(portfolioResult.reason)) {
        set({ tradingError: portfolioResult.reason instanceof Error ? portfolioResult.reason.message : 'Reprice failed' });
      }

      if (tesResults.status === 'fulfilled') {
        const priced: PricedTesBond[] = tesResults.value.map((outcome, i) => {
          const pos = tesPositions[i];
          if (outcome.status === 'fulfilled') {
            const r = outcome.value.result;
            const npv = (r.dirty_price / pos.face_value) * pos.notional;
            const pnlMtm = pos.purchase_price != null
              ? ((r.clean_price - pos.purchase_price) / pos.face_value) * pos.notional
              : 0;
            return {
              ...pos,
              clean_price: r.clean_price,
              dirty_price: r.dirty_price,
              accrued_interest: r.accrued_interest,
              ytm: r.ytm,
              macaulay_duration: r.macaulay_duration,
              modified_duration: r.modified_duration,
              convexity: r.convexity,
              dv01: r.dv01,
              bpv: r.bpv,
              npv,
              pnl_mtm: pnlMtm,
              z_spread_bps: r.z_spread_bps,
              carry: r.carry,
              cashflows: r.cashflows,
            };
          }
          return {
            ...pos,
            clean_price: 0, dirty_price: 0, accrued_interest: 0,
            ytm: 0, macaulay_duration: 0, modified_duration: 0,
            convexity: 0, dv01: 0, bpv: 0, npv: 0, pnl_mtm: 0,
            error: outcome.reason instanceof Error ? outcome.reason.message : 'Error',
          };
        });
        set({ pricedTesBonds: priced });
      }
    } catch (e) {
      if (isAbortError(e)) return;
      if (isStaleReprice(myToken, `repriceAllWithMark(${fecha})`)) return;
      set({ tradingError: e instanceof Error ? e.message : 'Reprice failed' });
    } finally {
      // Only turn loading off if we're still the active reprice; otherwise
      // the newer one owns the loading state.
      if (!isStaleReprice(myToken, `repriceAllWithMark(${fecha})`)) {
        set({ tradingLoading: false, tesLoading: false });
      }
    }
    });
  },

  addXccyPosition: async (values: NewXccyPosition) => {
    set({ tradingLoading: true, tradingError: undefined, tradingSuccess: undefined });
    const res = await createXccyPosition(values);
    // Always add to local state (DB may not be ready)
    const localPos: XccyPosition = {
      id: res.error ? genId() : (res.data as { id?: string })?.id || genId(),
      owner: '',
      created_at: new Date().toISOString(),
      ...values,
    };
    set((state) => ({
      tradingLoading: false,
      tradingSuccess: 'Posicion XCCY agregada',
      xccyPositions: [...state.xccyPositions, localPos],
    }));
    if (!res.error) {
      // Refresh from DB to get server-generated ID
      await get().loadPositions();
    }
  },

  addNdfPosition: async (values: NewNdfPosition) => {
    set({ tradingLoading: true, tradingError: undefined, tradingSuccess: undefined });
    const res = await createNdfPosition(values);
    const localPos: NdfPosition = {
      id: res.error ? genId() : (res.data as { id?: string })?.id || genId(),
      owner: '',
      created_at: new Date().toISOString(),
      ...values,
    };
    set((state) => ({
      tradingLoading: false,
      tradingSuccess: 'Posicion NDF agregada',
      ndfPositions: [...state.ndfPositions, localPos],
    }));
    if (!res.error) {
      await get().loadPositions();
    }
  },

  addIbrSwapPosition: async (values: NewIbrSwapPosition) => {
    set({ tradingLoading: true, tradingError: undefined, tradingSuccess: undefined });
    const res = await createIbrSwapPosition(values);
    const localPos: IbrSwapPosition = {
      id: res.error ? genId() : (res.data as { id?: string })?.id || genId(),
      owner: '',
      created_at: new Date().toISOString(),
      ...values,
    };
    set((state) => ({
      tradingLoading: false,
      tradingSuccess: 'Posicion IBR Swap agregada',
      ibrSwapPositions: [...state.ibrSwapPositions, localPos],
    }));
    if (!res.error) {
      await get().loadPositions();
    }
  },

  removeXccyPositions: async (ids: string[]) => {
    set({ tradingLoading: true, tradingError: undefined });
    await deleteXccyPositions(ids);
    // Always remove from local state
    set((state) => ({
      tradingLoading: false,
      xccyPositions: state.xccyPositions.filter((p) => !ids.includes(p.id)),
      pricedXccy: state.pricedXccy.filter((p) => !ids.includes(p.id)),
      tradingSuccess: 'Posicion eliminada',
    }));
  },

  removeNdfPositions: async (ids: string[]) => {
    set({ tradingLoading: true, tradingError: undefined });
    await deleteNdfPositions(ids);
    set((state) => ({
      tradingLoading: false,
      ndfPositions: state.ndfPositions.filter((p) => !ids.includes(p.id)),
      pricedNdf: state.pricedNdf.filter((p) => !ids.includes(p.id)),
      tradingSuccess: 'Posicion eliminada',
    }));
  },

  removeIbrSwapPositions: async (ids: string[]) => {
    set({ tradingLoading: true, tradingError: undefined });
    await deleteIbrSwapPositions(ids);
    set((state) => ({
      tradingLoading: false,
      ibrSwapPositions: state.ibrSwapPositions.filter(
        (p) => !ids.includes(p.id)
      ),
      pricedIbrSwap: state.pricedIbrSwap.filter(
        (p) => !ids.includes(p.id)
      ),
      tradingSuccess: 'Posicion eliminada',
    }));
  },

  loadMarketDataConfig: async () => {
    const config = await fetchMarketDataConfig();
    set({ marketDataConfig: config });
  },

  updateMarketDataConfig: async (config: MarketDataConfig) => {
    set({ marketDataConfig: config });
    await saveMarketDataConfig(config);
  },

  loadReferencePrices: async (fechaMarca: string) => {
    const { refPricesForDate, xccyPositions, ndfPositions, ibrSwapPositions } = get();

    // Caché: no recargar si la fecha de marca no cambió
    if (refPricesForDate === fechaMarca) return;

    const { myToken, signal } = startRefPrices(`loadReferencePrices(${fechaMarca})`);
    set({ refPricesLoading: true });
    await withInFlight(`loadReferencePrices(${fechaMarca})`, async () => {
    try {
      const refDates = await computePnlRefDates(fechaMarca);

      // Filtrar posiciones por fecha (excluir las que no existían en la fecha de referencia)
      const filterXccy = (fecha: string) =>
        xccyPositions.filter((p) => p.start_date <= fecha);
      const filterNdf = (fecha: string) =>
        ndfPositions.filter((p) => !p.trade_date || p.trade_date <= fecha);
      const filterIbr = (fecha: string) =>
        ibrSwapPositions.filter((p) => p.start_date <= fecha);

      // Repricear las 3 fechas de referencia en paralelo
      const [dailyResult, mtdResult, ytdResult] = await Promise.allSettled([
        refDates.daily
          ? repricePortfolio(
              filterXccy(refDates.daily),
              filterNdf(refDates.daily),
              filterIbr(refDates.daily),
              { valuation_date: refDates.daily, signal }
            )
          : Promise.resolve(null),
        refDates.mtd
          ? repricePortfolio(
              filterXccy(refDates.mtd),
              filterNdf(refDates.mtd),
              filterIbr(refDates.mtd),
              { valuation_date: refDates.mtd, signal }
            )
          : Promise.resolve(null),
        refDates.ytd
          ? repricePortfolio(
              filterXccy(refDates.ytd),
              filterNdf(refDates.ytd),
              filterIbr(refDates.ytd),
              { valuation_date: refDates.ytd, signal }
            )
          : Promise.resolve(null),
      ]);

      if (isStaleRefPrices(myToken, `loadReferencePrices(${fechaMarca})`)) return;

      set({
        refPrices: {
          daily: dailyResult.status === 'fulfilled' ? dailyResult.value : null,
          mtd: mtdResult.status === 'fulfilled' ? mtdResult.value : null,
          ytd: ytdResult.status === 'fulfilled' ? ytdResult.value : null,
        },
        refPricesForDate: fechaMarca,
        refPricesLoading: false,
      });
    } catch (e) {
      if (isAbortError(e)) return;
      if (isStaleRefPrices(myToken, `loadReferencePrices(${fechaMarca})`)) return;
      set({ refPricesLoading: false });
    }
    });
  },

  resetTradingStore: () => set(initialTradingState),

  loadTesPositions: async (companyId?: string) => {
    set({ tesLoading: true, tesError: undefined });
    try {
      const res = await fetchTesPositions(companyId);
      if (res.error) {
        set({ tesLoading: false, tesError: res.error });
        return;
      }
      set({ tesPositions: res.data, tesLoading: false });
    } catch {
      set({ tesLoading: false });
    }
  },

  repriceTes: async () => {
    const { tesPositions } = get();
    if (tesPositions.length === 0) return;

    // repriceTes shares the pricedXccy/pricedNdf/pricedIbrSwap token because
    // repriceAllWithMark also writes pricedTesBonds — they compete for the
    // same downstream slot.
    const { myToken, signal } = startReprice('repriceTes');
    set({ tesLoading: true, tesError: undefined });

    const results = await withInFlight('repriceTes', () =>
      Promise.allSettled(
        tesPositions.map((pos) =>
          priceTesBond(
            {
              bond_name: pos.bond_name,
              issue_date: pos.issue_date,
              maturity_date: pos.maturity_date,
              coupon_rate: pos.coupon_rate * 100, // pysdk expects pct
              face_value: pos.face_value,
              include_cashflows: true,
            },
            { signal },
          ).then((r) => ({ pos, result: r }))
        )
      )
    );

    if (isStaleReprice(myToken, 'repriceTes')) return;

    const priced: PricedTesBond[] = results.map((outcome, i) => {
      const pos = tesPositions[i];
      if (outcome.status === 'fulfilled') {
        const r = outcome.value.result;
        const npv = (r.dirty_price / pos.face_value) * pos.notional;
        const pnlMtm = pos.purchase_price != null
          ? ((r.clean_price - pos.purchase_price) / pos.face_value) * pos.notional
          : 0;
        return {
          ...pos,
          clean_price: r.clean_price,
          dirty_price: r.dirty_price,
          accrued_interest: r.accrued_interest,
          ytm: r.ytm,
          macaulay_duration: r.macaulay_duration,
          modified_duration: r.modified_duration,
          convexity: r.convexity,
          dv01: r.dv01,
          bpv: r.bpv,
          npv,
          pnl_mtm: pnlMtm,
          z_spread_bps: r.z_spread_bps,
          carry: r.carry,
          cashflows: r.cashflows,
        };
      }
      // If individual result was aborted, treat as generic error — the
      // isStaleReprice guard above already short-circuits the common case
      // where the whole reprice was superseded.
      return {
        ...pos,
        clean_price: 0, dirty_price: 0, accrued_interest: 0,
        ytm: 0, macaulay_duration: 0, modified_duration: 0,
        convexity: 0, dv01: 0, bpv: 0, npv: 0, pnl_mtm: 0,
        error: outcome.reason instanceof Error ? outcome.reason.message : 'Error',
      };
    });

    set({ pricedTesBonds: priced, tesLoading: false });
  },

  addTesPosition: async (values: NewTesPosition) => {
    set({ tesLoading: true, tesError: undefined });
    const res = await createTesPosition(values);
    const localPos: TesPosition = {
      id: res.error ? genId() : (res.data as { id?: string })?.id || genId(),
      owner: '',
      created_at: new Date().toISOString(),
      ...values,
    };
    set((state) => ({
      tesLoading: false,
      tesPositions: [...state.tesPositions, localPos],
    }));
    if (!res.error) {
      await get().loadTesPositions();
    }
    await get().repriceTes();
  },

  removeTesPositions: async (ids: string[]) => {
    set({ tesLoading: true, tesError: undefined });
    await deleteTesPositions(ids);
    set((state) => ({
      tesLoading: false,
      tesPositions: state.tesPositions.filter((p) => !ids.includes(p.id)),
      pricedTesBonds: state.pricedTesBonds.filter((p) => !ids.includes(p.id)),
    }));
  },
  };
};

export default createTradingSlice;
