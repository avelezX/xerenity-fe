import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  NewXccyPosition,
  NewNdfPosition,
  NewIbrSwapPosition,
  NewTesPosition,
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
      p_id_operacion: values.id_operacion ?? null,
      p_trade_date: values.trade_date ?? null,
      p_sociedad: values.sociedad ?? null,
      p_id_banco: values.id_banco ?? null,
      p_modalidad: values.modalidad ?? null,
      p_settlement_date: values.settlement_date ?? null,
      p_tipo_divisa: values.tipo_divisa ?? null,
      p_estado: values.estado ?? null,
      p_doc_sap: values.doc_sap ?? null,
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
      p_id_operacion: values.id_operacion ?? null,
      p_trade_date: values.trade_date ?? null,
      p_sociedad: values.sociedad ?? null,
      p_id_banco: values.id_banco ?? null,
      p_modalidad: values.modalidad ?? null,
      p_settlement_date: values.settlement_date ?? null,
      p_tipo_divisa: values.tipo_divisa ?? null,
      p_estado: values.estado ?? null,
      p_doc_sap: values.doc_sap ?? null,
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
      p_id_operacion: values.id_operacion ?? null,
      p_trade_date: values.trade_date ?? null,
      p_sociedad: values.sociedad ?? null,
      p_id_banco: values.id_banco ?? null,
      p_modalidad: values.modalidad ?? null,
      p_settlement_date: values.settlement_date ?? null,
      p_tipo_divisa: values.tipo_divisa ?? null,
      p_estado: values.estado ?? null,
      p_doc_sap: values.doc_sap ?? null,
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

export const createTesPosition = async (
  values: NewTesPosition
): Promise<CreatePositionResponse> => {
  const response: CreatePositionResponse = { data: undefined, error: undefined };
  try {
    const { data, error } = await supabase.schema(SCHEMA).rpc('create_tes_position', {
      p_bond_name: values.bond_name,
      p_issue_date: values.issue_date,
      p_maturity_date: values.maturity_date,
      p_coupon_rate: values.coupon_rate,
      p_notional: values.notional,
      p_face_value: values.face_value ?? 100,
      p_purchase_price: values.purchase_price ?? null,
      p_purchase_ytm: values.purchase_ytm ?? null,
      p_trade_date: values.trade_date ?? null,
      p_sociedad: values.sociedad ?? null,
      p_estado: values.estado ?? 'Activo',
      p_label: values.label ?? null,
      p_counterparty: values.counterparty ?? null,
    });
    if (error) {
      response.error = 'Error creating TES position';
      return response;
    }
    response.data = data;
    return response;
  } catch {
    response.error = 'Error creating TES position';
    return response;
  }
};
