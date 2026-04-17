import * as fs from 'fs';
import * as path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import allTestCases, { getTestsByCategory, getTestById } from './test-cases';
import { runTestCase } from './runner';
import { buildReport, printReport, saveReport } from './reporter';
import type { TestCase, TestResult } from './types';

// Simple .env.local parser
function loadEnv(): void {
  const envPath = path.join(__dirname, '../../.env.local');
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex);
    const value = trimmed.slice(eqIndex + 1);
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function parseArgs(): {
  category?: string;
  testId?: string;
  verbose: boolean;
  output?: string;
} {
  const args = process.argv.slice(2);
  const result: ReturnType<typeof parseArgs> = { verbose: false };

  for (let i = 0; i < args.length; i += 1) {
    switch (args[i]) {
      case '--category':
        result.category = args[i + 1];
        i += 1;
        break;
      case '--test':
        result.testId = args[i + 1];
        i += 1;
        break;
      case '--verbose':
        result.verbose = true;
        break;
      case '--output':
        result.output = args[i + 1];
        i += 1;
        break;
      case '--help':
        // eslint-disable-next-line no-console
        console.log(`
Xerenity Agent Eval Runner

Usage: npx tsx src/evals/index.ts [options]

Options:
  --category <name>   Run only one category (portfolio|chart|query|navigation|multi-turn)
  --test <id>         Run a single test by ID (P1, C1, Q1, N1, M1, etc.)
  --verbose           Show raw API responses and tool calls
  --output <path>     Custom path for JSON report
  --help              Show this help

Examples:
  npx tsx src/evals/index.ts                    # Run all 12 tests
  npx tsx src/evals/index.ts --test Q1          # Run just "TRM hoy" test
  npx tsx src/evals/index.ts --category chart   # Run chart tests only
  npx tsx src/evals/index.ts --verbose          # Detailed output
`);
        process.exit(0);
        break;
      default:
        break;
    }
  }

  return result;
}

async function main(): Promise<void> {
  loadEnv();

  const { category, testId, verbose, output } = parseArgs();

  // Validate API key
  if (!process.env.ANTHROPIC_API_KEY) {
    // eslint-disable-next-line no-console
    console.error('Error: ANTHROPIC_API_KEY no esta configurada. Agrega la key a .env.local');
    process.exit(1);
  }

  // Select test cases
  let tests: TestCase[];

  if (testId) {
    const single = getTestById(testId);
    if (!single) {
      // eslint-disable-next-line no-console
      console.error(`Error: Test "${testId}" no encontrado. IDs disponibles: ${allTestCases.map((t) => t.id).join(', ')}`);
      process.exit(1);
    }
    tests = [single];
  } else if (category) {
    tests = getTestsByCategory(category);
    if (tests.length === 0) {
      // eslint-disable-next-line no-console
      console.error(`Error: Categoria "${category}" no tiene tests. Categorias: portfolio, chart, query, navigation, multi-turn`);
      process.exit(1);
    }
  } else {
    tests = allTestCases;
  }

  // eslint-disable-next-line no-console
  console.log(`\nRunning ${tests.length} eval(s)...\n`);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const results: TestResult[] = [];
  const startTime = Date.now();

  for (const testCase of tests) {
    if (verbose) {
      // eslint-disable-next-line no-console
      console.log(`\n--- ${testCase.id}: ${testCase.name} ---`);
    }

    // eslint-disable-next-line no-await-in-loop
    const result = await runTestCase(client, testCase, verbose);
    results.push(result);

    // Print inline progress
    const icon = result.passed ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
    if (!verbose) {
      // eslint-disable-next-line no-console
      console.log(`  ${icon} ${testCase.id} ${testCase.name}`);
    }
  }

  const totalDuration = Date.now() - startTime;
  const report = buildReport(results, totalDuration);

  printReport(report);
  saveReport(report, output);

  // Exit with non-zero if any failures
  if (report.failed > 0 || report.errors > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal error:', err);
  process.exit(1);
});
