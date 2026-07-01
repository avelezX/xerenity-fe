/**
 * fetchFwdQuarterAssignments — lee/escribe/borra los overrides de trimestre
 * para posiciones FWD (NDF, XCCY, IBR). Ver
 * scripts/fwd_quarter_assignment_setup.sql del repo pysdk.
 *
 * PK compuesta (position_id, year) para permitir reasignar la misma posicion
 * a trimestres distintos en anos distintos.
 *
 * Fallback en QuarterlyFwdSummary: sin asignacion → quarterOf(trade_date).
 */
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

const supabase = createClientComponentClient();
const SCHEMA = 'xerenity';

export type FwdPositionType = 'NDF' | 'XCCY' | 'IBR';

export type FwdQuarterAssignmentRow = {
  position_id: string;
  year: number;
  position_type: FwdPositionType;
  company_id: string;
  quarter: 1 | 2 | 3 | 4;
  note: string | null;
  assigned_at: string;
  updated_at: string;
};

export type FwdQuarterAssignmentsResponse = {
  data: FwdQuarterAssignmentRow[];
  error: string | undefined;
};

export const fetchFwdQuarterAssignments = async (
  companyId: string | null | undefined,
  year: number | null = null,
): Promise<FwdQuarterAssignmentsResponse> => {
  const response: FwdQuarterAssignmentsResponse = { data: [], error: undefined };
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('get_fwd_quarter_assignments', {
        p_company_id: companyId ?? null,
        p_year: year,
      });
    if (error) {
      response.error = error.message || 'Error fetching fwd quarter assignments';
      return response;
    }
    response.data = (data ?? []) as FwdQuarterAssignmentRow[];
    return response;
  } catch (e) {
    response.error = (e as Error)?.message || 'Error fetching fwd quarter assignments';
    return response;
  }
};

export type UpsertFwdQuarterAssignmentInput = {
  position_id: string;
  year: number;
  position_type: FwdPositionType;
  company_id: string;
  quarter: 1 | 2 | 3 | 4;
  note?: string | null;
};

export const upsertFwdQuarterAssignment = async (
  input: UpsertFwdQuarterAssignmentInput,
): Promise<{ status?: string; error?: string }> => {
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('upsert_fwd_quarter_assignment', { p: input });
    if (error) {
      return { error: error.message || 'Error upserting fwd quarter assignment' };
    }
    const obj = (data ?? {}) as { status?: string };
    return { status: obj.status };
  } catch (e) {
    return { error: (e as Error)?.message || 'Error upserting fwd quarter assignment' };
  }
};

export const deleteFwdQuarterAssignment = async (
  positionId: string,
  year: number,
): Promise<{ status?: string; error?: string }> => {
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('delete_fwd_quarter_assignment', {
        p_position_id: positionId,
        p_year: year,
      });
    if (error) {
      return { error: error.message || 'Error deleting fwd quarter assignment' };
    }
    const obj = (data ?? {}) as { status?: string };
    return { status: obj.status };
  } catch (e) {
    return { error: (e as Error)?.message || 'Error deleting fwd quarter assignment' };
  }
};

// ── Helpers ────────────────────────────────────────────────

/**
 * Indexa las asignaciones por position_id para lookup O(1) en el render.
 * La key es solo position_id porque en la vista actual el ano es fijo (el
 * year del filterDate). Si en un futuro se quieren mostrar assignments
 * de otros anos, cambiar a `${position_id}:${year}`.
 */
export const indexAssignmentsById = (
  rows: FwdQuarterAssignmentRow[],
): Record<string, FwdQuarterAssignmentRow> => {
  const map: Record<string, FwdQuarterAssignmentRow> = {};
  rows.forEach((r) => {
    map[r.position_id] = r;
  });
  return map;
};
