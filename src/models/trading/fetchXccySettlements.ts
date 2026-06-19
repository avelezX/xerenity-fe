/**
 * fetchXccySettlements — lee los cashflows trimestrales liquidados de los
 * XCCY swaps de la empresa.
 *
 * Fuente: RPC xerenity.get_xccy_settlements(p_company_id uuid).
 *
 * Filtrado por empresa:
 *   - super_admin sin p_company_id: ve TODAS las settlements (legacy).
 *   - super_admin con p_company_id: filtra a esa empresa (respeta el picker
 *     global en el header). Pasar activeCompanyId() del store.
 *   - corp_admin / gestor / lector: el backend FORZA filtrado a su empresa
 *     (defense in depth — ignora p_company_id si no coincide).
 *
 * Para poblar settlements nuevos (o re-trigger): llama
 * `settleXccyPositions()` de pricingApi.ts. Es idempotente: solo agrega
 * filas de periodos settled que aun no esten en la tabla.
 */
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

const supabase = createClientComponentClient();
const SCHEMA = 'xerenity';

export type XccySettlementRow = {
  id: string;
  xccy_position_id: string;
  company_id: string;
  period_index: number;
  period_start_date: string;       // YYYY-MM-DD
  period_end_date: string;
  payment_date: string;            // = period_end_date
  notional_usd_at_period: number;
  notional_cop_at_period: number;
  realized_sofr: number | null;    // decimal (no %)
  realized_ibr: number | null;
  usd_coupon: number;
  usd_amort: number;
  usd_principal_signed: number;
  usd_net: number;
  cop_coupon: number;
  cop_amort: number;
  cop_principal_signed: number;
  cop_net: number;
  trm_at_payment: number;
  trm_date: string;                // YYYY-MM-DD
  realized_pnl_cop: number;
  realized_pnl_usd: number;
  settled_at: string;              // timestamptz
  source: 'auto' | 'manual';
  // Joined desde xccy_position (contexto para UI)
  position_label: string;
  position_counterparty: string;
  position_direction: 'pay_usd' | 'rec_usd';
  position_fx_initial: number;
};

export type XccySettlementsResponse = {
  data: XccySettlementRow[];
  error: string | undefined;
};

export const fetchXccySettlements = async (
  companyId?: string | null,
): Promise<XccySettlementsResponse> => {
  const response: XccySettlementsResponse = { data: [], error: undefined };
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('get_xccy_settlements', {
        p_company_id: companyId ?? null,
      });
    if (error) {
      response.error = error.message || 'Error fetching XCCY settlements';
      return response;
    }
    response.data = (data ?? []) as XccySettlementRow[];
    return response;
  } catch (e) {
    response.error = (e as Error)?.message || 'Error fetching XCCY settlements';
    return response;
  }
};
