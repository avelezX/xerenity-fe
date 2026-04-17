import type { TestCase } from '../types';
import portfolioTests from './portfolio';
import chartTests from './charts';
import queryTests from './queries';
import navigationTests from './navigation';
import multiTurnTests from './multi-turn';

const allTestCases: TestCase[] = [
  ...portfolioTests,
  ...chartTests,
  ...queryTests,
  ...navigationTests,
  ...multiTurnTests,
];

export default allTestCases;

export function getTestsByCategory(category: string): TestCase[] {
  return allTestCases.filter((t) => t.category === category);
}

export function getTestById(id: string): TestCase | undefined {
  return allTestCases.find((t) => t.id === id);
}
