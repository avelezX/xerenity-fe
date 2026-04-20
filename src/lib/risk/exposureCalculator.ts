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
const CONV_BU_TON = 0.3936825; // combined factor: cents/bu → USD/ton (= 1/(100×0.0254))
const TON_PER_BUSHEL = 0.0254; // 1 bushel de maiz = 0.0254 toneladas
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
  const precioUsdTon = precioCentBu * CONV_BU_TON; // CONV_BU_TON ya combina cents→USD × bu→ton
  const precioCentTon = precioUsdTon * 100;
  const precioNet = (params.flete_usd_ton ?? 0) + precioUsdTon;
  const creditoSubproductos = precioNet * CREDITO_PCT;
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

// ── Total Exposure ──

export function calcularExposicionTotal(params: ExposureParams): ExposureResult {
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

  const commodities = [azucar, maiz, cocoaPolvo, manteca, licor, empaque];
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
