/**
 * Fetcher de TRM oficial de BanRep (serie 25) para liquidacion de NDFs.
 *
 * Misma convencion que el auto-settlement en
 * server/pricing_api/views.py::pricing_ndf_settlement:
 *
 *   fecha = liquidation_date + 1, order asc, limit 1
 *
 * Justificacion: la TRM "vigente el dia X" en BanRep es el promedio de
 * operaciones del dia X-1, publicada al dia siguiente. Para reflejar las
 * operaciones DEL dia de liquidacion, tomamos la TRM con fecha = D+1.
 * El gte + order asc salta automaticamente fines de semana y festivos.
 *
 * Ej: liquidacion 2026-06-18 (jueves) → busca fecha >= 2026-06-19 → trae la
 * TRM del viernes 19-jun, calculada de operaciones del jueves 18-jun.
 */
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

const supabase = createClientComponentClient();
const SCHEMA = 'xerenity';
const TRM_SERIE_ID = 25;

export interface BanRepTrm {
  valor: number;
  fecha: string; // YYYY-MM-DD — fecha real de BanRep usada (puede ser > liquidation_date+1 si hay festivos)
}

export type BanRepTrmResponse = {
  data: BanRepTrm | undefined;
  error: string | undefined;
};

/**
 * Trae la TRM oficial de BanRep aplicable para una fecha de liquidacion.
 * Sigue la misma logica que el endpoint Django del auto-settlement.
 */
export const fetchBanRepTrmForLiquidation = async (
  liquidationDate: string,
): Promise<BanRepTrmResponse> => {
  const response: BanRepTrmResponse = { data: undefined, error: undefined };
  if (!liquidationDate) {
    response.error = 'Fecha de liquidacion requerida';
    return response;
  }
  try {
    // liquidation_date + 1 dia calendario
    const next = new Date(`${liquidationDate}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    const nextStr = next.toISOString().slice(0, 10);

    const { data, error } = await supabase
      .schema(SCHEMA)
      .from('banrep_series_value_v2')
      .select('valor,fecha')
      .eq('id_serie', TRM_SERIE_ID)
      .gte('fecha', nextStr)
      .order('fecha', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) {
      response.error = error.message || 'Error fetching BanRep TRM';
      return response;
    }
    if (!data || data.valor == null) {
      response.error = `TRM de BanRep no disponible para fecha ${liquidationDate} (se busco a partir de ${nextStr})`;
      return response;
    }
    response.data = {
      valor: Number(data.valor),
      fecha: String(data.fecha).slice(0, 10),
    };
    return response;
  } catch (e) {
    response.error = (e as Error)?.message || 'Error fetching BanRep TRM';
    return response;
  }
};
