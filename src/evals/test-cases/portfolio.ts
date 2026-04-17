import type { TestCase } from '../types';

const portfolioTests: TestCase[] = [
  {
    id: 'P1',
    category: 'portfolio',
    name: 'Crear posicion NDF',
    description: 'El agente debe pedir confirmacion y luego crear una posicion NDF con los parametros correctos',
    turns: [
      {
        userMessage: 'Agrega una posicion NDF con label "NDF Jun26", contraparte Bancolombia, 1 millon de dolares, strike 4200, vencimiento junio 2026, direccion compra',
        expectedTools: [],
        expectedText: {
          mustConfirm: true,
          contains: ['NDF'],
        },
        confirmAfterResponse: true,
      },
      {
        userMessage: 'Si, confirmo. Procede a crear la posicion NDF con todos esos parametros.',
        expectedTools: [
          {
            tool: 'create_position',
            positionType: 'ndf',
            inputContains: {
              position_type: 'ndf',
            },
            inputMatches: {
              'params.notional_usd': '1000000',
              'params.strike': '4200',
            },
          },
        ],
      },
    ],
  },
  {
    id: 'P2',
    category: 'portfolio',
    name: 'Crear posicion XCCY Swap',
    description: 'El agente debe crear un cross-currency swap con parametros correctos',
    turns: [
      {
        userMessage: 'Crea un XCCY swap con label "XCCY 3Y", contraparte JPMorgan, 5 millones USD, inicio hoy, vencimiento en 3 anos, spread USD 50 bps, COP spread 0, FX inicial 4100, pay USD, frecuencia trimestral',
        expectedTools: [],
        expectedText: {
          mustConfirm: true,
          contains: ['XCCY'],
        },
        confirmAfterResponse: true,
      },
      {
        userMessage: 'Si, confirmo. Crea el XCCY swap.',
        expectedTools: [
          {
            tool: 'create_position',
            positionType: 'xccy',
            inputContains: {
              position_type: 'xccy',
            },
            inputMatches: {
              'params.notional_usd': '5000000',
            },
          },
        ],
      },
    ],
  },
  {
    id: 'P3',
    category: 'portfolio',
    name: 'Crear posicion IBR Swap',
    description: 'El agente debe crear un IBR swap con parametros correctos',
    turns: [
      {
        userMessage: 'Incluye un IBR swap con label "IBR 2Y", contraparte Banco de Bogota, nocional 10 mil millones COP, tasa fija 9.5%, plazo 2 anos, pago trimestral, pay fixed',
        expectedTools: [],
        expectedText: {
          mustConfirm: true,
          contains: ['IBR'],
        },
        confirmAfterResponse: true,
      },
      {
        userMessage: 'Si, confirmo. Crea el IBR swap.',
        expectedTools: [
          {
            tool: 'create_position',
            positionType: 'ibr_swap',
            inputContains: {
              position_type: 'ibr_swap',
            },
            inputMatches: {
              'params.notional': '10000000000',
            },
          },
        ],
      },
    ],
  },
];

export default portfolioTests;
