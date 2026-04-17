import type { TestCase } from '../types';

const chartTests: TestCase[] = [
  {
    id: 'C1',
    category: 'chart',
    name: 'Graficar USDCOP del mes',
    description: 'El agente debe consultar datos de USD:COP y generar un line chart',
    turns: [
      {
        userMessage: 'Como ha estado el dolar este mes? Muestrame una grafica',
        expectedTools: [
          {
            tool: 'query_database',
            sqlContains: ['USD:COP', 'currency'],
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
  {
    id: 'C2',
    category: 'chart',
    name: 'Comparar IBR vs politica monetaria',
    description: 'El agente debe consultar ambas series y generar un chart con al menos 2 series',
    turns: [
      {
        userMessage: 'Comparame la IBR a 1 ano contra la tasa de politica monetaria del ultimo ano en una grafica',
        expectedTools: [
          {
            tool: 'query_database',
          },
          {
            tool: 'generate_chart',
            minSeries: 2,
          },
        ],
      },
    ],
  },
  {
    id: 'C3',
    category: 'chart',
    name: 'Curva de rendimientos TES',
    description: 'El agente debe consultar yields de TES y graficar la curva',
    turns: [
      {
        userMessage: 'Muestrame la curva de rendimientos de TES de hoy en una grafica',
        expectedTools: [
          {
            tool: 'query_database',
            sqlContains: ['tes'],
          },
          {
            tool: 'generate_chart',
            minSeries: 1,
          },
        ],
      },
    ],
  },
];

export default chartTests;
