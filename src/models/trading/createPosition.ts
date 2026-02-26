import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  NewXccyPosition,
  NewNdfPosition,
  NewIbrSwapPosition,
} from 'src/types/trading';

const supabase = createClientComponentClient();
const SCHEMA = 'xerenity';

export type CreatePositionResponse = {
  data: { message: string; id: string } | undefined;
  error: string | undefined;
};

export const createXccyPosition = async (
  values: NewXccyPosition
): Promise<CreatePositionResponse> => {
  const response: CreatePositionResponse = { data: undefined, error: undefined };
  try {
    const { data, error } = await supabase.schema(SCHEMA).rpc('create_xccy_position', {
      p_label: values.label,
      p_counterparty: values.counterparty,
      p_notional_usd: values.notional_usd,
      p_start_date: values.start_date,
      p_maturity_date: values.maturity_date,
      p_usd_spread_bps: values.usd_spread_bps,
      p_cop_spread_bps: values.cop_spread_bps,
      p_pay_usd: values.pay_usd,
      p_fx_initial: values.fx_initial,
      p_payment_frequency: values.payment_frequency,
      p_amortization_type: values.amortization_type,
      p_amortization_schedule: values.amortization_schedule ?? null,
    });
    if (error) {
      response.error = 'Error creating XCCY position';
      return response;
    }
    response.data = data;
    return response;
  } catch {
    response.error = 'Error creating XCCY position';
    return response;
  }
};

export const createNdfPosition = async (
  values: NewNdfPosition
): Promise<CreatePositionResponse> => {
  const response: CreatePositionResponse = { data: undefined, error: undefined };
  try {
    const { data, error } = await supabase.schema(SCHEMA).rpc('create_ndf_position', {
      p_label: values.label,
      p_counterparty: values.counterparty,
      p_notional_usd: values.notional_usd,
      p_strike: values.strike,
      p_maturity_date: values.maturity_date,
      p_direction: values.direction,
    });
    if (error) {
      response.error = 'Error creating NDF position';
      return response;
    }
    response.data = data;
    return response;
  } catch {
    response.error = 'Error creating NDF position';
    return response;
  }
};

export const createIbrSwapPosition = async (
  values: NewIbrSwapPosition
): Promise<CreatePositionResponse> => {
  const response: CreatePositionResponse = { data: undefined, error: undefined };
  try {
    const { data, error } = await supabase.schema(SCHEMA).rpc('create_ibr_swap_position', {
      p_label: values.label,
      p_counterparty: values.counterparty,
      p_notional: values.notional,
      p_start_date: values.start_date,
      p_maturity_date: values.maturity_date,
      p_fixed_rate: values.fixed_rate,
      p_pay_fixed: values.pay_fixed,
      p_spread_bps: values.spread_bps,
      p_payment_frequency: values.payment_frequency,
    });
    if (error) {
      response.error = 'Error creating IBR Swap position';
      return response;
    }
    response.data = data;
    return response;
  } catch {
    response.error = 'Error creating IBR Swap position';
    return response;
  }
};
