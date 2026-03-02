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
  NewXccyPosition,
  NewNdfPosition,
  NewIbrSwapPosition,
  NewTesPosition,
  UserTradingRole,
} from 'src/types/trading';
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
} from 'src/models/trading';
import { priceTesBond } from 'src/models/pricing/pricingApi';

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

  // Actions
  loadUserRole: () => Promise<void>;
  loadPositions: () => Promise<void>;
  repriceAll: () => Promise<void>;
  addXccyPosition: (values: NewXccyPosition) => Promise<void>;
  addNdfPosition: (values: NewNdfPosition) => Promise<void>;
  addIbrSwapPosition: (values: NewIbrSwapPosition) => Promise<void>;
  removeXccyPositions: (ids: string[]) => Promise<void>;
  removeNdfPositions: (ids: string[]) => Promise<void>;
  removeIbrSwapPositions: (ids: string[]) => Promise<void>;
  resetTradingStore: () => void;
  // TES actions
  loadTesPositions: () => Promise<void>;
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
};

const createTradingSlice: StateCreator<TradingSlice> = (set, get) => ({
  ...initialTradingState,

  loadUserRole: async () => {
    const role = await fetchUserTradingRole();
    set({
      userRole: role,
      canEdit: role.role === 'admin' || role.role === 'manager',
    });
  },

  loadPositions: async () => {
    set({ tradingLoading: true, tradingError: undefined });
    try {
      const [xccy, ndf, ibrSwap] = await Promise.all([
        fetchXccyPositions(),
        fetchNdfPositions(),
        fetchIbrSwapPositions(),
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

    set({ tradingLoading: true, tradingError: undefined });
    try {
      const result = await repricePortfolio(
        xccyPositions,
        ndfPositions,
        ibrSwapPositions
      );
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
      set({
        tradingLoading: false,
        tradingError: e instanceof Error ? e.message : 'Reprice failed',
      });
    }
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

  resetTradingStore: () => set(initialTradingState),

  loadTesPositions: async () => {
    set({ tesLoading: true, tesError: undefined });
    try {
      const res = await fetchTesPositions();
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

    set({ tesLoading: true, tesError: undefined });

    const results = await Promise.allSettled(
      tesPositions.map((pos) =>
        priceTesBond({
          bond_name: pos.bond_name,
          issue_date: pos.issue_date,
          maturity_date: pos.maturity_date,
          coupon_rate: pos.coupon_rate * 100, // pysdk expects pct
          face_value: pos.face_value,
          include_cashflows: true,
        }).then((r) => ({ pos, result: r }))
      )
    );

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
});

export default createTradingSlice;
