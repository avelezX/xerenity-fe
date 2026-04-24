import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  CollectorOverview,
  CollectorRun,
  CollectorAlert,
} from 'src/types/monitor';

const supabase = createClientComponentClient();
const SCHEMA = 'xerenity';

export type ListResponse<T> = {
  data: T[];
  error: string | undefined;
};

export type ActionResponse = {
  success: boolean;
  error: string | undefined;
};

export const listCollectorOverview = async (): Promise<ListResponse<CollectorOverview>> => {
  const response: ListResponse<CollectorOverview> = { data: [], error: undefined };
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('list_collector_overview');
    if (error) {
      response.error = error.message || 'Error fetching collector overview';
      return response;
    }
    response.data = (data ?? []) as CollectorOverview[];
    return response;
  } catch (e) {
    response.error = e instanceof Error ? e.message : 'Error fetching collector overview';
    return response;
  }
};

export const listActiveAlerts = async (): Promise<ListResponse<CollectorAlert>> => {
  const response: ListResponse<CollectorAlert> = { data: [], error: undefined };
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('list_active_alerts');
    if (error) {
      response.error = error.message || 'Error fetching active alerts';
      return response;
    }
    response.data = (data ?? []) as CollectorAlert[];
    return response;
  } catch (e) {
    response.error = e instanceof Error ? e.message : 'Error fetching active alerts';
    return response;
  }
};

export const listCollectorRuns = async (
  collectorName: string,
  limit = 30,
): Promise<ListResponse<CollectorRun>> => {
  const response: ListResponse<CollectorRun> = { data: [], error: undefined };
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .from('collector_runs')
      .select('*')
      .eq('collector_name', collectorName)
      .order('started_at', { ascending: false })
      .limit(limit);
    if (error) {
      response.error = error.message || 'Error fetching runs';
      return response;
    }
    response.data = (data ?? []) as CollectorRun[];
    return response;
  } catch (e) {
    response.error = e instanceof Error ? e.message : 'Error fetching runs';
    return response;
  }
};

export const getCollectorDefinition = async (
  collectorName: string,
): Promise<{ data: CollectorOverview | null; error: string | undefined }> => {
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('list_collector_overview');
    if (error) {
      return { data: null, error: error.message };
    }
    const rows = (data ?? []) as CollectorOverview[];
    const found = rows.find((r) => r.name === collectorName) ?? null;
    return { data: found, error: undefined };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Error' };
  }
};

export const acknowledgeAlert = async (alertId: string): Promise<ActionResponse> => {
  try {
    const { error } = await supabase
      .schema(SCHEMA)
      .rpc('acknowledge_alert', { p_alert_id: alertId });
    if (error) return { success: false, error: error.message };
    return { success: true, error: undefined };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error' };
  }
};

export const silenceAlert = async (
  alertId: string,
  duration: string,
): Promise<ActionResponse> => {
  try {
    const { error } = await supabase
      .schema(SCHEMA)
      .rpc('silence_alert', { p_alert_id: alertId, p_duration: duration });
    if (error) return { success: false, error: error.message };
    return { success: true, error: undefined };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error' };
  }
};

export const resolveAlert = async (alertId: string): Promise<ActionResponse> => {
  try {
    const { error } = await supabase
      .schema(SCHEMA)
      .rpc('resolve_alert', { p_alert_id: alertId });
    if (error) return { success: false, error: error.message };
    return { success: true, error: undefined };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error' };
  }
};
