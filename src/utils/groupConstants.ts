/**
 * Group color mapping for series visualization.
 * Colors from xerenity-explorer utils/constants.py
 */

export const GROUP_COLORS: Record<string, string> = {
  COLTES: '#1f77b4',
  'Cuentas Nacionales': '#ff7f0e',
  Divisas: '#2ca02c',
  'Empleo y Salarios': '#d62728',
  FIC: '#9467bd',
  'IBR-SWAP': '#8c564b',
  'Índices de Precios': '#e377c2',
  'Índices de Riesgo': '#7f7f7f',
  'Política Monetaria': '#bcbd22',
  'Tasa de Usura': '#17becf',
  'Tasas de Captación': '#aec7e8',
  'Tasas de Interés': '#ffbb78',
  'Tasas Implícitas': '#98df8a',
};

/**
 * FIC sub-type colors for distinguishing fund categories.
 */
export const FIC_SUBTYPE_COLORS: Record<string, string> = {
  'Fic de tipo general': '#7b4fbe',
  'Fic bursatiles': '#5e35b1',
  'Fic del mercado monetario': '#ab47bc',
  'Fic inmobiliarias': '#ce93d8',
  'Fondos de capital privado': '#4a148c',
};

export function getGroupColor(grupo: string): string {
  return GROUP_COLORS[grupo] || '#607d8b';
}
