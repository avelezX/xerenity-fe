import { describe, it, expect } from 'vitest';
import { parsePeriod } from '../utils/parsePeriod';

// Fixed "now" so tests are deterministic regardless of when they run.
// 2026-05-27 (Wed) chosen because that's the project's "today" reference.
const NOW = new Date(2026, 4, 27); // May = 4 (0-indexed)

describe('parsePeriod', () => {
  it('returns default (last 365 days) when text is empty/null', () => {
    expect(parsePeriod(null, NOW).matched).toBe('default');
    expect(parsePeriod('', NOW).matched).toBe('default');
    expect(parsePeriod(undefined, NOW).matched).toBe('default');
    expect(parsePeriod('xyz totally unparsable', NOW).matched).toBe('default');
  });

  it('parses "hoy" / "today"', () => {
    const r = parsePeriod('hoy', NOW);
    expect(r.matched).toBe('today');
    expect(r.from.getDate()).toBe(27);
    expect(r.to.getDate()).toBe(27);

    expect(parsePeriod('TODAY', NOW).matched).toBe('today');
  });

  it('parses "ayer" / "yesterday"', () => {
    const r = parsePeriod('ayer', NOW);
    expect(r.matched).toBe('yesterday');
    expect(r.from.getDate()).toBe(26);
  });

  it('parses "última semana" / "last week"', () => {
    const r = parsePeriod('última semana', NOW);
    expect(r.matched).toMatch(/^last_/);
    expect(r.period_days).toBe(7);
  });

  it('parses "último mes"', () => {
    expect(parsePeriod('último mes', NOW).period_days).toBe(30);
    expect(parsePeriod('last month', NOW).period_days).toBe(30);
  });

  it('parses "últimos N <unit>"', () => {
    expect(parsePeriod('últimos 3 meses', NOW).period_days).toBe(90);
    expect(parsePeriod('last 14 days', NOW).period_days).toBe(14);
    expect(parsePeriod('últimos 2 años', NOW).period_days).toBe(730);
  });

  it('parses YTD', () => {
    const r = parsePeriod('ytd', NOW);
    expect(r.matched).toBe('ytd');
    expect(r.from.getMonth()).toBe(0);
    expect(r.from.getDate()).toBe(1);
  });

  it('parses "MMMM YYYY"', () => {
    const r = parsePeriod('octubre 2024', NOW);
    expect(r.matched).toBe('month_year');
    expect(r.from.getFullYear()).toBe(2024);
    expect(r.from.getMonth()).toBe(9); // octubre = 9
    expect(r.to.getMonth()).toBe(9);
    expect(r.to.getDate()).toBe(31);
  });

  it('parses "QN YYYY"', () => {
    const r = parsePeriod('q3 2024', NOW);
    expect(r.matched).toBe('q3_2024');
    expect(r.from.getMonth()).toBe(6); // jul
    expect(r.to.getMonth()).toBe(8);   // sep
  });

  it('parses "YYYY"', () => {
    const r = parsePeriod('2023', NOW);
    expect(r.matched).toBe('year');
    expect(r.from.getFullYear()).toBe(2023);
    expect(r.from.getMonth()).toBe(0);
    expect(r.to.getMonth()).toBe(11);
  });

  it('parses "YYYY-MM-DD"', () => {
    const r = parsePeriod('2024-10-15', NOW);
    expect(r.matched).toBe('date');
    expect(r.from.getFullYear()).toBe(2024);
    expect(r.from.getMonth()).toBe(9);
    expect(r.from.getDate()).toBe(15);
  });

  it('parses "DD/MM/YYYY"', () => {
    const r = parsePeriod('15/10/2024', NOW);
    expect(r.matched).toBe('date');
    expect(r.from.getMonth()).toBe(9);
    expect(r.from.getDate()).toBe(15);
  });

  it('parses "desde YYYY-MM-DD"', () => {
    const r = parsePeriod('desde 2024-01-01', NOW);
    expect(r.matched).toBe('since');
    expect(r.from.getFullYear()).toBe(2024);
  });

  it('parses range "X a Y"', () => {
    const r = parsePeriod('2024-01-01 a 2024-06-30', NOW);
    expect(r.matched).toBe('range');
    expect(r.from.getFullYear()).toBe(2024);
    expect(r.from.getMonth()).toBe(0);
    expect(r.to.getMonth()).toBe(5);
  });
});
