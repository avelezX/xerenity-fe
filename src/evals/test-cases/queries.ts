import type { TestCase } from '../types';

const queryTests: TestCase[] = [
  {
    id: 'Q1',
    category: 'query',
    name: 'Consultar TRM hoy',
    description: 'El agente debe consultar el valor mas reciente de USD:COP',
    turns: [
      {
        userMessage: 'Cual es la TRM hoy?',
        expectedTools: [
          {
            tool: 'query_database',
            sqlContains: ['USD:COP'],
            sqlPattern: 'ORDER BY.*DESC',
          },
        ],
      },
    ],
  },
  {
    id: 'Q2',
    category: 'query',
    name: 'Contar posiciones NDF',
    description: 'El agente debe consultar las posiciones NDF del portafolio',
    turns: [
      {
        userMessage: 'Cuantas posiciones NDF tenemos en el portafolio?',
        expectedTools: [
          {
            tool: 'query_database',
            sqlContains: ['ndf_position'],
          },
        ],
      },
    ],
  },
  {
    id: 'Q3',
    category: 'query',
    name: 'Consultar IBR overnight',
    description: 'El agente debe consultar la tasa IBR overnight',
    turns: [
      {
        userMessage: 'Dame la tasa IBR overnight de hoy',
        expectedTools: [
          {
            tool: 'query_database',
            sqlContains: ['ibr'],
          },
        ],
      },
    ],
  },
];

export default queryTests;
