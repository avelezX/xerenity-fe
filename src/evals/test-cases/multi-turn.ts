import type { TestCase } from '../types';

const multiTurnTests: TestCase[] = [
  {
    id: 'M1',
    category: 'multi-turn',
    name: 'Consulta + grafica en 2 turnos',
    description: 'Turno 1: consultar TRM. Turno 2: graficar el ultimo mes basandose en el contexto previo',
    turns: [
      {
        userMessage: 'Cual es la TRM hoy?',
        expectedTools: [
          {
            tool: 'query_database',
            sqlContains: ['USD:COP'],
          },
        ],
      },
      {
        userMessage: 'Ahora graficamela del ultimo mes',
        expectedTools: [
          {
            tool: 'query_database',
          },
          {
            tool: 'generate_chart',
            chartType: 'line',
            minSeries: 1,
          },
        ],
      },
    ],
  },
];

export default multiTurnTests;
