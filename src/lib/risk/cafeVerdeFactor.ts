/**
 * Conversion de kg "as sold" → kg verde equivalente.
 *
 * El cafe se vende en distintos estados fisicos (excelso, pergamino seco,
 * cereza, pasilla) que no son comparables 1:1 entre si para hedge KC ni
 * para calculo de margen vs compras (que vienen en kg cereza × factor humedo
 * → kg verde).
 *
 * Estos factores son industria estandar Colombia. Si en algun momento el
 * Embrujo da factores propios validados, se pueden mover a
 * `risk_company_config` y leerse por empresa (TODO futuro).
 *
 * Aplicacion:
 *   - VentasHistoricoCard: kg verde para promedios + contratos KC + exposicion USD
 *   - BlotterVentasCafe (totals): kg verde para el CafeMarginCard
 *   - NuevaVentaModal: preview en vivo del kg verde estimado al registrar
 */

/**
 * Multiplicador para convertir 1 kg del producto a kg de cafe verde.
 *
 * - Excelso / Wizard / Shaman / Mr Hat / etc. → 1.0  (ya es verde de calidad)
 * - Cafe Natural → 1.0  (verde natural)
 * - Cafe Pergamino Seco → 0.80  (pierde ~20% en la trilla)
 * - Cafe Cereza Clasificado → 0.143  (mismo factor humedo que compras cereza)
 * - Pasilla (de maquinas / electronica / seca) → 0  (descarte, sin hedge KC)
 *
 * El match es case-insensitive y por palabras clave (no exact).
 * Productos no reconocidos = 1.0 (asume verde, conservador).
 */
export function kgVerdeFactor(producto: string | null | undefined): number {
  if (!producto) return 1.0;
  const p = producto.toUpperCase();

  // Descarte: pasilla no se hedgea con KC. Match primero porque puede
  // contener "PASILLA SECA", "PASILLA ELECTRONICA", "PASILLA DE MAQUINAS".
  if (p.includes('PASILLA')) return 0;

  // Cereza (clasificada o no): factor humedo igual que compras.
  if (p.includes('CEREZA')) return 0.143;

  // Pergamino seco: rendimiento de trilla ~80%.
  if (p.includes('PERGAMINO')) return 0.80;

  // Cualquier otro producto (calidades excelso: Wizard, Shaman, Mr Hat,
  // Witch, Huntress, Fairy, Buffoon, Queen, Weaver, Natural, etc.) = 1.0
  return 1.0;
}

/**
 * Convierte kg "as sold" a kg verde equivalente para un producto.
 * Convenience wrapper sobre kgVerdeFactor().
 */
export function kgVerdeEquiv(producto: string | null | undefined, kg: number): number {
  return kg * kgVerdeFactor(producto);
}
