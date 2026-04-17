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
];
