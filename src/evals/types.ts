// ─── Test Case Definition ───

export type ToolName = 'query_database' | 'generate_chart' | 'navigate_to' | 'create_position' | 'create_loan';

export interface ToolExpectation {
  tool: ToolName;
  order?: number;
  inputContains?: Record<string, unknown>;
  inputMatches?: Record<string, string>;
  sqlPattern?: string;
  sqlContains?: string[];
  chartType?: 'line' | 'bar' | 'area';
  minSeries?: number;
  expectedPath?: string;
  positionType?: string;
}

export interface TextExpectation {
  contains?: string[];
  matches?: string;
  mustConfirm?: boolean;
}

export interface TestTurn {
  userMessage: string;
  expectedTools: ToolExpectation[];
  expectedText?: TextExpectation;
  confirmAfterResponse?: boolean;
}

export interface TestCase {
  id: string;
  category: 'portfolio' | 'chart' | 'query' | 'navigation' | 'multi-turn';
  name: string;
  description: string;
  turns: TestTurn[];
  timeoutMs?: number;
}

// ─── Results ───

export interface ToolCallCapture {
  tool: string;
  input: Record<string, unknown>;
}

export interface ToolValidationResult {
  expectation: ToolExpectation;
  passed: boolean;
  reason?: string;
  matchedCall?: ToolCallCapture;
}

export interface TextValidationResult {
  passed: boolean;
  reasons: string[];
}

export interface TurnResult {
  turnIndex: number;
  userMessage: string;
  toolCalls: ToolCallCapture[];
  assistantText: string;
  toolValidations: ToolValidationResult[];
  textValidation?: TextValidationResult;
  durationMs: number;
}

export interface TestResult {
  testCase: TestCase;
  passed: boolean;
  turns: TurnResult[];
  totalDurationMs: number;
  error?: string;
  tokenUsage: { input: number; output: number };
}

export interface EvalReport {
  timestamp: string;
  totalTests: number;
  passed: number;
  failed: number;
  errors: number;
  results: TestResult[];
  totalDurationMs: number;
  totalTokens: { input: number; output: number };
  estimatedCostUsd: number;
}
