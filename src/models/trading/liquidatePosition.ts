/**
 * Wrappers para las RPCs de liquidacion de NDFs.
 *
 * Backend: scripts/ndf_liquidation_v2.sql:
 *   - xerenity.liquidate_ndf_position(p_position_id, p_liquidation_date,
 *       p_monto_usd, p_tasa_negociada, p_tasa_referencia, p_note)
 *   - xerenity.get_ndf_liquidations()
 *
 * El P&G se calcula DENTRO de la RPC a partir de los inputs del banco:
 *   pnl_cop = monto × (tasa_negociada − tasa_referencia) × signo
 *   pnl_usd = pnl_cop / tasa_referencia
 *   signo = +1 si direction='sell', -1 si direction='buy'
 *
 * Soporta liquidacion parcial: si monto < notional, la posicion queda
 * Activa con el remanente. No hay reversion.
 */
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

const supabase = createClientComponentClient();
const SCHEMA = 'xerenity';

export interface LiquidateNdfInput {
  positionId: string;
  liquidationDate: string;   // YYYY-MM-DD
  montoUsd: number;
  tasaNegociada: number;
  tasaReferencia: number;
  note?: string;
}

export type LiquidateResponse = {
  data:
    | {
        message: string;
        liquidation_id?: string;
        position_id?: string;
        pnl_cop?: number;
        pnl_usd?: number;
        monto_liquidado?: number;
        remanente_usd?: number;
        estado?: 'Activo' | 'Liquidado';
        // Si el server devuelve error en el body en lugar de SQL error
        current_estado?: string;
        monto_solicitado?: number;
        notional_disponible?: number;
        direction?: string;
      }
    | undefined;
  error: string | undefined;
};

const FAIL_MESSAGE_PREFIXES = [
  'Cannot',
  'Permission',
  'NDF position not found',
  'User must be logged in',
  'Missing required fields',
  'Monto must be',
  'Tasas must be',
  'Monto exceeds',
  'Unknown direction',
];

/**
 * Liquida (total o parcialmente) un NDF activo a partir de los datos
 * del banco (fecha de liquidacion, monto, tasa negociada, tasa
 * referencia). La RPC calcula P&G y aplica liquidacion parcial.
 */
export const liquidateNdfPosition = async (
  input: LiquidateNdfInput,
): Promise<LiquidateResponse> => {
  const response: LiquidateResponse = { data: undefined, error: undefined };
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('liquidate_ndf_position', {
        p_position_id: input.positionId,
        p_liquidation_date: input.liquidationDate,
        p_monto_usd: input.montoUsd,
        p_tasa_negociada: input.tasaNegociada,
        p_tasa_referencia: input.tasaReferencia,
        p_note: input.note ?? null,
      });
    if (error) {
      response.error = error.message || 'Error liquidating NDF position';
      return response;
    }
    const payload = data as LiquidateResponse['data'];
    if (payload && FAIL_MESSAGE_PREFIXES.some((p) => payload.message?.startsWith(p))) {
      response.error = payload.message;
      return response;
    }
    response.data = payload;
    return response;
  } catch (e) {
    response.error = (e as Error)?.message || 'Error liquidating NDF position';
    return response;
  }
};

// ── Lectura de liquidaciones ─────────────────────────────────────────────────

export type NdfLiquidationRow = {
  liquidation_id: string;
  ndf_position_id: string;
  liquidation_date: string;        // YYYY-MM-DD
  realized_pnl_cop: number;
  realized_pnl_usd: number;
  // Inputs del banco (pueden ser null si la liquidacion es legacy de v1)
  tasa_negociada: number | null;
  tasa_referencia: number | null;
  monto_liquidado_usd: number | null;
  note: string | null;
  liquidated_by: string;            // uuid
  created_at: string;               // timestamptz
  // joineado de ndf_position (contexto)
  label: string;
  counterparty: string;
  id_operacion: string | null;
  sociedad: string | null;
  direction: 'sell' | 'buy' | string;
  strike: number;
  notional_original: number;
};

export type LiquidationsResponse = {
  data: NdfLiquidationRow[];
  error: string | undefined;
};

/**
 * Lee todas las liquidaciones EXECUTED visibles al usuario.
 * El backend filtra por empresa para corp_admin/gestor; super_admin ve todas.
 */
export const fetchNdfLiquidations = async (): Promise<LiquidationsResponse> => {
  const response: LiquidationsResponse = { data: [], error: undefined };
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('get_ndf_liquidations');
    if (error) {
      response.error = error.message || 'Error fetching NDF liquidations';
      return response;
    }
    response.data = (data ?? []) as NdfLiquidationRow[];
    return response;
  } catch (e) {
    response.error = (e as Error)?.message || 'Error fetching NDF liquidations';
    return response;
  }
};
