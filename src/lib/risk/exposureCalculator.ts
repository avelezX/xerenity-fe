/* eslint-disable no-restricted-syntax, object-shorthand, prefer-template, no-continue */
/**
 * Exposure calculator — TypeScript port of gestion_de_riesgos/exposure.py
 *
 * Calculates USD exposure by commodity for Super de Alimentos.
 */

import type { ExposureParams } from 'src/types/risk';

// ── Constants ──

const LIBRAS_CONTRATO = 112_000; // lbs per sugar contract
const LBS_PER_TON = 2204.62;
// Factor "Conversión bu/ton" del modelo Excel/Python (instructivo de
// Super de Alimentos). Es el factor que se multiplica al precio en
// cents/bushel para llegar a la unidad "cents/ton" del modelo. NO es
// el bu/ton fisico (que seria 39.37); es el factor convencional que la
// hoja de calculo usa y que luego pide division por 100 para llegar a
// la unidad "USD/ton" del modelo.
//
// Cadena del modelo:
//   precio_cent_bu × CONV_BU_TON          -> "cent/ton" del modelo
//   "cent/ton"     / CENT_PER_USD         -> "USD/ton"  del modelo
const CONV_BU_TON = 0.3936825;
const TON_PER_BUSHEL = 0.0254;          // fisico real (bushel → ton) — solo para CBOT contract size
const CENT_PER_USD = 100;
const CORN_BUSHELS_CONTRATO = 5000; // CBOT Corn futures: 5,000 bushels per contract
const CORN_TON_CONTRATO = CORN_BUSHELS_CONTRATO * TON_PER_BUSHEL; // = 127 tons
const CREDITO_PCT = 0.26; // corn byproduct credit percentage
const COCOA_TON_CONTRATO = 10; // tons per cocoa contract

export interface CommodityExposure {
  nombre: string;
  proyeccion_tons: number;
  tons_reales: number;
  num_contratos: number;
  precio_unitario: number;
  exposicion_usd: number;
  detalle: Record<string, number>;
  // Opcionales para las formulaciones Super (AKOMEL/CEBES/ALMIDON)
  exchange?: string;
  unidad_cotizacion?: string;
  ton_total?: number;
  precio_por_ton?: number;
  precio_futuro?: number | null;
}

export interface ExposureResult {
  commodities: CommodityExposure[];
  total_commodities_usd: number;
  exposicion_real_usd: number;
  ventas_intl_usd: number;
  ventas_co_usd: number;
  ventas_pe_usd: number;
  market_prices: Record<string, { value: number; date: string; source: string; contract?: string }>;
}

// ── Sugar (Azúcar ICE SB) ──

function calcularAzucar(params: ExposureParams): CommodityExposure {
  const tonTotal = (params.proyeccion_azucar ?? []).reduce((a: number, b: number) => a + b, 0);
  const tonContrato = LIBRAS_CONTRATO / LBS_PER_TON; // ~50.82 tons
  const tonReales = tonTotal * (params.factor_crudo_refinado ?? 1.05);
  const numContratos = tonReales / tonContrato;
  const precioLibra = (params.precio_azucar_cent_lb ?? 0) / 100;
  const precioContrato = precioLibra * LIBRAS_CONTRATO;
  const exposicionUsd = precioContrato * numContratos;

  return {
    nombre: 'AZUCAR',
    proyeccion_tons: tonTotal,
    tons_reales: tonReales,
    num_contratos: numContratos,
    precio_unitario: precioLibra,
    exposicion_usd: exposicionUsd,
    detalle: {
      ton_contrato: tonContrato,
      precio_contrato: precioContrato,
      factor_crudo_refinado: params.factor_crudo_refinado ?? 1.05,
    },
  };
}

// ── Corn/Glucose (Maíz CME ZC) ──

function calcularMaiz(params: ExposureParams): CommodityExposure {
  const tonTotalGlucosa = (params.proyeccion_glucosa ?? []).reduce((a: number, b: number) => a + b, 0);
  const factorMaizGlucosa = params.factor_maiz_glucosa ?? 1.495;
  const precioCentBu = (params.precio_maiz_cent_bu ?? 0) + (params.base_maiz_cent_bu ?? 0);

  // Cadena del modelo Excel/Python (instructivo Super de Alimentos):
  //   precio_cent_bu × CONV_BU_TON = "cent/ton" del modelo
  //   "cent/ton" / 100             = "USD/ton"  del modelo
  // Donde CONV_BU_TON = 0.3936825 es el factor convencional del modelo
  // (no es el bu/ton fisico de 39.37). Esta convencion es la que el
  // usuario adopta como fuente de verdad para conciliar con el reporte
  // gerencial.
  const precioCentTon = precioCentBu * CONV_BU_TON;       // "cent/ton" modelo
  const precioUsdTon = precioCentTon / CENT_PER_USD;       // "USD/ton" modelo

  // Credito Subproductos = precio_maiz_usd_ton × 26%
  // SOLO sobre el precio del maiz; el flete oceanico es informativo y
  // NO entra al credito (decision jun-2026 alineada con el instructivo
  // Python de Super de Alimentos).
  const creditoSubproductos = precioUsdTon * CREDITO_PCT;

  const precioNeto = precioUsdTon + creditoSubproductos;
  const glucosaMateria = factorMaizGlucosa * precioNeto;
  const procFeeUsdTon = ((params.proc_fee_cop_kg ?? 0) / (params.trm ?? 1)) * 1000;
  const precioGlucosa = procFeeUsdTon + (params.processing_fee_usd ?? 0) + glucosaMateria;
  const exposicionUsd = tonTotalGlucosa * precioGlucosa;

  // # Contratos de maiz (CBOT ZC): se calcula a partir de las toneladas de
  // MAIZ necesarias (no glucosa) = tons_glucosa × factor_maiz_glucosa.
  // Contrato estandar CBOT = 5,000 bushels = 127 toneladas.
  const tonsMaizReales = tonTotalGlucosa * factorMaizGlucosa;
  const numContratos = tonsMaizReales / CORN_TON_CONTRATO;

  return {
    nombre: 'MAIZ',
    proyeccion_tons: tonTotalGlucosa,
    tons_reales: tonsMaizReales,
    num_contratos: numContratos,
    precio_unitario: precioGlucosa,
    exposicion_usd: exposicionUsd,
    detalle: {
      precio_cent_bu: precioCentBu,
      precio_cent_ton: precioCentTon,
      precio_usd_ton: precioUsdTon,
      flete_usd_ton: params.flete_usd_ton ?? 0,
      credito_subproductos: creditoSubproductos,
      glucosa_materia: glucosaMateria,
      proc_fee_usd_ton: procFeeUsdTon,
      processing_fee_usd: params.processing_fee_usd ?? 0,
      precio_glucosa: precioGlucosa,
      ton_contrato: CORN_TON_CONTRATO,
      factor_maiz_glucosa: factorMaizGlucosa,
    },
  };
}

// ── Cocoa derivatives (ICE CC) ──

interface CocoaProduct {
  nombre: string;
  proyeccion: number[];
  factor: number;
}

function calcularCocoaDerivado(
  product: CocoaProduct,
  precioFuturo: number,
): CommodityExposure {
  const tonTotal = product.proyeccion.reduce((a, b) => a + b, 0);
  const kgReales = tonTotal * 1000 * product.factor;
  const tonReales = kgReales / 1000;
  const numContratos = tonReales / COCOA_TON_CONTRATO;
  const precioContrato = COCOA_TON_CONTRATO * precioFuturo;
  const exposicionUsd = numContratos * precioContrato;

  return {
    nombre: product.nombre,
    proyeccion_tons: tonTotal,
    tons_reales: tonReales,
    num_contratos: numContratos,
    precio_unitario: precioFuturo,
    exposicion_usd: exposicionUsd,
    detalle: {
      factor_conversion: product.factor,
      kg_reales: kgReales,
      precio_contrato: precioContrato,
    },
  };
}

// ── Packaging (Empaque) ──

function calcularEmpaque(params: ExposureParams): CommodityExposure {
  const tonBolsa = (params.proyeccion_bolsa ?? []).reduce((a: number, b: number) => a + b, 0);
  const tonEnvoltura = (params.proyeccion_envoltura ?? []).reduce((a: number, b: number) => a + b, 0);
  const tonTotal = tonBolsa + tonEnvoltura;
  const precioFijo = params.precio_empaque_fijo ?? 0;
  const trm = params.trm ?? 1;
  const exposicionUsd = (precioFijo * tonTotal) / trm;

  return {
    nombre: 'EMPAQUE',
    proyeccion_tons: tonTotal,
    tons_reales: tonTotal,
    num_contratos: 0,
    precio_unitario: precioFijo / trm,
    exposicion_usd: exposicionUsd,
    detalle: {
      ton_bolsa: tonBolsa,
      ton_envoltura: tonEnvoltura,
      precio_fijo_cop: precioFijo,
      trm: trm,
    },
  };
}

// ── AKOMEL COP (Super de Alimentos: aceite de palma de Malasia) ──
// Port fiel del instructivo Python. Expone TODOS los intermedios por producto
// para auditoria contra la hoja de calculo (referencias de celda en comentarios).

export interface AkomelResult {
  // Precio crudo puesto puerto
  tariff_aak_my: number;             // USD/TON — D10
  precio_crudo_cop_ton: number;      // COP/TON — D13
  precio_crudo_cop_kg: number;       // COP/KG  — D14
  // Base proceso
  materia_prima: number;             // COP/KG  — D16
  bonificacion_calidad: number;      // COP/KG  — D17
  precio_mp_puesto_planta: number;   // COP/KG  — D20
  // AKOMEL NH Granel
  paso1_granel: number;              // D27 (tras rend. impurezas+humedad)
  paso2_granel: number;              // D28 (tras rend. acidez+AAK)
  precio_akomel_nh_granel: number;   // D30 (PRECIO FINAL)
  // AKOMEL NH Sin Lecitina Caja 15Kg
  paso1_sl: number;                  // D33
  paso2_sl: number;                  // D34
  precio_akomel_nh_sl_caja15: number; // D37 (PRECIO FINAL)
  // AKOMEL NH Saborizado Caja 15Kg
  paso1_sab: number;                 // D40
  paso2_sab: number;                 // D41
  precio_akomel_nh_sab_caja15: number; // D44 (PRECIO FINAL)
}

export function calcularAkomelCop(p: ExposureParams): AkomelResult {
  const fob = p.akomel_fob_malasya ?? 0;
  const flete = p.akomel_international_freight ?? 0;
  const riskFee = p.akomel_risk_futures_fee ?? 0;
  // TRM = TRM global de Xerenity (alimentada de BanRep via market_prices).
  // Antes era un campo independiente; se sincronizo para evitar inconsistencias.
  const trm = p.trm ?? 0;
  const primaAbast = p.akomel_prima_abastecimiento ?? 0;
  const fleteExt = p.akomel_flete_extractora_fabrica ?? 0;
  // Constantes con default
  const tariffPct = p.akomel_tariff_aak_my_pct ?? 0.0004;
  const bonifPct = p.akomel_bonificacion_calidad_pct ?? 0.025;
  // Rendimientos por producto (defaults identicos a la hoja actual)
  const rendIhG = p.akomel_rend_impurezas_humedad_granel ?? 0.99;
  const rendAaG = p.akomel_rend_acidez_aak_granel ?? 0.96;
  const costG = p.akomel_costos_transf_granel ?? 0;
  const rendIhSL = p.akomel_rend_impurezas_humedad_sl ?? 0.99;
  const rendAaSL = p.akomel_rend_acidez_aak_sl ?? 0.96;
  const costSL = p.akomel_costos_transf_sl ?? 0;
  const empSL = p.akomel_material_empaque_sl ?? 0;
  const rendIhSab = p.akomel_rend_impurezas_humedad_sab ?? 0.99;
  const rendAaSab = p.akomel_rend_acidez_aak_sab ?? 0.96;
  const costSab = p.akomel_costos_transf_sab ?? 0;
  const empSab = p.akomel_material_empaque_sab ?? 0;

  // Precio crudo puesto puerto (D10/D13/D14)
  const tariffAakMy = (fob + flete) * tariffPct;
  const precioCrudoCopTon = (fob + flete + tariffAakMy + riskFee) * trm;
  const precioCrudoCopKg = precioCrudoCopTon / 1000;

  // BASE PROCESO (D16/D17/D20)
  const materiaPrima = precioCrudoCopKg;
  const bonificacion = bonifPct * materiaPrima;
  const precioMpPlanta = materiaPrima + bonificacion + primaAbast + fleteExt;

  // AKOMEL NH Granel (D27/D28/D30)
  const paso1Granel = precioMpPlanta / rendIhG;
  const paso2Granel = paso1Granel / rendAaG;
  const precioGranel = paso2Granel + costG;

  // AKOMEL NH Sin Lecitina (D33/D34/D37)
  const paso1SL = precioMpPlanta / rendIhSL;
  const paso2SL = paso1SL / rendAaSL;
  const precioSL = paso2SL + costSL + empSL;

  // AKOMEL NH Saborizado (D40/D41/D44)
  const paso1Sab = precioMpPlanta / rendIhSab;
  const paso2Sab = paso1Sab / rendAaSab;
  const precioSab = paso2Sab + costSab + empSab;

  return {
    tariff_aak_my: tariffAakMy,
    precio_crudo_cop_ton: precioCrudoCopTon,
    precio_crudo_cop_kg: precioCrudoCopKg,
    materia_prima: materiaPrima,
    bonificacion_calidad: bonificacion,
    precio_mp_puesto_planta: precioMpPlanta,
    paso1_granel: paso1Granel,
    paso2_granel: paso2Granel,
    precio_akomel_nh_granel: precioGranel,
    paso1_sl: paso1SL,
    paso2_sl: paso2SL,
    precio_akomel_nh_sl_caja15: precioSL,
    paso1_sab: paso1Sab,
    paso2_sab: paso2Sab,
    precio_akomel_nh_sab_caja15: precioSab,
  };
}

// ── CEBES MC 35 (Super de Alimentos: Palmiste) ──
// risk_futures_fee_palmiste y prima_rspo_mb se reciben para trazabilidad
// pero NO entran en la formula vigente de la hoja (D58). Estan en 0.

export interface CebesResult {
  arancel: number;                // USD/TON — D54
  precio_palmiste_cop_kg: number; // COP/KG  — D58
  materia_prima: number;          // COP/KG  — D60
  precio_mp_planta: number;       // COP/KG  — D63
  paso1_cebes: number;            // COP/KG  — D67 (tras rend. impurezas+humedad)
  paso2_cebes: number;            // COP/KG  — D68 (tras rend. acidez+AAK)
  precio_cebes_mc35: number;      // COP/KG  — D72 (PRECIO FINAL)
}

export function calcularCebesMc35(p: ExposureParams): CebesResult {
  const cif = p.cebes_precio_palmiste_cif ?? 0;
  const fleteCol = p.cebes_flete_malasia_colombia ?? 0;
  const fleteEur = p.cebes_flete_malasia_europa ?? 0;
  // Misma TRM global de Xerenity
  const trm = p.trm ?? 0;
  const primaAbast = p.cebes_prima_abastecimiento ?? 0;
  const fleteExt = p.cebes_flete_extractora_fabrica ?? 0;
  const costT = p.cebes_costos_transformacion ?? 0;
  const empaque = p.cebes_material_empaque ?? 0;
  const financ = p.cebes_financiamiento ?? 0;
  // Constantes con default
  const arancelPct = p.cebes_arancel_pct ?? 0.001;
  const rendIh = p.cebes_rend_impurezas_humedad ?? 0.994;
  const rendAa = p.cebes_rend_acidez_aak ?? 0.94;
  // Informativos (no afectan formula vigente pero se reciben)
  // const _riskFee = p.cebes_risk_futures_fee_palmiste ?? 0;
  // const _primaRspo = p.cebes_prima_rspo_mb ?? 0;

  // D54
  const arancel = (cif + fleteCol + fleteEur) * arancelPct;
  // D58
  const precioPalmisteCopKg = ((cif + fleteCol + fleteEur + arancel) * trm) / 1000;
  // D60 / D63
  const materiaPrima = precioPalmisteCopKg;
  const precioMpPlanta = materiaPrima + primaAbast + fleteExt;
  // D67 / D68 / D72
  const paso1 = precioMpPlanta / rendIh;
  const paso2 = paso1 / rendAa;
  const precioCebes = paso2 + costT + empaque + financ;

  return {
    arancel,
    precio_palmiste_cop_kg: precioPalmisteCopKg,
    materia_prima: materiaPrima,
    precio_mp_planta: precioMpPlanta,
    paso1_cebes: paso1,
    paso2_cebes: paso2,
    precio_cebes_mc35: precioCebes,
  };
}

// ── ALMIDON (Super de Alimentos: maiz → almidon) ──
// Referencias de celda H8-H18 del instructivo.

export interface AlmidonResult {
  precio_fob_usc_bu: number;      // USc/Bush — H10
  precio_fob_usd_ton: number;     // USD/TON  — H12
  precio_maiz_usd_ton: number;    // USD/TON  — H14
  credito_subproductos: number;   // USD/TON  — H15
  precio_neto_maiz: number;       // USD/TON  — H16
  precio_almidon_usd_ton: number; // USD/TON  — H17/H18 (PRECIO FINAL)
}

export function calcularAlmidon(p: ExposureParams): AlmidonResult {
  const precioFut = p.precio_maiz_cent_bu ?? 0;   // H8 (reusa precio futuro ZC CBOT)
  const base = p.base_maiz_cent_bu ?? 0;          // H9 (reusa base USD)
  const fleteMaritimo = p.almidon_flete_maritimo ?? 0; // H13
  // Constantes con default (H11, G15, G17)
  const conv = p.almidon_factor_conversion_bush_ton ?? 0.3936825;
  const creditoPct = p.almidon_credito_subproductos_pct ?? 0.26;
  const factorMaizAlmidon = p.almidon_factor_conversion_maiz_almidon ?? 1.6;

  // FIX jun-2026: misma cadena de unidades que calcularMaiz.
  //   precio_cent_bu × conv = "cent/ton" del modelo (instructivo Excel/Python)
  //   "cent/ton"     / 100  = "USD/ton"  del modelo
  // Antes se interpretaba precioFobCentBu × 0.3937 directo como USD/ton,
  // lo que daba un valor 100× mayor que el del modelo. Ahora se respeta
  // la convencion del instructivo.
  const precioFobUsc = precioFut + base;
  const precioFobCentTon = precioFobUsc * conv;            // "cent/ton" modelo
  const precioFobUsdTon = precioFobCentTon / CENT_PER_USD;  // "USD/ton" modelo
  const precioMaizUsdTon = precioFobUsdTon + fleteMaritimo;
  const credito = creditoPct * precioMaizUsdTon;
  const precioNeto = precioMaizUsdTon - credito;
  const precioAlmidon = precioNeto * factorMaizAlmidon;

  return {
    precio_fob_usc_bu: precioFobUsc,
    precio_fob_usd_ton: precioFobUsdTon,
    precio_maiz_usd_ton: precioMaizUsdTon,
    credito_subproductos: credito,
    precio_neto_maiz: precioNeto,
    precio_almidon_usd_ton: precioAlmidon,
  };
}

// ── Exposicion Natural USD de las formulaciones Super (AKOMEL/CEBES/ALMIDON) ──
// Requiere KG anual manual del usuario. Formula:
//   AKOMEL/CEBES (precio en COP/KG): USD = KG × precio_cop_kg / TRM_global
//   ALMIDON (precio en USD/TON):     USD = KG × precio_usd_ton / 1000
// TRM a usar: params.trm (Xerenity global, se sincroniza con BanRep via
// market_prices al correr fetchExposure).

export function buildSuperFormulaCommodities(params: ExposureParams): CommodityExposure[] {
  const trm = params.trm ?? 1;

  const akomelRes = calcularAkomelCop(params);
  const cebesRes = calcularCebesMc35(params);
  const almidonRes = calcularAlmidon(params);

  const kgGranel = params.kg_akomel_granel_anual ?? 0;
  const kgSL = params.kg_akomel_sl_anual ?? 0;
  const kgSab = params.kg_akomel_sab_anual ?? 0;
  const kgCebes = params.kg_cebes_anual ?? 0;
  const kgAlmidon = params.kg_almidon_anual ?? 0;

  // AKOMEL — suma de los 3 productos derivados
  const expGranel = (kgGranel * akomelRes.precio_akomel_nh_granel) / trm;
  const expSL = (kgSL * akomelRes.precio_akomel_nh_sl_caja15) / trm;
  const expSab = (kgSab * akomelRes.precio_akomel_nh_sab_caja15) / trm;
  const expAkomelTotal = expGranel + expSL + expSab;
  const kgAkomelTotal = kgGranel + kgSL + kgSab;

  // CEBES
  const expCebes = (kgCebes * cebesRes.precio_cebes_mc35) / trm;

  // ALMIDON (precio ya en USD/TON, no necesita TRM)
  const expAlmidon = (kgAlmidon * almidonRes.precio_almidon_usd_ton) / 1000;

  return [
    {
      nombre: 'AKOMEL',
      exchange: 'Formulación',
      unidad_cotizacion: 'COP/KG',
      proyeccion_tons: kgAkomelTotal / 1000,
      tons_reales: kgAkomelTotal / 1000,
      num_contratos: 0,
      precio_unitario: kgAkomelTotal > 0 ? (expAkomelTotal * trm) / kgAkomelTotal : 0,
      exposicion_usd: expAkomelTotal,
      ton_total: kgAkomelTotal / 1000,
      precio_por_ton: kgAkomelTotal > 0 ? (expAkomelTotal / (kgAkomelTotal / 1000)) : 0,
      precio_futuro: null,
      detalle: {
        kg_granel: kgGranel,
        kg_sl: kgSL,
        kg_sab: kgSab,
        exp_granel: expGranel,
        exp_sl: expSL,
        exp_sab: expSab,
        precio_granel: akomelRes.precio_akomel_nh_granel,
        precio_sl: akomelRes.precio_akomel_nh_sl_caja15,
        precio_sab: akomelRes.precio_akomel_nh_sab_caja15,
      },
    },
    {
      nombre: 'CEBES_MC35',
      exchange: 'Formulación',
      unidad_cotizacion: 'COP/KG',
      proyeccion_tons: kgCebes / 1000,
      tons_reales: kgCebes / 1000,
      num_contratos: 0,
      precio_unitario: cebesRes.precio_cebes_mc35,
      exposicion_usd: expCebes,
      ton_total: kgCebes / 1000,
      precio_por_ton: kgCebes > 0 ? expCebes / (kgCebes / 1000) : 0,
      precio_futuro: null,
      detalle: {
        kg: kgCebes,
        precio_cop_kg: cebesRes.precio_cebes_mc35,
      },
    },
    {
      nombre: 'ALMIDON',
      exchange: 'Formulación',
      unidad_cotizacion: 'USD/TON',
      proyeccion_tons: kgAlmidon / 1000,
      tons_reales: kgAlmidon / 1000,
      num_contratos: 0,
      precio_unitario: almidonRes.precio_almidon_usd_ton,
      exposicion_usd: expAlmidon,
      ton_total: kgAlmidon / 1000,
      precio_por_ton: almidonRes.precio_almidon_usd_ton,
      precio_futuro: null,
      detalle: {
        kg: kgAlmidon,
        precio_usd_ton: almidonRes.precio_almidon_usd_ton,
      },
    },
  ];
}

// ── CAFE — Cobertura (modelo El Embrujo) ──
//
// Calculadora de cobertura de cafe basada en el modelo de El Embrujo.
// Empresa compra cafe al caficultor en COP (FNC fija precio interno desde KC)
// y lo vende al exterior en USD. El margen vive del spread de primas (Prima_exp
// vs Prima_FNC × FR) y se ve afectado por descalce temporal de KC y TRM.
//
// Constante: 1 carga = 125 kg = 275.578 lb (LB_CARGA = 125 / 0.453592)

export const LB_CARGA = 125 / 0.453592;

export interface CoberturaCafeResult {
  // Inputs efectivos (con defaults aplicados)
  kc_compra: number;
  kc_venta: number;
  prima_fnc: number;
  prima_exp: number;
  trm_compra: number;
  trm_venta: number;
  fr: number;
  cargas: number;
  // Outputs principales
  p_compra_cop_carga: number;
  p_venta_cop_carga: number;
  margen_cop_carga: number;
  margen_pct: number;
  utilidad_total_cop: number;
  utilidad_total_usd: number;
  descalce_trm: number;       // TRM_venta − TRM_compra
  descalce_kc: number;        // KC_venta − KC_compra
  // Exposicion total del negocio (volumen × precio)
  total_compra_cop: number;   // cargas × p_compra (egreso al caficultor)
  total_venta_cop: number;    // cargas × p_venta (ingreso del exportador)
  total_venta_usd: number;    // total_venta_cop / TRM_venta
  total_kg: number;           // cargas × 125
  total_lb: number;           // cargas × LB_CARGA
  // Sensibilidades (Δ margen vs base, COP/carga)
  delta_kc_minus_10pct: number;
  delta_trm_compra_minus_200: number;
  delta_trm_venta_minus_200: number;
  delta_prima_exp_plus_5: number;
  // Curva sensibilidad TRM compra (rango 2800-4600)
  curva: Array<{ trm: number; sin_descalce: number; trm_venta_fija: number }>;
}

export function calcularCoberturaCafe(params: ExposureParams): CoberturaCafeResult {
  const kc = params.precio_cafe_cent_lb ?? 0;
  const kcv = params.kc_venta_cafe_cent_lb ?? kc;
  const pfnc = params.prima_fnc_cent_lb ?? 0;
  const pexp = params.prima_exp_cent_lb ?? 0;
  const trmc = params.trm_compra_cafe ?? params.trm ?? 0;
  const trmv = params.trm_venta_cafe ?? trmc;
  const fr = params.factor_rendimiento_cafe ?? 0.94;
  const cargas = params.cargas_cafe_anual ?? 0;

  const pCompra = (kc + pfnc) * 0.01 * trmc * LB_CARGA * fr;
  const pVenta = (kcv + pexp) * 0.01 * trmv * LB_CARGA;
  const margen = pVenta - pCompra;
  const margenPct = pVenta > 0 ? (margen / pVenta) * 100 : 0;
  const utilidadCop = margen * cargas;
  const utilidadUsd = trmv > 0 ? utilidadCop / trmv : 0;

  // Sensibilidades — choque individual manteniendo lo demas constante
  const kc10 = kc * 0.9;
  const pc10 = (kc10 + pfnc) * 0.01 * trmc * LB_CARGA * fr;
  const pv10 = (kc10 + pexp) * 0.01 * trmv * LB_CARGA;
  const deltaKcMinus10pct = (pv10 - pc10) - margen;

  const pcT = (kc + pfnc) * 0.01 * (trmc - 200) * LB_CARGA * fr;
  const deltaTrmCompraMinus200 = (pVenta - pcT) - margen;

  const pvT = (kcv + pexp) * 0.01 * (trmv - 200) * LB_CARGA;
  const deltaTrmVentaMinus200 = (pvT - pCompra) - margen;

  const pv5 = (kcv + pexp + 5) * 0.01 * trmv * LB_CARGA;
  const deltaPrimaExpPlus5 = (pv5 - pCompra) - margen;

  // Curva sensibilidad TRM compra (rango 2800-4600, 19 puntos)
  const curva: Array<{ trm: number; sin_descalce: number; trm_venta_fija: number }> = [];
  for (let i = 0; i <= 18; i += 1) {
    const t = 2800 + (4600 - 2800) * i / 18;
    const pcT2 = (kc + pfnc) * 0.01 * t * LB_CARGA * fr;
    curva.push({
      trm: Math.round(t),
      sin_descalce: Math.round((kc + pexp) * 0.01 * t * LB_CARGA - pcT2),
      trm_venta_fija: Math.round((kc + pexp) * 0.01 * trmv * LB_CARGA - pcT2),
    });
  }

  return {
    kc_compra: kc,
    kc_venta: kcv,
    prima_fnc: pfnc,
    prima_exp: pexp,
    trm_compra: trmc,
    trm_venta: trmv,
    fr,
    cargas,
    p_compra_cop_carga: pCompra,
    p_venta_cop_carga: pVenta,
    margen_cop_carga: margen,
    margen_pct: margenPct,
    utilidad_total_cop: utilidadCop,
    utilidad_total_usd: utilidadUsd,
    descalce_trm: trmv - trmc,
    descalce_kc: kcv - kc,
    total_compra_cop: pCompra * cargas,
    total_venta_cop: pVenta * cargas,
    total_venta_usd: trmv > 0 ? (pVenta * cargas) / trmv : 0,
    total_kg: cargas * 125,
    total_lb: cargas * LB_CARGA,
    delta_kc_minus_10pct: deltaKcMinus10pct,
    delta_trm_compra_minus_200: deltaTrmCompraMinus200,
    delta_trm_venta_minus_200: deltaTrmVentaMinus200,
    delta_prima_exp_plus_5: deltaPrimaExpPlus5,
    curva,
  };
}

// ── Total Exposure ──

export function calcularExposicionTotal(
  params: ExposureParams,
  opts?: { includeSuperFormulas?: boolean },
): ExposureResult {
  const precioCocoa = params.precio_cocoa_usd_ton ?? 0;

  const azucar = calcularAzucar(params);
  const maiz = calcularMaiz(params);

  const cocoaPolvo = calcularCocoaDerivado(
    { nombre: 'COCOA_POLVO', proyeccion: params.proyeccion_cocoa_polvo ?? [], factor: params.factor_cocoa_polvo ?? 1.22 },
    precioCocoa,
  );
  const manteca = calcularCocoaDerivado(
    { nombre: 'MANTECA_CACAO', proyeccion: params.proyeccion_manteca ?? [], factor: params.factor_manteca ?? 1.95 },
    precioCocoa,
  );
  const licor = calcularCocoaDerivado(
    { nombre: 'LICOR_CACAO', proyeccion: params.proyeccion_licor ?? [], factor: params.factor_licor ?? 1.53 },
    precioCocoa,
  );

  const empaque = calcularEmpaque(params);

  const commodities: CommodityExposure[] = [azucar, maiz, cocoaPolvo, manteca, licor, empaque];

  // Super de Alimentos: agregar las 3 formulaciones nuevas (AKOMEL, CEBES, ALMIDON)
  // con sus exposiciones USD basadas en KG anuales del usuario.
  if (opts?.includeSuperFormulas) {
    commodities.push(...buildSuperFormulaCommodities(params));
  }

  const totalCommoditiesUsd = commodities.reduce((s, c) => s + c.exposicion_usd, 0);

  const ventasIntl = params.ventas_intl_usd ?? 0;
  const ventasCo = params.ventas_co_usd ?? 0;
  const ventasPe = params.ventas_pe_usd ?? 0;

  return {
    commodities,
    total_commodities_usd: totalCommoditiesUsd,
    exposicion_real_usd: ventasIntl - totalCommoditiesUsd,
    ventas_intl_usd: ventasIntl,
    ventas_co_usd: ventasCo,
    ventas_pe_usd: ventasPe,
    market_prices: {}, // populated by caller with DB prices
  };
}
