CREATE MATERIALIZED VIEW xerenity.search_mv AS

-- FIC
SELECT fic_subq.ticker, fic_subq.source_name, fic_subq.grupo, fic_subq.display_name,
       fic_subq.function_name, fic_subq.column_to_use, fic_subq.description, fic_subq.fuente,
       fic_subq.sub_group, fic_subq.entidad, fic_subq.activo, fic_subq.tipo_fondo,
       fic_subq.clase_activo, fic_subq.tamano_fondo, fic_subq.tamano_inversionistas, fic_subq.apertura
FROM (
  SELECT DISTINCT ON (fic_v3.series_id)
    md5(fic_v3.series_id) AS ticker,
    fic_v3.series_id AS source_name,
    'FIC'::text AS grupo,
    concat(fic_v3.nombre_patrimonio, ' Tipo de participacion: ', fic_v3.tipo_participacion) AS display_name,
    'read_fic'::text AS function_name,
    'valor_unidad_operaciones'::text AS column_to_use,
    concat(fic_v3.nombre_entidad, ' - ', fic_v3.nombre_subtipo_patrimonio) AS description,
    'gov.co'::text AS fuente,
    fic_v3.nombre_subtipo_patrimonio AS sub_group,
    fic_v3.nombre_entidad AS entidad,
    fic_v3.fecha_corte >= (CURRENT_DATE - 90) AS activo,
    CASE WHEN fic_v3.nombre_subtipo_patrimonio = ANY (ARRAY['FIC Inmobiliarias','Fondos De Capital Privado']) THEN 'Cerrado' ELSE 'Abierto' END AS tipo_fondo,
    CASE
      WHEN fic_v3.nombre_subtipo_patrimonio = 'FIC Bursatiles' THEN 'Renta Variable'
      WHEN fic_v3.nombre_subtipo_patrimonio = 'FIC De Mercado Monetario' THEN 'Mercado Monetario'
      WHEN fic_v3.nombre_subtipo_patrimonio = 'FIC Inmobiliarias' THEN 'Inmobiliario'
      WHEN fic_v3.nombre_subtipo_patrimonio = 'Fondos De Capital Privado' THEN 'Capital Privado'
      WHEN lower(fic_v3.nombre_patrimonio) ~~ '%renta variable%' THEN 'Renta Variable'
      WHEN lower(fic_v3.nombre_patrimonio) ~~ '%acciones%' THEN 'Renta Variable'
      WHEN lower(fic_v3.nombre_patrimonio) ~~ '%aic -%' THEN 'Renta Variable'
      WHEN lower(fic_v3.nombre_patrimonio) ~~ '%colcap%' THEN 'Renta Variable'
      WHEN lower(fic_v3.nombre_patrimonio) ~~ '%equity%' THEN 'Renta Variable'
      WHEN lower(fic_v3.nombre_patrimonio) ~~ '%renta fija%' THEN 'Renta Fija'
      WHEN lower(fic_v3.nombre_patrimonio) ~~ '%bonos%' THEN 'Renta Fija'
      WHEN lower(fic_v3.nombre_patrimonio) ~~ '%deuda%' THEN 'Renta Fija'
      WHEN lower(fic_v3.nombre_patrimonio) ~~ '%credit%' THEN 'Renta Fija'
      WHEN lower(fic_v3.nombre_patrimonio) ~~ '%factoring%' THEN 'Renta Fija'
      WHEN lower(fic_v3.nombre_patrimonio) ~~ '%facturas%' THEN 'Renta Fija'
      WHEN lower(fic_v3.nombre_patrimonio) ~~ '%alta duracion%' THEN 'Renta Fija'
      WHEN lower(fic_v3.nombre_patrimonio) ~~ '%tes%' THEN 'Renta Fija'
      WHEN lower(fic_v3.nombre_patrimonio) ~~ '%cdt%' THEN 'Renta Fija'
      WHEN lower(fic_v3.nombre_patrimonio) ~~ '%soberano%' THEN 'Renta Fija'
      WHEN lower(fic_v3.nombre_patrimonio) ~~ '%efectivo%' THEN 'Mercado Monetario'
      WHEN lower(fic_v3.nombre_patrimonio) ~~ '%corto plazo%' THEN 'Mercado Monetario'
      WHEN lower(fic_v3.nombre_patrimonio) ~~ '%liquidez%' THEN 'Mercado Monetario'
      WHEN lower(fic_v3.nombre_patrimonio) ~~ '%monetario%' THEN 'Mercado Monetario'
      WHEN lower(fic_v3.nombre_patrimonio) ~~ '%balanceado%' THEN 'Multi-activo'
      WHEN lower(fic_v3.nombre_patrimonio) ~~ '%multiactivo%' THEN 'Multi-activo'
      WHEN lower(fic_v3.nombre_patrimonio) ~~ '%diversificado%' THEN 'Multi-activo'
      WHEN lower(fic_v3.nombre_patrimonio) ~~ '%estructurado%' THEN 'Alternativo'
      ELSE NULL
    END AS clase_activo,
    CASE
      WHEN fic_v3.valor_fondo_cierre_dia_t IS NULL THEN NULL
      WHEN fic_v3.valor_fondo_cierre_dia_t < 50000000000::double precision THEN 'Micro'
      WHEN fic_v3.valor_fondo_cierre_dia_t < 500000000000::double precision THEN 'Pequeño'
      WHEN fic_v3.valor_fondo_cierre_dia_t < 5000000000000::double precision THEN 'Mediano'
      ELSE 'Grande'
    END AS tamano_fondo,
    CASE
      WHEN fic_v3.numero_inversionistas IS NULL THEN NULL
      WHEN fic_v3.numero_inversionistas < 20 THEN 'Institucional'
      WHEN fic_v3.numero_inversionistas < 1000 THEN 'Pequeño'
      WHEN fic_v3.numero_inversionistas < 50000 THEN 'Mediano'
      ELSE 'Masivo'
    END AS tamano_inversionistas,
    CASE
      WHEN lower(fic_v3.nombre_tipo_patrimonio) ~~ '%cerrado%' THEN 'Cerrado'
      WHEN lower(fic_v3.nombre_tipo_patrimonio) ~~ '%pacto%' THEN 'Abierto con pacto'
      WHEN lower(fic_v3.nombre_tipo_patrimonio) ~~ '%abierto%' THEN 'Abierto sin pacto'
      ELSE NULL
    END AS apertura
  FROM xerenity.fic_v3
  ORDER BY fic_v3.series_id, fic_v3.fecha_corte DESC
) fic_subq

UNION ALL

-- Interes Creditos
SELECT DISTINCT md5(interes_creditos.series_id) AS ticker,
  interes_creditos.series_id AS source_name,
  'Tasas de Colocacion' AS grupo,
  concat(interes_creditos.nombre_entidad, ' - ', interes_creditos.tipo_de_credito, ' - ', interes_creditos.plazo_de_credito) AS display_name,
  'read_interes_credito' AS function_name,
  'tasa_efectiva_promedio' AS column_to_use,
  concat('Tasa de Interes Efectiva Promedio', interes_creditos.nombre_entidad, ' - ', interes_creditos.tipo_de_credito, ' - ', interes_creditos.plazo_de_credito) AS description,
  'gov.co' AS fuente,
  interes_creditos.tipo_de_credito AS sub_group,
  NULL::text AS entidad, NULL::boolean AS activo, NULL::text AS tipo_fondo, NULL::text AS clase_activo,
  NULL::text AS tamano_fondo, NULL::text AS tamano_inversionistas, NULL::text AS apertura
FROM xerenity.interes_creditos

UNION ALL

-- IBR
SELECT DISTINCT md5(ibr.name) AS ticker,
  ibr.name AS source_name,
  'IBR-SWAP' AS grupo,
  upper(ibr.name) AS display_name,
  'read_ibr' AS function_name,
  'close' AS column_to_use,
  concat('SWap IBR maduracion: ', upper(right(ibr.name, length(ibr.name) - 4))) AS description,
  'DTCC' AS fuente,
  'IBR-OIS' AS sub_group,
  NULL::text AS entidad, NULL::boolean AS activo, NULL::text AS tipo_fondo, NULL::text AS clase_activo,
  NULL::text AS tamano_fondo, NULL::text AS tamano_inversionistas, NULL::text AS apertura
FROM xerenity.ibr

UNION ALL

-- BanRep
SELECT DISTINCT md5(banrep_serie_v2.id::text) AS ticker,
  banrep_serie_v2.id::text AS source_name,
  banrep_serie_v2.grupo,
  banrep_serie_v2.nombre AS display_name,
  'read_banrep_serie' AS function_name,
  'valor' AS column_to_use,
  banrep_serie_v2.description,
  'BanRep' AS fuente,
  banrep_serie_v2.sub_group,
  NULL::text AS entidad, NULL::boolean AS activo, NULL::text AS tipo_fondo, NULL::text AS clase_activo,
  NULL::text AS tamano_fondo, NULL::text AS tamano_inversionistas, NULL::text AS apertura
FROM xerenity.banrep_serie_v2

UNION ALL

-- TES
SELECT DISTINCT md5(tes.name) AS ticker,
  tes.name AS source_name,
  'COLTES' AS grupo,
  concat('COLTES ', tes.cupon, ' ', tes.maduracion) AS display_name,
  'read_tes' AS function_name,
  'close' AS column_to_use,
  concat('Pais: Colombia - memo: ', tes.memo, '- isin: ', tes.isin, '- emision: ', tes.emision, '- maduracion: ', tes.maduracion) AS description,
  'SEN - BanRep' AS fuente,
  concat('COLTES-', tes.moneda) AS sub_group,
  NULL::text AS entidad, NULL::boolean AS activo, NULL::text AS tipo_fondo, NULL::text AS clase_activo,
  NULL::text AS tamano_fondo, NULL::text AS tamano_inversionistas, NULL::text AS apertura
FROM xerenity.tes

UNION ALL

-- IBR Implicita 1M
SELECT md5('ibr_implicita_1m') AS ticker, 'ibr_implicita_1m' AS source_name,
  'Tasas Implicitas' AS grupo, 'IBR 1M' AS display_name, 'read_ibr_1m' AS function_name,
  'rate' AS column_to_use, 'Tasa forward nominal f(x, 1m).' AS description,
  'Calculos Propios Xerenity.' AS fuente, 'IBR Implicito' AS sub_group,
  NULL::text AS entidad, NULL::boolean AS activo, NULL::text AS tipo_fondo, NULL::text AS clase_activo,
  NULL::text AS tamano_fondo, NULL::text AS tamano_inversionistas, NULL::text AS apertura

UNION ALL

-- IBR Implicita 3M
SELECT md5('ibr_implicita_3m') AS ticker, 'ibr_implicita_3m' AS source_name,
  'Tasas Implicitas' AS grupo, 'IBR 3M' AS display_name, 'read_ibr_3m' AS function_name,
  'rate' AS column_to_use, 'Tasa forward nominal f(x, 3m).' AS description,
  'Calculos Propios Xerenity.' AS fuente, 'IBR Implicito' AS sub_group,
  NULL::text AS entidad, NULL::boolean AS activo, NULL::text AS tipo_fondo, NULL::text AS clase_activo,
  NULL::text AS tamano_fondo, NULL::text AS tamano_inversionistas, NULL::text AS apertura

UNION ALL

-- IBR Implicita 6M
SELECT md5('ibr_implicita_6m') AS ticker, 'ibr_implicita_6m' AS source_name,
  'Tasas Implicitas' AS grupo, 'IBR 6M' AS display_name, 'read_ibr_6m' AS function_name,
  'rate' AS column_to_use, 'Tasa forward nominal f(x, 6m).' AS description,
  'Calculos Propios Xerenity.' AS fuente, 'IBR Implicito' AS sub_group,
  NULL::text AS entidad, NULL::boolean AS activo, NULL::text AS tipo_fondo, NULL::text AS clase_activo,
  NULL::text AS tamano_fondo, NULL::text AS tamano_inversionistas, NULL::text AS apertura

UNION ALL

-- IBR Implicita 12M
SELECT md5('ibr_implicita_12m') AS ticker, 'ibr_implicita_12m' AS source_name,
  'Tasas Implicitas' AS grupo, 'IBR 12M' AS display_name, 'read_ibr_12m' AS function_name,
  'rate' AS column_to_use, 'Tasa forward nominal f(x, 12m).' AS description,
  'Calculos Propios Xerenity.' AS fuente, 'IBR Implicito' AS sub_group,
  NULL::text AS entidad, NULL::boolean AS activo, NULL::text AS tipo_fondo, NULL::text AS clase_activo,
  NULL::text AS tamano_fondo, NULL::text AS tamano_inversionistas, NULL::text AS apertura

UNION ALL

-- UVR Projection
SELECT md5('uvr_projection') AS ticker, 'uvr_projection' AS source_name,
  'Indices de Precios' AS grupo, 'Proyeccion UVR' AS display_name, 'get_uvr_projection' AS function_name,
  'valor' AS column_to_use,
  'Esta es la UVR preyectada. Esta informacion se calcula sacando la inflacion implicita entre los mercados de Tes tasa fija y Tes en UVR. ' AS description,
  'Calculos propios' AS fuente, 'IPC Implicito' AS sub_group,
  NULL::text AS entidad, NULL::boolean AS activo, NULL::text AS tipo_fondo, NULL::text AS clase_activo,
  NULL::text AS tamano_fondo, NULL::text AS tamano_inversionistas, NULL::text AS apertura

UNION ALL

-- TRM
SELECT md5('TRM') AS ticker, 'USD:COP' AS source_name,
  'Divisas' AS grupo, 'Tasa Representativa del Mercado TRM' AS display_name, 'read_trm' AS function_name,
  'value' AS column_to_use, 'Tasa Representativa del Mercado TRM' AS description,
  'Set-Icap' AS fuente, 'Colombia' AS sub_group,
  NULL::text AS entidad, NULL::boolean AS activo, NULL::text AS tipo_fondo, NULL::text AS clase_activo,
  NULL::text AS tamano_fondo, NULL::text AS tamano_inversionistas, NULL::text AS apertura

UNION ALL

-- Canasta (IPC)
SELECT DISTINCT md5(concat(canasta.id::text, '-', canasta.id::text)) AS ticker,
  concat(canasta.id::text, '-', canasta.id::text) AS source_name,
  'Indices de Precios' AS grupo, canasta.nombre AS display_name,
  'read_cpi_index' AS function_name, 'value' AS column_to_use,
  canasta.nombre AS description, 'Dane' AS fuente, 'IPC' AS sub_group,
  NULL::text AS entidad, NULL::boolean AS activo, NULL::text AS tipo_fondo, NULL::text AS clase_activo,
  NULL::text AS tamano_fondo, NULL::text AS tamano_inversionistas, NULL::text AS apertura
FROM xerenity.canasta

UNION ALL

-- Inflacion Implicita
SELECT md5('inflacion_implicita') AS ticker, 'inflacion_implicita' AS source_name,
  'Indices de Precios' AS grupo, 'Inflacion implicta' AS display_name,
  'read_infacion_implicita' AS function_name, 'value' AS column_to_use,
  'Inflacion implicita en la curva de TES' AS description,
  'Calculos Propios Xerenity.' AS fuente, 'IPC Implicito' AS sub_group,
  NULL::text AS entidad, NULL::boolean AS activo, NULL::text AS tipo_fondo, NULL::text AS clase_activo,
  NULL::text AS tamano_fondo, NULL::text AS tamano_inversionistas, NULL::text AS apertura

UNION ALL

-- COP NDF Interpol
SELECT md5('cop_ndf_interpol') AS ticker, 'cop_ndf_interpol' AS source_name,
  'Divisas' AS grupo, 'COP NDF Interpol' AS display_name,
  'cop_ndf_interpol' AS function_name, 'exchange_rate' AS column_to_use,
  'Curva interpolada de los COP NDF en el dia actual' AS description,
  'Calculos Propios Xerenity.' AS fuente, 'COP NDF' AS sub_group,
  NULL::text AS entidad, NULL::boolean AS activo, NULL::text AS tipo_fondo, NULL::text AS clase_activo,
  NULL::text AS tamano_fondo, NULL::text AS tamano_inversionistas, NULL::text AS apertura

UNION ALL

-- Currency
SELECT DISTINCT md5(currency.currency) AS ticker,
  currency.currency AS source_name,
  'Divisas' AS grupo, currency.currency AS display_name,
  'read_currency' AS function_name, 'value' AS column_to_use,
  concat('Tasa de Cambio ', currency.currency) AS description,
  'Set-Icap' AS fuente, 'Colombia' AS sub_group,
  NULL::text AS entidad, NULL::boolean AS activo, NULL::text AS tipo_fondo, NULL::text AS clase_activo,
  NULL::text AS tamano_fondo, NULL::text AS tamano_inversionistas, NULL::text AS apertura
FROM xerenity.currency

UNION ALL

-- Tasa Usura
SELECT DISTINCT md5(tasa_usura.series_id) AS ticker,
  tasa_usura.series_id AS source_name,
  'Tasa de Usura' AS grupo,
  concat('Tasa de usura - Credito ', tasa_usura.series_id) AS display_name,
  'read_usury' AS function_name, 'tasa_usura' AS column_to_use,
  concat('Tasa de usura para credito ', tasa_usura.series_id) AS description,
  'Superfinanciera' AS fuente, tasa_usura.series_id AS sub_group,
  NULL::text AS entidad, NULL::boolean AS activo, NULL::text AS tipo_fondo, NULL::text AS clase_activo,
  NULL::text AS tamano_fondo, NULL::text AS tamano_inversionistas, NULL::text AS apertura
FROM xerenity.tasa_usura

UNION ALL

-- EMBI
SELECT DISTINCT md5(concat('embi', embi.country)) AS ticker,
  embi.country AS source_name,
  'Indices de Riesgo' AS grupo,
  concat('EMBI ', embi.country) AS display_name,
  'read_embi' AS function_name, 'value' AS column_to_use,
  concat('Emerging Markets Bond Index (EMBI) para ', embi.country) AS description,
  'J.P. Morgan' AS fuente, 'EMBI' AS sub_group,
  NULL::text AS entidad, NULL::boolean AS activo, NULL::text AS tipo_fondo, NULL::text AS clase_activo,
  NULL::text AS tamano_fondo, NULL::text AS tamano_inversionistas, NULL::text AS apertura
FROM xerenity.embi

UNION ALL

-- CB Rates
SELECT DISTINCT md5(concat('tcb', cb_rates.nombre)) AS ticker,
  cb_rates.nombre AS source_name,
  'Tasas de Interes' AS grupo,
  concat('TBC ', cb_rates.nombre) AS display_name,
  'read_tcb' AS function_name, 'value' AS column_to_use,
  concat('Tasas de los bancos centrales ', cb_rates.nombre) AS description,
  'BIS' AS fuente, 'Tasas Bancos Centrales' AS sub_group,
  NULL::text AS entidad, NULL::boolean AS activo, NULL::text AS tipo_fondo, NULL::text AS clase_activo,
  NULL::text AS tamano_fondo, NULL::text AS tamano_inversionistas, NULL::text AS apertura
FROM xerenity.cb_rates

UNION ALL

-- SOFR Swaps
SELECT md5(concat('sofr_swap_', t.months::text)) AS ticker,
  concat('sofr_swap_', t.months::text) AS source_name,
  'Tasas USD' AS grupo,
  concat('SOFR Swap ', t.label) AS display_name,
  'read_sofr_swap' AS function_name, 'swap_rate' AS column_to_use,
  concat('SOFR OIS Par Swap Rate - Tenor ', t.label, '. Fuente: Eris Futures (CME Group).') AS description,
  'Eris Futures' AS fuente, 'SOFR Swaps' AS sub_group,
  NULL::text AS entidad, NULL::boolean AS activo, NULL::text AS tipo_fondo, NULL::text AS clase_activo,
  NULL::text AS tamano_fondo, NULL::text AS tamano_inversionistas, NULL::text AS apertura
FROM (VALUES (1,'1M'),(3,'3M'),(6,'6M'),(9,'9M'),(12,'1Y'),(18,'18M'),(24,'2Y'),(36,'3Y'),(48,'4Y'),(60,'5Y'),(72,'6Y'),(84,'7Y'),(96,'8Y'),(108,'9Y'),(120,'10Y'),(144,'12Y'),(180,'15Y'),(240,'20Y'),(300,'25Y'),(360,'30Y'),(480,'40Y'),(600,'50Y')) t(months, label)

UNION ALL

-- UST Nominal
SELECT md5(concat('NOMINAL_', t.months::text)) AS ticker,
  concat('NOMINAL_', t.months::text) AS source_name,
  'Tasas USD' AS grupo,
  concat('UST Nominal ', t.label) AS display_name,
  'read_ust_yield' AS function_name, 'yield_value' AS column_to_use,
  concat('US Treasury Nominal Yield - Tenor ', t.label, '. Fuente: Treasury.gov.') AS description,
  'US Treasury' AS fuente, 'UST Nominal' AS sub_group,
  NULL::text AS entidad, NULL::boolean AS activo, NULL::text AS tipo_fondo, NULL::text AS clase_activo,
  NULL::text AS tamano_fondo, NULL::text AS tamano_inversionistas, NULL::text AS apertura
FROM (VALUES (1,'1M'),(2,'2M'),(3,'3M'),(4,'4M'),(6,'6M'),(12,'1Y'),(24,'2Y'),(36,'3Y'),(60,'5Y'),(84,'7Y'),(120,'10Y'),(240,'20Y'),(360,'30Y')) t(months, label)

UNION ALL

-- UST TIPS
SELECT md5(concat('TIPS_', t.months::text)) AS ticker,
  concat('TIPS_', t.months::text) AS source_name,
  'Tasas USD' AS grupo,
  concat('UST TIPS ', t.label) AS display_name,
  'read_ust_yield' AS function_name, 'yield_value' AS column_to_use,
  concat('US Treasury TIPS Real Yield - Tenor ', t.label, '. Fuente: Treasury.gov.') AS description,
  'US Treasury' AS fuente, 'UST TIPS' AS sub_group,
  NULL::text AS entidad, NULL::boolean AS activo, NULL::text AS tipo_fondo, NULL::text AS clase_activo,
  NULL::text AS tamano_fondo, NULL::text AS tamano_inversionistas, NULL::text AS apertura
FROM (VALUES (60,'5Y'),(84,'7Y'),(120,'10Y'),(240,'20Y'),(360,'30Y')) t(months, label)

UNION ALL

-- US Reference Rates
SELECT md5(t.rate_type) AS ticker,
  t.rate_type AS source_name,
  'Tasas USD' AS grupo,
  t.display AS display_name,
  'read_us_rate' AS function_name, 'rate' AS column_to_use,
  t.descr AS description,
  'NY Fed' AS fuente, 'Reference Rates' AS sub_group,
  NULL::text AS entidad, NULL::boolean AS activo, NULL::text AS tipo_fondo, NULL::text AS clase_activo,
  NULL::text AS tamano_fondo, NULL::text AS tamano_inversionistas, NULL::text AS apertura
FROM (VALUES
  ('SOFR','SOFR (Overnight)','Secured Overnight Financing Rate. Tasa de referencia basada en repos de Treasuries. Fuente: NY Fed.'),
  ('EFFR','EFFR (Fed Funds)','Effective Federal Funds Rate. Tasa interbancaria overnight no colateralizada. Fuente: NY Fed.'),
  ('OBFR','OBFR (Bank Funding)','Overnight Bank Funding Rate. Costo de fondeo overnight para bancos. Fuente: NY Fed.'),
  ('SOFR_AVG_30D','SOFR Promedio 30D','SOFR compounded average 30 dias. Fuente: NY Fed.'),
  ('SOFR_AVG_90D','SOFR Promedio 90D','SOFR compounded average 90 dias. Fuente: NY Fed.'),
  ('SOFR_AVG_180D','SOFR Promedio 180D','SOFR compounded average 180 dias. Fuente: NY Fed.')
) t(rate_type, display, descr)

UNION ALL

-- COP FWD FXEmpire
SELECT md5(concat('cop_fwd_fx_', t.months::text)) AS ticker,
  concat('cop_fwd_fx_', t.months::text) AS source_name,
  'Divisas' AS grupo,
  concat('COP FWD ', t.label) AS display_name,
  'read_cop_fwd_fxempire' AS function_name, 'mid' AS column_to_use,
  concat('COP Forward Rate - Tenor ', t.label, '. Fuente: FXEmpire.') AS description,
  'FXEmpire' AS fuente, 'COP Forwards' AS sub_group,
  NULL::text AS entidad, NULL::boolean AS activo, NULL::text AS tipo_fondo, NULL::text AS clase_activo,
  NULL::text AS tamano_fondo, NULL::text AS tamano_inversionistas, NULL::text AS apertura
FROM (VALUES (0,'Spot'),(1,'1M'),(2,'2M'),(3,'3M'),(6,'6M'),(9,'9M'),(12,'1Y')) t(months, label)

UNION ALL

-- Camacol
SELECT DISTINCT md5(camacol_serie.id::text) AS ticker,
  camacol_serie.id::text AS source_name,
  camacol_serie.grupo,
  camacol_serie.nombre AS display_name,
  'read_camacol_serie' AS function_name, 'valor' AS column_to_use,
  camacol_serie.description,
  'Camacol' AS fuente, camacol_serie.sub_group,
  NULL::text AS entidad, NULL::boolean AS activo, NULL::text AS tipo_fondo, NULL::text AS clase_activo,
  NULL::text AS tamano_fondo, NULL::text AS tamano_inversionistas, NULL::text AS apertura
FROM xerenity.camacol_serie

UNION ALL

-- BCRP (Peru)
SELECT DISTINCT md5(concat('bcrp_', bcrp_serie.id::text)) AS ticker,
  bcrp_serie.id::text AS source_name,
  bcrp_serie.grupo,
  bcrp_serie.nombre AS display_name,
  'read_bcrp_serie' AS function_name, 'valor' AS column_to_use,
  bcrp_serie.description,
  'BCRP' AS fuente, bcrp_serie.sub_group,
  NULL::text AS entidad, NULL::boolean AS activo, NULL::text AS tipo_fondo, NULL::text AS clase_activo,
  NULL::text AS tamano_fondo, NULL::text AS tamano_inversionistas, NULL::text AS apertura
FROM xerenity.bcrp_serie

UNION ALL

-- BCCh (Chile)
SELECT DISTINCT md5(concat('bcch_', c.id_serie)) AS ticker,
  c.id_serie AS source_name,
  'Chile' AS grupo,
  c.descripcion AS display_name,
  'read_bcch_serie' AS function_name,
  'valor' AS column_to_use,
  concat(c.descripcion, ' (', c.unidad, ', ', c.periodicidad, ')') AS description,
  'BCCh' AS fuente,
  c.categoria AS sub_group,
  NULL::text AS entidad,
  c.activa AS activo,
  NULL::text AS tipo_fondo,
  NULL::text AS clase_activo,
  NULL::text AS tamano_fondo,
  NULL::text AS tamano_inversionistas,
  NULL::text AS apertura
FROM xerenity.bcch_series_catalog c;

-- Grant permissions
GRANT SELECT ON xerenity.search_mv TO anon, authenticated;
