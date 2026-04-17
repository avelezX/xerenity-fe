import * as fs from 'fs';
import * as path from 'path';
import type { EvalReport, TestResult } from './types';

// ANSI colors
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function printTestResult(result: TestResult): void {
  const icon = result.passed ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
  const category = `${DIM}[${result.testCase.category}]${RESET}`;
  const duration = `${DIM}${formatDuration(result.totalDurationMs)}${RESET}`;
  const tokens = `${DIM}(${result.tokenUsage.input + result.tokenUsage.output} tok)${RESET}`;

  // eslint-disable-next-line no-console
  console.log(`  ${icon} ${result.testCase.id} ${category} ${result.testCase.name} ${duration} ${tokens}`);

  if (!result.passed) {
    if (result.error) {
      // eslint-disable-next-line no-console
      console.log(`       ${RED}Error: ${result.error}${RESET}`);
    }

    for (const turn of result.turns) {
      for (const tv of turn.toolValidations) {
        if (!tv.passed) {
          // eslint-disable-next-line no-console
          console.log(`       ${YELLOW}Tool: ${tv.reason}${RESET}`);
        }
      }
      if (turn.textValidation && !turn.textValidation.passed) {
        for (const reason of turn.textValidation.reasons) {
          // eslint-disable-next-line no-console
          console.log(`       ${YELLOW}Text: ${reason}${RESET}`);
        }
      }
    }
  }
}

export function printReport(report: EvalReport): void {
  // eslint-disable-next-line no-console
  console.log(`\n${BOLD}${CYAN}═══ Xerenity Agent Eval Report ═══${RESET}\n`);

  for (const result of report.results) {
    printTestResult(result);
  }

  const passRate = report.totalTests > 0
    ? ((report.passed / report.totalTests) * 100).toFixed(0)
    : '0';

  // eslint-disable-next-line no-console
  console.log(`\n${BOLD}─── Summary ───${RESET}`);
  // eslint-disable-next-line no-console
  console.log(`  Total:    ${report.totalTests}`);
  // eslint-disable-next-line no-console
  console.log(`  ${GREEN}Passed:   ${report.passed}${RESET}`);
  if (report.failed > 0) {
    // eslint-disable-next-line no-console
    console.log(`  ${RED}Failed:   ${report.failed}${RESET}`);
  }
  if (report.errors > 0) {
    // eslint-disable-next-line no-console
    console.log(`  ${RED}Errors:   ${report.errors}${RESET}`);
  }
  // eslint-disable-next-line no-console
  console.log(`  Pass rate: ${passRate}%`);
  // eslint-disable-next-line no-console
  console.log(`  Duration:  ${formatDuration(report.totalDurationMs)}`);
  // eslint-disable-next-line no-console
  console.log(`  Tokens:    ${report.totalTokens.input} in / ${report.totalTokens.output} out`);
  // eslint-disable-next-line no-console
  console.log(`  Est. cost: $${report.estimatedCostUsd.toFixed(4)}`);
  // eslint-disable-next-line no-console
  console.log('');
}

export function saveReport(report: EvalReport, outputPath?: string): string {
  const resultsDir = path.join(__dirname, 'results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = outputPath || path.join(resultsDir, `eval-${timestamp}.json`);

  fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
  // eslint-disable-next-line no-console
  console.log(`${DIM}Report saved to: ${filePath}${RESET}\n`);

  return filePath;
}

export function buildReport(results: TestResult[], totalDurationMs: number): EvalReport {
  const totalTokens = results.reduce(
    (acc, r) => ({
      input: acc.input + r.tokenUsage.input,
      output: acc.output + r.tokenUsage.output,
    }),
    { input: 0, output: 0 },
  );

  // Claude Sonnet 4.5 pricing: $3/M input, $15/M output
  const estimatedCostUsd =
    (totalTokens.input / 1_000_000) * 3 + (totalTokens.output / 1_000_000) * 15;

  return {
    timestamp: new Date().toISOString(),
    totalTests: results.length,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed && !r.error).length,
    errors: results.filter((r) => !!r.error).length,
    results,
    totalDurationMs,
    totalTokens,
    estimatedCostUsd,
  };
}
