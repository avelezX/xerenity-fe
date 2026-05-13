import styled from 'styled-components';
import tokens from 'design-tokens/tokens.json';

const t = tokens.xerenity;
const PURPLE = t['purple-100'].value;
const PURPLE_50 = t['purple-50'].value;
const GRAY_100 = t['gray-100'].value;
const GRAY_200 = t['gray-200'].value;
const GRAY_300 = t['gray-300'].value;
const GRAY_500 = t['gray-500'].value;
const WHITE = t['white-100'].value;
const RED = t['red-600'].value;
const GREEN = t['green-500'].value;

export const KpiGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
  @media (max-width: 1100px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

export const KpiCard = styled.div`
  background: ${WHITE};
  border: 1px solid ${GRAY_200};
  border-radius: 8px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 92px;
`;

export const KpiLabel = styled.div`
  font-size: 12px;
  color: ${GRAY_500};
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.4px;
`;

export const KpiValue = styled.div<{ tone?: 'positive' | 'negative' | 'neutral' }>`
  font-size: 28px;
  font-weight: 700;
  line-height: 1.1;
  color: ${({ tone }) => {
    if (tone === 'positive') return RED;
    if (tone === 'negative') return GREEN;
    return '#212529';
  }};
`;

export const KpiDelta = styled.span<{ tone?: 'positive' | 'negative' | 'neutral' }>`
  font-size: 12px;
  font-weight: 500;
  color: ${({ tone }) => {
    if (tone === 'positive') return RED;
    if (tone === 'negative') return GREEN;
    return GRAY_500;
  }};
`;

export const KpiSubtle = styled.div`
  font-size: 11px;
  color: ${GRAY_500};
`;

export const ChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

export const Chip = styled.button<{ active?: boolean; color?: string }>`
  border: 1px solid ${({ active, color }) =>
    active ? color || PURPLE : GRAY_300};
  background: ${({ active, color }) =>
    active ? `${color || PURPLE}1a` : WHITE};
  color: ${({ active, color }) =>
    active ? color || PURPLE : '#212529'};
  border-radius: 999px;
  font-size: 12px;
  padding: 4px 10px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 120ms ease;
  &:hover {
    background: ${({ color }) => (color ? `${color}1a` : GRAY_100)};
  }
`;

export const SegmentedRow = styled.div`
  display: inline-flex;
  background: ${GRAY_100};
  border-radius: 6px;
  padding: 2px;
  gap: 2px;
`;

export const SegmentedButton = styled.button<{ active?: boolean }>`
  border: 0;
  background: ${({ active }) => (active ? WHITE : 'transparent')};
  color: ${({ active }) => (active ? PURPLE : '#212529')};
  font-size: 12px;
  font-weight: ${({ active }) => (active ? 600 : 500)};
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  box-shadow: ${({ active }) =>
    active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'};
`;

export const SectionTitle = styled.h5`
  font-size: 13px;
  font-weight: 600;
  color: #212529;
  margin: 0 0 8px 0;
  text-transform: uppercase;
  letter-spacing: 0.4px;
`;

export const PALETTE = {
  PURPLE,
  PURPLE_50,
  GRAY_100,
  GRAY_200,
  GRAY_300,
  GRAY_500,
  WHITE,
  RED,
  GREEN,
};
