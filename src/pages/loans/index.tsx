/* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, no-nested-ternary, @typescript-eslint/no-use-before-define */

'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { CoreLayout } from '@layout';
import { ExportToCsv, downloadBlob } from 'src/utils/downloadCSV';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faFileCsv,
  faPlus,
  faLandmark,
  faTrash,
  faTable,
  faChartBar,
} from '@fortawesome/free-solid-svg-icons';
import tokens from 'design-tokens/tokens.json';
import Chart from '@components/chart/Chart';
import PageTitle from '@components/PageTitle';
import { MultiValue } from 'react-select';
import MultipleSelect from '@components/UI/MultipleSelect';
import ConfirmationModal from '@components/UI/ConfirmationModal';
import useAppStore from '@store';
import { Loan } from 'src/types/loans';
import LoansBlotterTable from 'src/components/loans/LoansBlotterTable';
import NewCreditModal from './_NewCreditModal';
import CashFlowOverlay from './_cashFlowOverLay/cashFlowOverlay';

const designSystem = tokens.xerenity;
const INTEREST_COLOR = designSystem['purple-50'].value;
const PRINCIPAL_COLOR = designSystem['purple-300'].value;

const PAGE_TITLE = 'Créditos';
const CONFIRM_MODAL_TITLE = '¿Desea Borrar Este Crédito?';
const DELETE_TXT =
  'Al proceder removera el crédito de la lista y todas sus configuraciones.';

const CSV_FILE = {
  columns: [
    'Fecha',
    'Balance Inicial',
    'Balance Final',
    'Interes',
    'Pago',
    'Principal',
  ],
  name: 'xerenity_flujo_de_caja.csv',
  format: 'text/csv;charset=utf-8;',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmtMM = (v: number | null | undefined) => {
  if (v == null) return '—';
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const TYPE_PILL_COLORS: Record<string, { bg: string; color: string }> = {
  ibr:  { bg: '#fff3cd', color: '#856404' },
  uvr:  { bg: '#e8d5f5', color: '#6f42c1' },
  fija: { bg: '#cce5ff', color: '#004085' },
};

type ViewMode = 'table' | 'chart';
type TypeFilter = 'Todos' | 'ibr' | 'uvr' | 'fija';

const TYPE_OPTIONS: { key: TypeFilter; label: string }[] = [
  { key: 'Todos', label: 'Todos' },
  { key: 'ibr', label: 'IBR' },
  { key: 'uvr', label: 'UVR' },
  { key: 'fija', label: 'Tasa Fija' },
];

// ─── Page ───────────────────────────────────────────────────────────────────

export default function LoansPage() {
  const {
    banks,
    errorMessage,
    successMessage,
    deleteLoanItem,
    getLoanData,
    loans,
    mergedCashFlows,
    showDeleteConfirm,
    showNewLoanModal,
    showCashFlowTable,
    filterDate,
    currentSelection,
    setSelectedLoans,
    setSelectedBanks,
    onShowDeleteConfirm,
    onShowNewLoanModal,
    onShowCashFlowTable,
    resetStore,
    setFilterDate,
    fullLoan,
    wakeServer,
    deleteMultipleLoans,
    loading,
    setCurrentSelection,
  } = useAppStore();

  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('Todos');
  const [globalFilter, setGlobalFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const cashflowsEmpty = mergedCashFlows.length === 0;

  // Chart data
  const paymentChartData = mergedCashFlows.map((flow) => ({
    time: flow.date.split(' ')[0],
    value: flow.payment,
  }));
  const principalChartData = mergedCashFlows.map((flow) => ({
    time: flow.date.split(' ')[0],
    value: flow.principal,
  }));
  const rateChartData = mergedCashFlows.map((flow) => ({
    time: flow.date.split(' ')[0],
    value: flow.rate_tot,
  }));

  // Type counts for pills
  const typeCounts = useMemo(() => {
    const counts = { ibr: 0, uvr: 0, fija: 0 };
    loans.forEach((l) => {
      if (l.type in counts) counts[l.type as keyof typeof counts] += 1;
    });
    return counts;
  }, [loans]);

  // Selection handlers
  const onToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const filteredLoans = useMemo(
    () => typeFilter === 'Todos' ? loans : loans.filter((l) => l.type === typeFilter),
    [loans, typeFilter],
  );

  const onToggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const allSelected = filteredLoans.every((l) => prev.has(l.id));
      if (allSelected) return new Set();
      return new Set(filteredLoans.map((l) => l.id));
    });
  }, [filteredLoans]);

  const onDeleteFromTable = useCallback((loan: Loan) => {
    setCurrentSelection(loan);
    onShowDeleteConfirm(true);
  }, [setCurrentSelection, onShowDeleteConfirm]);

  // Keep store selectedLoans in sync
  useEffect(() => {
    const ids = Array.from(selectedIds);
    const selectedRows = loans.filter((l) => selectedIds.has(l.id));
    setSelectedLoans({
      selectedCount: ids.length,
      selectedRows,
      filterDate,
    });
  }, [selectedIds, loans, filterDate, setSelectedLoans]);

  const onDownloadSeries = () => {
    const { name, columns, format } = CSV_FILE;
    const allValues: string[][] = [columns];
    mergedCashFlows.forEach(
      ({ date, beginning_balance, ending_balance, interest, payment, principal }) => {
        allValues.push([
          date,
          beginning_balance.toString(),
          ending_balance.toString(),
          interest.toString(),
          payment.toString(),
          principal.toString(),
        ]);
      }
    );
    const csv = ExportToCsv(allValues);
    downloadBlob(csv, name, format);
  };

  const onBankFilter = (selections: MultiValue<{ value: string; label: string }>) => {
    const selectionValues = selections?.map(({ value }) => ({ bank_name: value }));
    setSelectedBanks(selectionValues);
  };

  const onDeleteConfirmed = () => {
    if (currentSelection) deleteLoanItem(currentSelection.id);
  };

  const onDeleteSelected = () => {
    const ids = Array.from(selectedIds);
    if (ids.length > 0) {
      deleteMultipleLoans(ids);
      setSelectedIds(new Set());
    }
  };

  useEffect(() => {
    getLoanData();
    return () => resetStore();
  }, [getLoanData, resetStore]);

  useEffect(() => {
    wakeServer();
  }, [wakeServer]);

  useEffect(() => {
    if (errorMessage) {
      toast.error(errorMessage, { position: toast.POSITION.BOTTOM_RIGHT });
    } else if (successMessage) {
      toast.success(successMessage, { position: toast.POSITION.BOTTOM_RIGHT });
    }
  }, [errorMessage, successMessage]);

  const bankSelectItems = banks.map((bck) => ({
    value: bck.bank_name,
    label: bck.bank_name,
  }));

  return (
    <CoreLayout>
      <div style={{ padding: '0 16px 16px' }}>
        {/* ─── Header ─── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', marginBottom: 8 }}>
          <PageTitle>
            <Icon icon={faLandmark} size="1x" />
            <h4>{PAGE_TITLE}</h4>
          </PageTitle>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              disabled={cashflowsEmpty}
              onClick={() => onShowCashFlowTable(true)}
              style={{
                padding: '4px 12px', fontSize: 11, fontWeight: 600, borderRadius: 6,
                border: '1px solid #dee2e6', background: '#fff', cursor: cashflowsEmpty ? 'not-allowed' : 'pointer',
                color: cashflowsEmpty ? '#adb5bd' : '#495057', opacity: cashflowsEmpty ? 0.6 : 1,
              }}
            >
              Ver Flujos
            </button>
            <button
              type="button"
              disabled={cashflowsEmpty}
              onClick={onDownloadSeries}
              style={{
                padding: '4px 12px', fontSize: 11, fontWeight: 600, borderRadius: 6,
                border: '1px solid #dee2e6', background: '#fff', cursor: cashflowsEmpty ? 'not-allowed' : 'pointer',
                color: cashflowsEmpty ? '#adb5bd' : '#495057', opacity: cashflowsEmpty ? 0.6 : 1,
              }}
            >
              <Icon icon={faFileCsv} style={{ marginRight: 4 }} />
              CSV
            </button>
            <button
              type="button"
              onClick={() => onShowNewLoanModal(true)}
              style={{
                padding: '4px 12px', fontSize: 11, fontWeight: 600, borderRadius: 6,
                border: 'none', background: '#0d6efd', color: '#fff', cursor: 'pointer',
              }}
            >
              <Icon icon={faPlus} style={{ marginRight: 4 }} />
              Nuevo Crédito
            </button>
          </div>
        </div>

        {/* ─── Summary Bar ─── */}
        {fullLoan && (
          <div style={{
            display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center',
            padding: '12px 16px', background: '#f8f9fa', border: '1px solid #dee2e6',
            borderRadius: 8, marginBottom: 12,
          }}>
            <SummaryItem label="# Créditos" value={fullLoan.loan_count?.toString() ?? '0'} />
            <SummaryItem label="Deuda Total" value={fmtMM(fullLoan.total_value)} />
            <SummaryItem label="CPD" value={`${((fullLoan.average_irr ?? 0) * 100).toFixed(2)}%`} />
            <SummaryItem label="Tenor (Años)" value={(fullLoan.average_tenor ?? 0).toFixed(1)} />
            <SummaryItem label="Duración (Años)" value={(fullLoan.average_duration ?? 0).toFixed(2)} />
            {(fullLoan.total_value_ibr ?? 0) > 0 && (
              <SummaryItem label="IBR" value={fmtMM(fullLoan.total_value_ibr)} color="#856404" />
            )}
            {(fullLoan.total_value_uvr ?? 0) > 0 && (
              <SummaryItem label="UVR" value={fmtMM(fullLoan.total_value_uvr)} color="#6f42c1" />
            )}
            {(fullLoan.total_value_fija ?? 0) > 0 && (
              <SummaryItem label="Tasa Fija" value={fmtMM(fullLoan.total_value_fija)} color="#004085" />
            )}
          </div>
        )}

        {/* ─── Filters + Toggle ─── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Type pills */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: '#6c757d', fontWeight: 600 }}>Tipo:</span>
            {TYPE_OPTIONS.map(({ key, label }) => {
              const count = key === 'Todos' ? loans.length : typeCounts[key as keyof typeof typeCounts] ?? 0;
              const active = typeFilter === key;
              const s = key !== 'Todos' ? TYPE_PILL_COLORS[key] : null;
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => setTypeFilter(key)}
                  style={{
                    padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    border: active ? '2px solid #495057' : '1px solid #dee2e6',
                    background: active && s ? s.bg : active ? '#495057' : '#f8f9fa',
                    color: active && s ? s.color : active ? '#fff' : '#6c757d',
                  }}
                >
                  {label} {count > 0 && <span style={{ opacity: 0.7 }}>({count})</span>}
                </button>
              );
            })}
          </div>

          {/* Bank filter */}
          <div style={{ width: 200 }}>
            <MultipleSelect
              data={bankSelectItems}
              onChange={onBankFilter}
              placeholder="Filtrar por banco"
            />
          </div>

          {/* Date filter */}
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            style={{
              padding: '3px 8px', fontSize: 11, borderRadius: 6, border: '1px solid #ced4da',
              fontFamily: 'monospace', outline: 'none',
            }}
          />

          {/* Delete selected */}
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={onDeleteSelected}
              style={{
                padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6,
                border: '1px solid #dc3545', background: '#fff', color: '#dc3545', cursor: 'pointer',
              }}
            >
              <Icon icon={faTrash} style={{ marginRight: 4 }} />
              Borrar ({selectedIds.size})
            </button>
          )}

          {/* View toggle */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              style={{
                padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: '6px 0 0 6px',
                border: '1px solid #dee2e6', cursor: 'pointer',
                background: viewMode === 'table' ? '#495057' : '#fff',
                color: viewMode === 'table' ? '#fff' : '#6c757d',
              }}
            >
              <Icon icon={faTable} style={{ marginRight: 4 }} />
              Tabla
            </button>
            <button
              type="button"
              onClick={() => setViewMode('chart')}
              style={{
                padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: '0 6px 6px 0',
                border: '1px solid #dee2e6', borderLeft: 'none', cursor: 'pointer',
                background: viewMode === 'chart' ? '#495057' : '#fff',
                color: viewMode === 'chart' ? '#fff' : '#6c757d',
              }}
            >
              <Icon icon={faChartBar} style={{ marginRight: 4 }} />
              Gráfico
            </button>
          </div>
        </div>

        {/* ─── Content ─── */}
        <div style={{ background: '#fff', border: '1px solid #dee2e6', borderRadius: 8, padding: 16 }}>
          {viewMode === 'table' ? (
            <LoansBlotterTable
              loans={loans}
              typeFilter={typeFilter}
              globalFilter={globalFilter}
              onGlobalFilterChange={setGlobalFilter}
              selectedIds={selectedIds}
              onToggleSelect={onToggleSelect}
              onToggleSelectAll={onToggleSelectAll}
              onDelete={onDeleteFromTable}
            />
          ) : (
            <div>
              {cashflowsEmpty ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#6c757d', border: '2px dashed #dee2e6', borderRadius: 8 }}>
                  Selecciona créditos en la tabla para ver el gráfico de flujos.
                </div>
              ) : (
                <Chart showToolbar loading={loading}>
                  <Chart.Bar
                    data={paymentChartData}
                    color={INTEREST_COLOR}
                    scaleId="right"
                    title="Interés"
                  />
                  <Chart.Bar
                    data={principalChartData}
                    color={PRINCIPAL_COLOR}
                    scaleId="right"
                    title="Capital"
                  />
                  <Chart.Line
                    data={rateChartData}
                    color={designSystem['green-400'].value}
                    scaleId="left"
                    title="Tasa % (Izq)"
                  />
                </Chart>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Modals ─── */}
      <ConfirmationModal
        onCancel={() => onShowDeleteConfirm(false)}
        show={showDeleteConfirm}
        deleteText={DELETE_TXT}
        modalTitle={CONFIRM_MODAL_TITLE}
        onDelete={onDeleteConfirmed}
      />
      <NewCreditModal
        show={showNewLoanModal}
        onShow={onShowNewLoanModal}
        bankList={banks}
      />
      <CashFlowOverlay
        cashFlows={mergedCashFlows}
        handleShow={onShowCashFlowTable}
        show={showCashFlowTable}
      />
      <ToastContainer />
    </CoreLayout>
  );
}

// ─── Summary Item ───────────────────────────────────────────────────────────

function SummaryItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ minWidth: 100 }}>
      <div style={{ fontSize: 10, color: '#6c757d', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', color: color ?? '#212529' }}>{value}</div>
    </div>
  );
}
