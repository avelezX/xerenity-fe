/**
 * Company-specific risk configuration.
 * Reads from xerenity.risk_company_config to determine which commodities
 * a company manages, their contract specs, and exposure parameters.
 */
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { ExposureParams } from 'src/types/risk';

const supabase = createClientComponentClient();
const SCHEMA = 'xerenity';

export interface CommodityConfig {
  asset: string;
  unit: string;
  price_unit: string;
  contract_multiplier: number;
  chart_color: string;
  exchange: string;
  symbol: string;
}

export interface RiskCompanyConfig {
  id: string;
  company_id: string;
  commodities: CommodityConfig[];
  currency_asset: string;
  currency_unit: string;
  exposure_defaults: Record<string, unknown>;
  rolling_window: number;
  confidence_level: number;
}

/**
 * Fetch risk configuration for a specific company.
 * Returns null if the company has no risk config (not onboarded for risk).
 */
export async function fetchCompanyRiskConfig(
  companyId: string,
): Promise<RiskCompanyConfig | null> {
  const { data, error } = await supabase
    .schema(SCHEMA)
    .from('risk_company_config')
    .select('*')
    .eq('company_id', companyId)
    .limit(1);

  if (error) throw new Error(`Failed to fetch risk_company_config: ${error.message}`);
  if (!data || data.length === 0) return null;

  const row = data[0];
  return {
    id: row.id,
    company_id: row.company_id,
    commodities: (row.commodities ?? []) as CommodityConfig[],
    currency_asset: row.currency_asset ?? 'USD',
    currency_unit: row.currency_unit ?? 'USD/COP',
    exposure_defaults: (row.exposure_defaults ?? {}) as Record<string, unknown>,
    rolling_window: row.rolling_window ?? 180,
    confidence_level: row.confidence_level != null ? Number(row.confidence_level) : 0.99,
  };
}

function parseConfigRow(row: Record<string, unknown>): RiskCompanyConfig {
  return {
    id: row.id as string,
    company_id: row.company_id as string,
    commodities: (row.commodities ?? []) as CommodityConfig[],
    currency_asset: (row.currency_asset as string) ?? 'USD',
    currency_unit: (row.currency_unit as string) ?? 'USD/COP',
    exposure_defaults: (row.exposure_defaults ?? {}) as Record<string, unknown>,
    rolling_window: (row.rolling_window as number) ?? 180,
    confidence_level: row.confidence_level != null ? Number(row.confidence_level) : 0.99,
  };
}

/**
 * Save/update risk configuration for a company.
 */
export async function saveCompanyRiskConfig(
  companyId: string,
  commodities: CommodityConfig[],
): Promise<RiskCompanyConfig> {
  // Try insert first, then update if exists
  const { data: insertData, error: insertError } = await supabase
    .schema(SCHEMA)
    .from('risk_company_config')
    .insert({ company_id: companyId, commodities })
    .select('*')
    .single();

  if (insertError) {
    // If conflict (already exists), update instead
    const { data: updateData, error: updateError } = await supabase
      .schema(SCHEMA)
      .from('risk_company_config')
      .update({ commodities, updated_at: new Date().toISOString() })
      .eq('company_id', companyId)
      .select('*')
      .single();

    if (updateError) throw new Error(`Failed to save config: ${updateError.message}`);
    return parseConfigRow(updateData);
  }

  return parseConfigRow(insertData);
}

// ── Default exposure parameters (used as initial state in /risk-management
//    Exposicion tab and as the source for /risk-resumen) ──
//
// Estos son los parametros de proyeccion por defecto. La exposicion en USD
// se calcula a partir de ellos + los precios de fin de mes que fetchExposure
// trae directamente de Supabase para la filterDate solicitada — por lo que
// el resultado cambia mes a mes aunque los parametros sean los mismos.
//
// TODO: cuando el usuario edite estos valores en la tab Exposicion, persistir
// a risk_company_config.exposure_defaults y leerlos desde alli en ambas
// paginas en lugar de este default.
export const DEFAULT_EXPOSURE_PARAMS: ExposureParams = {
  proyeccion_azucar: [3157, 3157, 3157, 3157, 3157, 3157, 3157, 3157, 3157, 3157, 3157, 3157],
  precio_azucar_cent_lb: 13.89,
  factor_crudo_refinado: 1.05,
  proyeccion_glucosa: [2277, 2277, 2277, 2277, 2277, 2277, 2277, 2277, 2277, 2277, 2277, 2277],
  precio_maiz_cent_bu: 442,
  base_maiz_cent_bu: 80,
  flete_usd_ton: 46,
  processing_fee_usd: 263,
  proc_fee_cop_kg: 668,
  trm: 3800,
  factor_maiz_glucosa: 1.495,
  proyeccion_cocoa_polvo: [24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24],
  factor_cocoa_polvo: 1.22,
  proyeccion_manteca: [13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13],
  factor_manteca: 1.95,
  proyeccion_licor: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  factor_licor: 1.53,
  precio_cocoa_usd_ton: 2798,
  proyeccion_bolsa: [151, 151, 151, 151, 151, 151, 151, 151, 151, 151, 151, 151],
  proyeccion_envoltura: [138, 138, 138, 138, 138, 138, 138, 138, 138, 138, 138, 138],
  precio_empaque_fijo: 21610000,
  ventas_intl_usd: 130025826,
  ventas_co_usd: 0,
  ventas_pe_usd: 42827644,
};

// ── Predefined commodity templates ──

export const COMMODITY_TEMPLATES: CommodityConfig[] = [
  { asset: 'MAIZ', unit: 'TONS', price_unit: 'cents/bu', contract_multiplier: 5000, chart_color: '#f59e0b', exchange: 'CME', symbol: 'ZC' },
  { asset: 'AZUCAR', unit: 'TONS', price_unit: 'cents/lb', contract_multiplier: 112000, chart_color: '#10b981', exchange: 'ICE', symbol: 'SB' },
  { asset: 'CACAO', unit: 'TONS', price_unit: 'USD/ton', contract_multiplier: 10, chart_color: '#8b5cf6', exchange: 'ICE', symbol: 'CC' },
  { asset: 'CAFE', unit: 'TONS', price_unit: 'cents/lb', contract_multiplier: 37500, chart_color: '#78350f', exchange: 'ICE', symbol: 'KC' },
  { asset: 'PETROLEO', unit: 'BBL', price_unit: 'USD/bbl', contract_multiplier: 1000, chart_color: '#1e293b', exchange: 'NYMEX', symbol: 'CL' },
  { asset: 'TRIGO', unit: 'TONS', price_unit: 'cents/bu', contract_multiplier: 5000, chart_color: '#d97706', exchange: 'CME', symbol: 'ZW' },
  { asset: 'SOYA', unit: 'TONS', price_unit: 'cents/bu', contract_multiplier: 5000, chart_color: '#059669', exchange: 'CME', symbol: 'ZS' },
];

// ── Helpers to extract config maps ──

export function getAssetList(config: RiskCompanyConfig): string[] {
  return config.commodities.map((c) => c.asset);
}

export function getAssetsWithCurrency(config: RiskCompanyConfig): string[] {
  return [...getAssetList(config), config.currency_asset];
}

export function getChartColors(config: RiskCompanyConfig): Record<string, string> {
  const colors: Record<string, string> = {};
  config.commodities.forEach((c) => { colors[c.asset] = c.chart_color; });
  colors[config.currency_asset] = '#3b82f6'; // default blue for currency
  return colors;
}

export function getMultipliers(config: RiskCompanyConfig): Record<string, number> {
  const mult: Record<string, number> = {};
  config.commodities.forEach((c) => { mult[c.asset] = c.contract_multiplier; });
  return mult;
}

export function getUnits(config: RiskCompanyConfig): Record<string, string> {
  const units: Record<string, string> = {};
  config.commodities.forEach((c) => { units[c.asset] = c.unit; });
  units[config.currency_asset] = config.currency_unit;
  return units;
}

export function getPriceUnits(config: RiskCompanyConfig): Record<string, string> {
  const units: Record<string, string> = {};
  config.commodities.forEach((c) => { units[c.asset] = c.price_unit; });
  return units;
}
