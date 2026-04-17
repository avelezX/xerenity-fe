import type { TestCase } from '../types';

const navigationTests: TestCase[] = [
  {
    id: 'N1',
    category: 'navigation',
    name: 'Navegar al portafolio',
    description: 'El agente debe usar navigate_to con path /portfolio',
    turns: [
      {
        userMessage: 'Llevame al portafolio',
        expectedTools: [
          {
            tool: 'navigate_to',
            expectedPath: '/portfolio',
          },
        ],
      },
    ],
  },
  {
    id: 'N2',
    category: 'navigation',
    name: 'Navegar a swaps',
    description: 'El agente debe navegar a xccy-swap o ibr-swap',
    turns: [
      {
        userMessage: 'Quiero ver los swaps de moneda',
        expectedTools: [
          {
            tool: 'navigate_to',
            inputMatches: {
              path: '/(xccy-swap|ibr-swap)',
            },
          },
        ],
      },
    ],
  },
];

export default navigationTests;
