/**
 * Company-specific risk configuration.
 * Reads from xerenity.risk_company_config to determine which commodities
 * a company manages, their contract specs, and exposure parameters.
 */
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

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
