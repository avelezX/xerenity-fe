import type Anthropic from '@anthropic-ai/sdk';

const VALID_PATHS = [
  '/dashboard', '/suameca', '/loans', '/xccy-swap', '/ibr-swap',
  '/ndf-pricer', '/tes', '/tes-portfolio', '/coltes-calculator',
  '/series', '/inflation', '/us-rates', '/portfolio',
  '/risk-management', '/risk-resumen', '/marks', '/monedas-dashboard',
  '/par-monedas', '/tasas', '/copndf', '/fic', '/peru', '/chile',
  '/admin', '/settings',
];

export { VALID_PATHS };

export const tools: Anthropic.Tool[] = [
  {
    name: 'query_database',
    description:
      'Ejecuta una query SQL de solo lectura (SELECT) contra la base de datos de Xerenity. ' +
      'Usa los schemas: xerenity, loans, trading. Siempre incluye LIMIT (max 500). ' +
      'Retorna los resultados como array JSON.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sql: {
          type: 'string',
          description: 'Query SQL SELECT a ejecutar. Solo SELECT permitido.',
        },
        explanation: {
          type: 'string',
          description: 'Breve explicacion de que hace la query y por que.',
        },
      },
      required: ['sql', 'explanation'],
    },
  },
  {
    name: 'generate_chart',
    description:
      'Genera un grafico a partir de datos. Usa esto DESPUES de obtener datos con query_database. ' +
      'El frontend renderiza el grafico con Recharts.',
    input_schema: {
      type: 'object' as const,
      properties: {
        chart_type: {
          type: 'string',
          enum: ['line', 'bar', 'area'],
          description: 'Tipo de grafico: line, bar, o area.',
        },
        title: {
          type: 'string',
          description: 'Titulo del grafico.',
        },
        x_axis_key: {
          type: 'string',
          description: 'Nombre del campo a usar en el eje X (ej: "fecha", "day", "time").',
        },
        series: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              data_key: {
                type: 'string',
                description: 'Campo de los datos a graficar.',
              },
              name: {
                type: 'string',
                description: 'Nombre de la serie para la leyenda.',
              },
              color: {
                type: 'string',
                description: 'Color hex (ej: "#4F46E5"). Opcional.',
              },
            },
            required: ['data_key', 'name'],
          },
          description: 'Series de datos a graficar.',
        },
        data: {
          type: 'array',
          items: { type: 'object' },
          description: 'Array de objetos con los datos a graficar.',
        },
      },
      required: ['chart_type', 'title', 'x_axis_key', 'series', 'data'],
    },
  },
  {
    name: 'navigate_to',
    description:
      'Navega al usuario a una seccion especifica de Xerenity. ' +
      'Solo paths validos: /dashboard, /loans, /xccy-swap, /ibr-swap, /ndf-pricer, ' +
      '/tes, /tes-portfolio, /series, /inflation, /us-rates, /portfolio, ' +
      '/risk-management, /risk-resumen, /marks, /monedas-dashboard, /par-monedas, ' +
      '/tasas, /copndf, /fic, /peru, /chile, /admin, /settings, /suameca, /coltes-calculator.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Path de la pagina destino (ej: "/loans").',
        },
        description: {
          type: 'string',
          description: 'Descripcion de a donde se navega.',
        },
      },
      required: ['path', 'description'],
    },
  },
  {
    name: 'create_position',
    description:
      'Crea una posicion de trading. SIEMPRE pide confirmacion al usuario antes de ejecutar. ' +
      'Tipos: xccy (Cross-Currency Swap), ndf (Non-Deliverable Forward), ' +
      'ibr_swap (IBR Interest Rate Swap), tes (TES Bond).',
    input_schema: {
      type: 'object' as const,
      properties: {
        position_type: {
          type: 'string',
          enum: ['xccy', 'ndf', 'ibr_swap', 'tes'],
          description: 'Tipo de posicion a crear.',
        },
        params: {
          type: 'object',
          description:
            'Parametros de la posicion. Varian por tipo:\n' +
            '- ndf: { label, counterparty, notional_usd, strike, maturity_date, direction }\n' +
            '- xccy: { label, counterparty, notional_usd, start_date, maturity_date, usd_spread_bps, cop_spread_bps, pay_usd, fx_initial, payment_frequency }\n' +
            '- ibr_swap: { label, counterparty, notional, start_date, maturity_date, fixed_rate, pay_fixed, spread_bps, payment_frequency }\n' +
            '- tes: { label, tes_name, notional, yield_pct, direction }',
        },
      },
      required: ['position_type', 'params'],
    },
  },
  {
    name: 'create_loan',
    description:
      'Crea un prestamo nuevo. SIEMPRE pide confirmacion al usuario antes de ejecutar. ' +
      'Tipos de prestamo: fija (tasa fija), ibr (indexado a IBR), uvr (indexado a UVR).',
    input_schema: {
      type: 'object' as const,
      properties: {
        params: {
          type: 'object',
          description:
            'Parametros del prestamo:\n' +
            '{ type (fija|ibr|uvr), start_date, number_of_payments, original_balance, ' +
            'periodicity, interest_rate, days_count, bank, loan_identifier, ' +
            'grace_type (opcional), grace_period (opcional) }',
        },
      },
      required: ['params'],
    },
  },
  {
    name: 'view_series',
    description:
      'Carga series en el graficador profesional de Xerenity (SUAMECA). ' +
      'Las series se agregan al grafico actual sin perder las que ya estan. ' +
      'Primero busca tickers con query_database en xerenity.search_mv, ' +
      'luego usa este tool con los tickers y nombres encontrados.',
    input_schema: {
      type: 'object' as const,
      properties: {
        tickers: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array de tickers de series (ej: ["a87ff679a2f3e71d9181a67b7542122c"]). Maximo 5.',
        },
        names: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array de display_name correspondientes a cada ticker (ej: ["PIB Total"]). Mismo orden que tickers.',
        },
        description: {
          type: 'string',
          description: 'Descripcion breve de que series se van a mostrar.',
        },
      },
      required: ['tickers', 'names', 'description'],
    },
  },
  {
    name: 'read_repo_file',
    description:
      'Lee el contenido de un archivo del repositorio xerenity-dm (donde viven los collectors). ' +
      'SOLO disponible para usuarios con role=super_admin. Solo permite lectura. ' +
      'Usalo cuando estes debuggeando un fallo de un collector y necesites ver el codigo fuente. ' +
      'Path debe ser relativo al root del repo (ej: "run_collect_trm.py", "data_collectors/coffee/fnc.py"). ' +
      'No se permiten paths con ".." ni absolutos.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Path relativo desde el root de xerenity-dm. Ej: "run_collect_trm.py".',
        },
        explanation: {
          type: 'string',
          description: 'Por que necesitas leer este archivo (1 oracion).',
        },
      },
      required: ['path', 'explanation'],
    },
  },
  {
    name: 'control_chart',
    description:
      'Controla el graficador actual: cambiar periodo, normalizar, limpiar, o quitar series. ' +
      'Usa este tool para ajustar la visualizacion del grafico que el usuario ya tiene abierto.',
    input_schema: {
      type: 'object' as const,
      properties: {
        action: {
          type: 'string',
          enum: ['set_period', 'normalize', 'clear', 'remove_series'],
          description:
            'Accion a ejecutar:\n' +
            '- set_period: Cambiar el rango de tiempo del grafico\n' +
            '- normalize: Activar/desactivar normalizacion (util para comparar series de escalas diferentes)\n' +
            '- clear: Limpiar todas las series del grafico\n' +
            '- remove_series: Quitar una serie especifica del grafico',
        },
        period: {
          type: 'string',
          enum: ['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', '3Y', '5Y', '10Y'],
          description: 'Periodo de tiempo (solo para action=set_period).',
        },
        normalize: {
          type: 'boolean',
          description: 'true para activar, false para desactivar (solo para action=normalize).',
        },
        ticker: {
          type: 'string',
          description: 'Ticker de la serie a quitar (solo para action=remove_series).',
        },
      },
      required: ['action'],
    },
  },
  {
    name: 'list_data_catalog',
    description:
      'Devuelve el inventario de TODAS las tablas de datos registradas en el catálogo de Xerenity. ' +
      'Para cada tabla incluye: nombre, label, categoría, país, fuentes (collectors writing), ' +
      'número de consumers que la leen, número de slice values documentados, descripción, y ' +
      'flag is_critical. Usar este tool ANTES de query_database cuando el usuario pregunta sobre ' +
      'qué datos tiene Xerenity, o para descubrir qué tabla contiene cierta serie.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'describe_table',
    description:
      'Devuelve la descripción completa de una tabla específica del catálogo de Xerenity: ' +
      'meta (label, descripción, categoría, país, columna fecha, columna slice), columnas con ' +
      'tipos + labels + units, y diccionario de valores de slice (qué significa cada valor único ' +
      'del slice_column). Usar este tool DESPUÉS de list_data_catalog cuando ya identificaste la ' +
      'tabla de interés y necesitas detalles para construir queries SQL acertadas.',
    input_schema: {
      type: 'object' as const,
      properties: {
        table_name: {
          type: 'string',
          description: 'Nombre exacto de la tabla en el schema xerenity. Ej: "currency", "tes_operation", "cb_rates".',
        },
      },
      required: ['table_name'],
    },
  },
  {
    name: 'find_and_chart_series',
    description:
      'Una sola llamada: busca series por nombre/concepto (NL), trae los datos y devuelve un grafico listo para mostrar inline en el chat. ' +
      'Usar este tool cuando el usuario pide "muestrame X", "graficame Y", "como va Z", "comparame X vs Y". ' +
      'Combina resolve_query (hybrid: literal + alias + trgm + FTS + semantic) + query_series en un solo round-trip. ' +
      'Soporta multi-serie: pasa hasta 5 queries en `queries` para graficar en el mismo eje (joined por fecha). ' +
      'Solo super_admin (MVP). Si el usuario NO es super_admin, este tool falla — usar query_database manual entonces.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Una sola serie. Ej: "IBR 3M". Usar este O queries — no ambos.',
        },
        queries: {
          type: 'array',
          items: { type: 'string' },
          description: 'Hasta 5 series para graficar juntas (comparacion). Ej: ["IBR 3M", "SOFR 3M"]. Si pasas esto, ignora "query".',
        },
        period_days: {
          type: 'number',
          description: 'Rango de dias hacia atras desde hoy. Default 365. Si el usuario pide "hoy" pasa 1, "ultima semana" pasa 7, "ultimo mes" pasa 30, "ultimo ano" pasa 365.',
        },
        chart_type: {
          type: 'string',
          enum: ['line', 'bar', 'area'],
          description: 'Tipo de grafico. Default "line".',
        },
      },
    },
  },
  {
    name: 'describe_lineage',
    description:
      'Devuelve el lineage (linaje) de una tabla: qué collectors la pueblan (writers) y qué ' +
      'consumers la leen (readers, e.g. páginas del FE, agente IA, pysdk). Útil para responder ' +
      '"¿de dónde viene esta data?" o "¿quién depende de esta tabla?". ' +
      'Cada writer incluye: nombre, source_name, cron, expected_frequency, severity, enabled. ' +
      'Cada reader incluye: nombre, consumer_type (fe_page/agent_tool/sdk/etc), path, label, enabled.',
    input_schema: {
      type: 'object' as const,
      properties: {
        table_name: {
          type: 'string',
          description: 'Nombre exacto de la tabla en el schema xerenity.',
        },
      },
      required: ['table_name'],
    },
  },
];
