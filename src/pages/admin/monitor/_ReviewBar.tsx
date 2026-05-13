'use client';

// Stacked-bar visualisation of a collector's review status distribution.
// Each segment is sized proportionally to its share of the total. Hover
// reveals the absolute count + percentage. Designed to be tiny — fits
// inside a single table cell.

import React from 'react';
import styled from 'styled-components';
import type { ReviewDistribution, ReviewStatusKey } from 'src/types/monitor';

const REVIEW_COLORS: Record<ReviewStatusKey, string> = {
  pendiente: '#adb5bd',
  mantener: '#28a745',
  arreglar: '#f0ad4e',
  deprecar: '#dc3545',
  documentar: '#5bc0de',
};

const REVIEW_LABELS_ES: Record<ReviewStatusKey, string> = {
  pendiente: 'Pendiente',
  mantener: 'Mantener',
  arreglar: 'Arreglar',
  deprecar: 'Deprecar',
  documentar: 'Documentar',
};

const Bar = styled.div`
  display: flex;
  width: 100%;
  min-width: 110px;
  max-width: 160px;
  height: 12px;
  border-radius: 6px;
  overflow: hidden;
  background: #f3f3f7;
`;

const Segment = styled.div<{ $color: string; $share: number }>`
  flex: ${(p) => p.$share};
  background: ${(p) => p.$color};
  transition: opacity 120ms ease;
  &:hover { opacity: 0.85; }
`;

const TextRow = styled.div`
  font-size: 10px;
  color: #888;
  margin-top: 2px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  & > span.zero { color: #ccc; }
`;

const ORDER: ReviewStatusKey[] = [
  'mantener',
  'documentar',
  'pendiente',
  'arreglar',
  'deprecar',
];

const ReviewBar: React.FC<{ distribution: ReviewDistribution }> = ({ distribution }) => {
  if (!distribution || distribution.total === 0) {
    return <span style={{ color: '#bbb', fontSize: 11 }}>—</span>;
  }
  const { total } = distribution;
  return (
    <div>
      <Bar role="img" aria-label="Distribución de estado de revisión">
        {ORDER.map((k) => {
          const count = distribution[k] ?? 0;
          if (count === 0) return null;
          const pct = Math.round((count / total) * 100);
          return (
            <Segment
              key={k}
              $color={REVIEW_COLORS[k]}
              $share={count}
              title={`${REVIEW_LABELS_ES[k]}: ${count}/${total} (${pct}%)`}
            />
          );
        })}
      </Bar>
      <TextRow>
        {ORDER.map((k) => {
          const count = distribution[k] ?? 0;
          const pct = Math.round((count / total) * 100);
          return (
            <span key={k} className={count === 0 ? 'zero' : ''}>
              <span style={{ color: REVIEW_COLORS[k] }}>●</span> {pct}%
            </span>
          );
        })}
      </TextRow>
    </div>
  );
};

export default ReviewBar;
