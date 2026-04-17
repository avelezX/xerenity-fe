import type {
  TestTurn,
  TextExpectation,
  ToolCallCapture,
  ToolExpectation,
  ToolValidationResult,
  TextValidationResult,
  TurnResult,
} from './types';

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((acc: unknown, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

function validateToolExpectation(
  expectation: ToolExpectation,
  toolCalls: ToolCallCapture[],
): ToolValidationResult {
  // Find matching tool calls
  const matches = toolCalls.filter((tc) => tc.tool === expectation.tool);

  if (matches.length === 0) {
    return {
      expectation,
      passed: false,
      reason: `Tool "${expectation.tool}" no fue llamado`,
    };
  }

  // If order is specified, check the specific index
  if (expectation.order !== undefined) {
    if (expectation.order >= toolCalls.length) {
      return {
        expectation,
        passed: false,
        reason: `Expected tool at index ${expectation.order} but only ${toolCalls.length} calls made`,
      };
    }
    const callAtIndex = toolCalls[expectation.order];
    if (callAtIndex.tool !== expectation.tool) {
      return {
        expectation,
        passed: false,
        reason: `Tool at index ${expectation.order} is "${callAtIndex.tool}", expected "${expectation.tool}"`,
      };
    }
  }

  // Try to find a match that satisfies all conditions
  for (const call of matches) {
    const failures: string[] = [];

    // sqlContains
    if (expectation.sqlContains) {
      const sql = ((call.input.sql as string) || '').toLowerCase();
      for (const term of expectation.sqlContains) {
        if (!sql.includes(term.toLowerCase())) {
          failures.push(`SQL no contiene "${term}"`);
        }
      }
    }

    // sqlPattern
    if (expectation.sqlPattern) {
      const sql = (call.input.sql as string) || '';
      if (!new RegExp(expectation.sqlPattern, 'i').test(sql)) {
        failures.push(`SQL no coincide con patron /${expectation.sqlPattern}/i`);
      }
    }

    // inputContains (deep partial match)
    if (expectation.inputContains) {
      for (const [key, expectedVal] of Object.entries(expectation.inputContains)) {
        const actualVal = getNestedValue(call.input, key);
        if (JSON.stringify(actualVal) !== JSON.stringify(expectedVal)) {
          failures.push(`input.${key}: expected ${JSON.stringify(expectedVal)}, got ${JSON.stringify(actualVal)}`);
        }
      }
    }

    // inputMatches (regex on stringified nested values)
    if (expectation.inputMatches) {
      for (const [path, pattern] of Object.entries(expectation.inputMatches)) {
        const val = getNestedValue(call.input, path);
        const str = val !== undefined ? String(val) : '';
        if (!new RegExp(pattern, 'i').test(str)) {
          failures.push(`input.${path} = "${str}" no coincide con /${pattern}/i`);
        }
      }
    }

    // chartType
    if (expectation.chartType) {
      if (call.input.chart_type !== expectation.chartType) {
        failures.push(`chart_type: expected "${expectation.chartType}", got "${call.input.chart_type}"`);
      }
    }

    // minSeries
    if (expectation.minSeries !== undefined) {
      const series = call.input.series as unknown[];
      const count = Array.isArray(series) ? series.length : 0;
      if (count < expectation.minSeries) {
        failures.push(`series count: expected >= ${expectation.minSeries}, got ${count}`);
      }
    }

    // expectedPath
    if (expectation.expectedPath) {
      if (call.input.path !== expectation.expectedPath) {
        failures.push(`path: expected "${expectation.expectedPath}", got "${call.input.path}"`);
      }
    }

    // positionType
    if (expectation.positionType) {
      if (call.input.position_type !== expectation.positionType) {
        failures.push(`position_type: expected "${expectation.positionType}", got "${call.input.position_type}"`);
      }
    }

    if (failures.length === 0) {
      return { expectation, passed: true, matchedCall: call };
    }

    // If this is the last match, report failures
    if (call === matches[matches.length - 1]) {
      return {
        expectation,
        passed: false,
        reason: failures.join('; '),
        matchedCall: call,
      };
    }
  }

  return { expectation, passed: false, reason: 'No matching tool call found' };
}

function validateText(
  text: string,
  expectation: TextExpectation | undefined,
  toolCalls: ToolCallCapture[],
): TextValidationResult | undefined {
  if (!expectation) return undefined;

  const reasons: string[] = [];

  if (expectation.contains) {
    for (const term of expectation.contains) {
      if (!text.toLowerCase().includes(term.toLowerCase())) {
        reasons.push(`Texto no contiene "${term}"`);
      }
    }
  }

  if (expectation.matches) {
    if (!new RegExp(expectation.matches, 'i').test(text)) {
      reasons.push(`Texto no coincide con patron /${expectation.matches}/i`);
    }
  }

  if (expectation.mustConfirm) {
    const confirmPatterns = /confirm|confirma|desea|procedemos|quieres|seguro|\?/i;
    if (!confirmPatterns.test(text)) {
      reasons.push('Agente no pidio confirmacion');
    }
    const hasCreateCall = toolCalls.some(
      (tc) => tc.tool === 'create_position' || tc.tool === 'create_loan',
    );
    if (hasCreateCall) {
      reasons.push('Agente ejecuto create_position/create_loan SIN confirmar');
    }
  }

  return { passed: reasons.length === 0, reasons };
}

export function evaluateTurn(
  turn: TestTurn,
  turnResult: TurnResult,
): { toolValidations: ToolValidationResult[]; textValidation?: TextValidationResult } {
  const toolValidations = turn.expectedTools.map((exp) =>
    validateToolExpectation(exp, turnResult.toolCalls),
  );

  const textValidation = validateText(
    turnResult.assistantText,
    turn.expectedText,
    turnResult.toolCalls,
  );

  return { toolValidations, textValidation };
}

export function isTurnPassing(
  toolValidations: ToolValidationResult[],
  textValidation?: TextValidationResult,
): boolean {
  const allToolsPassed = toolValidations.every((v) => v.passed);
  const textPassed = textValidation ? textValidation.passed : true;
  return allToolsPassed && textPassed;
}
