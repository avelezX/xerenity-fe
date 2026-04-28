/* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, no-nested-ternary, @typescript-eslint/no-use-before-define */

'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Modal } from 'react-bootstrap';
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
} from '@fortawesome/free-solid-svg-icons';
import tokens from 'design-tokens/tokens.json';
import Chart from '@components/chart/Chart';
import PageTitle from '@components/PageTitle';
import { MultiValue } from 'react-select';
import MultipleSelect from '@components/UI/MultipleSelect';
import ConfirmationModal from '@components/UI/ConfirmationModal';
import useAppStore from '@store';
import { Loan, LoanCashFlowIbr } from 'src/types/loans';
import currencyFormat from 'src/utils/currencyFormat';
import LoansBlotterTable from 'src/components/loans/LoansBlotterTable';
import { fetchCashFlows } from 'src/models/loans/fetchCashFlows';
import { useLoanPortfolioSummary } from 'src/queries/loans';
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
  columns: ['Fecha', 'Balance Inicial', 'Balance Final', 'Interes', 'Pago', 'Principal'],
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

type TypeFilter = 'Todos' | 'ibr' | 'uvr' | 'fija';
type ChartTab = 'ibr' | 'fija' | 'uvr';

const TYPE_OPTIONS: { key: TypeFilter; label: string }[] = [
  { key: 'Todos', label: 'Todos' },
  { key: 'ibr', label: 'IBR' },
  { key: 'uvr', label: 'UVR' },
  { key: 'fija', label: 'Tasa Fija' },
];

const CHART_TABS: { key: ChartTab; label: string }[] = [
  { key: 'ibr', label: 'IBR' },
  { key: 'fija', label: 'Tasa Fija' },
  { key: 'uvr', label: 'UVR' },
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
    showDeleteConfirm,
    showNewLoanModal,
    showCashFlowTable,
    filterDate,
    currentSelection,
    setSelectedBanks,
    onShowDeleteConfirm,
    onShowNewLoanModal,
    onShowCashFlowTable,
    resetStore,
    setFilterDate,
    wakeServer,
    deleteMultipleLoans,
    loading,
    setCurrentSelection,
    activeCompanyId,
    selectedCompanyId,
  } = useAppStore();

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('Todos');
  const [globalFilter, setGlobalFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [chartTab, setChartTab] = useState<ChartTab>('ibr');
  const [cashflowModalLoan, setCashflowModalLoan] = useState<Loan | null>(null);
  const [cashflowModalData, setCashflowModalData] = useState<LoanCashFlowIbr[]>([]);
  const [cashflowModalLoading, setCashflowModalLoading] = useState(false);
  const [modalChartsReady, setModalChartsReady] = useState(false);

  // #316 — Per-loan cashflows + aggregation now come from TanStack Query.
  // Replaces the old store actions (setSelectedLoans, retryFailedLoans) and
  // their derived state (cashFlows, mergedCashFlows, fullLoan, calculationProgress).
  const selectedLoanRows = useMemo(
    () => loans.filter((l) => selectedIds.has(l.id)),
    [loans, selectedIds],
  );
  const {
    cashFlows,
    mergedCashFlows,
    fullLoan,
    progress: calculationProgress,
    retryFailed: retryFailedLoans,
  } = useLoanPortfolioSummary(selectedLoanRows, filterDate);

  const cashflowsEmpty = mergedCashFlows.length === 0;

  // ─── Computed: Deuda total — use backend valuation when available, fallback to original_balance ───
  const totalDeuda = useMemo(
    () =>
      fullLoan?.total_value
        ? fullLoan.total_value
        : loans.reduce((sum, l) => sum + l.original_balance, 0),
    [loans, fullLoan],
  );

  // ─── Chart data (from merged cashflows of selected loans) ───
  const safeDate = (d: string | undefined) => (d ? d.split(' ')[0] : '');
  const paymentChartData = mergedCashFlows
    .filter((f) => f.date)
    .map((flow) => ({ time: safeDate(flow.date), value: flow.payment ?? 0 }));
  const principalChartData = mergedCashFlows
    .filter((f) => f.date)
    .map((flow) => ({ time: safeDate(flow.date), value: flow.principal ?? 0 }));
  const rateChartData = mergedCashFlows
    .filter((f) => f.date)
    .map((flow) => ({ time: safeDate(flow.date), value: flow.rate_tot ?? 0 }));

  // ─── Yield curve data: rate vs duration by type ───
  const yieldCurveData = useMemo(() => {
    const byType: Record<ChartTab, { time: string; value: number }[]> = {
      ibr: [], fija: [], uvr: [],
    };
    // Build from individual cashflow items — use average rate_tot per loan
    // lightweight-charts requires time as YYYY-MM-DD, so convert tenor (years) to fake dates
    const BASE_YEAR = 2025;
    cashFlows.forEach((cf) => {
      const loan = loans.find((l) => l.id === cf.loanId);
      if (!loan || cf.flows.length === 0) return;
      const type = loan.type as ChartTab;
      if (!(type in byType)) return;
      const avgRate = cf.flows.reduce((s, f) => s + (f.rate_tot ?? 0), 0) / cf.flows.length;
      if (!Number.isFinite(avgRate)) return;
      const periodYears: Record<string, number> = {
        Mensual: 1 / 12, Trimestral: 0.25, Semestral: 0.5, Anual: 1,
      };
      const tenor = loan.number_of_payments * (periodYears[loan.periodicity] ?? 0.25);
      if (tenor <= 0) return;
      // Convert tenor to a date: base + tenor years
      const totalMonths = Math.round(tenor * 12);
      const year = BASE_YEAR + Math.floor(totalMonths / 12);
      const month = (totalMonths % 12) + 1;
      const dateStr = `${year}-${String(month).padStart(2, '0')}-01`;
      byType[type].push({ time: dateStr, value: avgRate * 100 });
    });
    // Sort by date and deduplicate (keep first per date)
    Object.values(byType).forEach((arr) => {
      arr.sort((a, b) => (a.time < b.time ? -1 : 1));
      const seen = new Set<string>();
      for (let i = arr.length - 1; i >= 0; i -= 1) {
        if (seen.has(arr[i].time)) arr.splice(i, 1);
        else seen.add(arr[i].time);
      }
    });
    return byType;
  }, [cashFlows, loans]);

  // Type counts for pills
  const typeCounts = useMemo(() => {
    const counts = { ibr: 0, uvr: 0, fija: 0 };
    loans.forEach((l) => {
      if (l.type in counts) counts[l.type as keyof typeof counts] += 1;
    });
    return counts;
  }, [loans]);

  // ─── Selection handlers ───
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

  // ─── Cashflow modal for individual loan ───
  const onViewCashflow = useCallback(async (loan: Loan) => {
    setCashflowModalLoan(loan);
    setCashflowModalLoading(true);
    setCashflowModalData([]);
    setModalChartsReady(false);
    // Check if we already have it in cashFlows store
    const existing = cashFlows.find((cf) => cf.loanId === loan.id);
    if (existing) {
      setCashflowModalData(existing.flows);
      setCashflowModalLoading(false);
      return;
    }
    // Fetch from API
    try {
      const response = await fetchCashFlows(loan.id, loan.type, filterDate);
      if (!response.error && response.data) {
        setCashflowModalData(response.data);
      }
    } catch {
      // silently fail — modal will show "Sin datos"
    } finally {
      setCashflowModalLoading(false);
    }
  }, [cashFlows, filterDate]);

  // (Removed sync useEffect — useLoanPortfolioSummary reacts to selectedIds
  //  changes via its own deps; no need to push state into the store.)

  const onDownloadSeries = () => {
    const { name, columns, format } = CSV_FILE;
    const allValues: string[][] = [columns];
    mergedCashFlows.forEach(
      ({ date, beginning_balance, ending_balance, interest, payment, principal }) => {
        allValues.push([date, beginning_balance.toString(), ending_balance.toString(), interest.toString(), payment.toString(), principal.toString()]);
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
    getLoanData([], activeCompanyId());
    return () => resetStore();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getLoanData, resetStore, selectedCompanyId]);

  useEffect(() => { wakeServer(); }, [wakeServer]);

  // Auto-select all loans and start calculation when loans load
  useEffect(() => {
    if (loans.length > 0 && selectedIds.size === 0 && !calculationProgress.calculating) {
      setSelectedIds(new Set(loans.map((l) => l.id)));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loans]);

  useEffect(() => {
    if (errorMessage) toast.error(errorMessage, { position: toast.POSITION.BOTTOM_RIGHT });
    else if (successMessage) toast.success(successMessage, { position: toast.POSITION.BOTTOM_RIGHT });
  }, [errorMessage, successMessage]);

  const bankSelectItems = banks.map((bck) => ({ value: bck.bank_name, label: bck.bank_name }));

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
              disabled={calculationProgress.calculating || loans.length === 0}
              onClick={() => {
                setSelectedIds(new Set(loans.map((l) => l.id)));
              }}
              style={{
                padding: '6px 16px', fontSize: 12, fontWeight: 700, borderRadius: 6,
                border: 'none', cursor: 'pointer',
                background: calculationProgress.calculating ? '#6c757d' : '#198754',
                color: '#fff',
                opacity: calculationProgress.calculating || loans.length === 0 ? 0.7 : 1,
              }}
            >
              {calculationProgress.calculating
                ? `Calculando ${calculationProgress.completed}/${calculationProgress.total}...`
                : `Calcular Todos (${loans.length})`
              }
            </button>
            <ToolbarBtn disabled={cashflowsEmpty} onClick={() => onShowCashFlowTable(true)}>Ver Flujos</ToolbarBtn>
            <ToolbarBtn disabled={cashflowsEmpty} onClick={onDownloadSeries}>
              <Icon icon={faFileCsv} style={{ marginRight: 4 }} />CSV
            </ToolbarBtn>
            <button
              type="button"
              onClick={() => onShowNewLoanModal(true)}
              style={{ padding: '4px 12px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: 'none', background: '#0d6efd', color: '#fff', cursor: 'pointer' }}
            >
              <Icon icon={faPlus} style={{ marginRight: 4 }} />
              Nuevo Crédito
            </button>
          </div>
        </div>

        {/* ─── Summary Bar ─── */}
        <div style={{
          display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center',
          padding: '12px 16px', background: '#f8f9fa', border: '1px solid #dee2e6',
          borderRadius: 8, marginBottom: 12,
        }}>
          <SummaryItem label="# Créditos" value={loans.length.toString()} />
          <SummaryItem label="Deuda Total" value={fmtMM(totalDeuda)} />
          {fullLoan && !calculationProgress.calculating && (
            <>
              <SummaryItem label="CPD" value={`${((fullLoan.average_irr ?? 0) * 100).toFixed(2)}%`} />
              <SummaryItem label="Tenor (Años)" value={(fullLoan.average_tenor ?? 0).toFixed(1)} />
              <SummaryItem label="Duración (Años)" value={(fullLoan.average_duration ?? 0).toFixed(2)} />
            </>
          )}
          {calculationProgress.calculating && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 120, height: 6, background: '#dee2e6', borderRadius: 3, overflow: 'hidden',
              }}>
                <div style={{
                  width: `${calculationProgress.total > 0 ? (calculationProgress.completed / calculationProgress.total) * 100 : 0}%`,
                  height: '100%', background: '#0d6efd', borderRadius: 3,
                  transition: 'width 0.3s ease',
                }} />
              </div>
              <span style={{ fontSize: 11, color: '#6c757d', fontWeight: 600 }}>
                Calculando {calculationProgress.completed}/{calculationProgress.total}
                {calculationProgress.failed > 0 && (
                  <span style={{ color: '#dc3545', marginLeft: 4 }}>
                    ({calculationProgress.failed} con error)
                  </span>
                )}
              </span>
            </div>
          )}
          {!calculationProgress.calculating && calculationProgress.failed > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: '#dc3545', fontWeight: 600 }}>
                {calculationProgress.failed} de {calculationProgress.total} créditos con error
              </span>
              <button
                type="button"
                onClick={() => retryFailedLoans()}
                style={{
                  padding: '2px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 6,
                  border: '1px solid #dc3545',
                  background: '#fff',
                  color: '#dc3545',
                  cursor: 'pointer',
                }}
              >
                Reintentar fallidos
              </button>
            </div>
          )}
          {typeCounts.ibr > 0 && <SummaryItem label="IBR" value={`${typeCounts.ibr} créditos`} color="#856404" />}
          {typeCounts.uvr > 0 && <SummaryItem label="UVR" value={`${typeCounts.uvr} créditos`} color="#6f42c1" />}
          {typeCounts.fija > 0 && <SummaryItem label="Tasa Fija" value={`${typeCounts.fija} créditos`} color="#004085" />}
        </div>

        {/* ─── Filters ─── */}
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

          <div style={{ width: 200 }}>
            <MultipleSelect data={bankSelectItems} onChange={onBankFilter} placeholder="Filtrar por banco" />
          </div>

          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            style={{ padding: '3px 8px', fontSize: 11, borderRadius: 6, border: '1px solid #ced4da', fontFamily: 'monospace', outline: 'none' }}
          />

          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={onDeleteSelected}
              style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: '1px solid #dc3545', background: '#fff', color: '#dc3545', cursor: 'pointer' }}
            >
              <Icon icon={faTrash} style={{ marginRight: 4 }} />
              Borrar ({selectedIds.size})
            </button>
          )}
        </div>

        {/* ─── Table ─── */}
        <div style={{ background: '#fff', border: '1px solid #dee2e6', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <LoansBlotterTable
            loans={loans}
            typeFilter={typeFilter}
            globalFilter={globalFilter}
            onGlobalFilterChange={setGlobalFilter}
            selectedIds={selectedIds}
            onToggleSelect={onToggleSelect}
            onToggleSelectAll={onToggleSelectAll}
            onDelete={onDeleteFromTable}
            onViewCashflow={onViewCashflow}
          />
        </div>

        {/* ─── Charts ─── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div style={{ background: '#fff', border: '1px solid #dee2e6', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#212529' }}>Flujo de Caja &amp; Tasa Implícita</div>
            {paymentChartData.length > 0 ? (
              <DelayedChart key={`cf-${paymentChartData.length}`} showToolbar loading={loading}>
                <Chart.Bar data={paymentChartData} color={INTEREST_COLOR} scaleId="right" title="Interés" />
                <Chart.Bar data={principalChartData} color={PRINCIPAL_COLOR} scaleId="right" title="Capital" />
                <Chart.Line data={rateChartData} color={designSystem['green-400'].value} scaleId="left" title="Tasa % (Izq)" />
              </DelayedChart>
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: '#adb5bd', fontSize: 12, border: '2px dashed #dee2e6', borderRadius: 8 }}>
                Selecciona créditos para ver el flujo de caja consolidado.
              </div>
            )}
          </div>

          <div style={{ background: '#fff', border: '1px solid #dee2e6', borderRadius: 8, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#212529' }}>Curva de Tasa vs Duración</span>
              <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                {CHART_TABS.map(({ key, label }) => (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setChartTab(key)}
                    style={{
                      padding: '2px 8px', fontSize: 10, fontWeight: 600, borderRadius: 4, cursor: 'pointer',
                      border: chartTab === key ? '2px solid #495057' : '1px solid #dee2e6',
                      background: chartTab === key ? (TYPE_PILL_COLORS[key]?.bg ?? '#495057') : '#f8f9fa',
                      color: chartTab === key ? (TYPE_PILL_COLORS[key]?.color ?? '#fff') : '#6c757d',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {yieldCurveData[chartTab].length > 0 ? (
              <DelayedChart key={`yc-${chartTab}-${yieldCurveData[chartTab].length}`} showToolbar loading={loading}>
                <Chart.Line
                  data={yieldCurveData[chartTab]}
                  color={TYPE_PILL_COLORS[chartTab]?.color ?? '#495057'}
                  scaleId="left"
                  title={`Tasa (${chartTab.toUpperCase()})`}
                />
              </DelayedChart>
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: '#adb5bd', fontSize: 12, border: '2px dashed #dee2e6', borderRadius: 8 }}>
                Selecciona créditos {chartTab.toUpperCase()} para ver la curva.
              </div>
            )}
          </div>
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
      <NewCreditModal show={showNewLoanModal} onShow={onShowNewLoanModal} bankList={banks} />
      <CashFlowOverlay cashFlows={mergedCashFlows} handleShow={onShowCashFlowTable} show={showCashFlowTable} />

      {/* ─── Cashflow Modal (per loan) ─── */}
      <Modal size="xl" show={!!cashflowModalLoan} onHide={() => { setCashflowModalLoan(null); setModalChartsReady(false); }} onEntered={() => setModalChartsReady(true)} centered>
        <Modal.Header closeButton>
          <Modal.Title style={{ fontSize: 16 }}>
            Flujo de Caja — {cashflowModalLoan?.loan_identifier || cashflowModalLoan?.id.slice(0, 8)}
            <span style={{ fontSize: 11, color: '#6c757d', marginLeft: 8 }}>
              ({cashflowModalLoan?.bank} · {cashflowModalLoan?.type?.toUpperCase()} · {cashflowModalLoan?.interest_rate}%)
            </span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: '80vh', overflowY: 'auto' }}>
          {cashflowModalLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#6c757d' }}>Cargando flujos…</div>
          ) : cashflowModalData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#6c757d' }}>Sin datos de flujo de caja.</div>
          ) : (
            <>
              {/* Charts in modal — render only after modal animation completes */}
              {modalChartsReady && (
                <div key={`modal-charts-${cashflowModalLoan?.id}`} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, color: '#212529' }}>Flujo de Caja</div>
                    <DelayedChart showToolbar loading={false}>
                      <Chart.Bar
                        data={cashflowModalData.filter((f) => f.date).map((f) => ({ time: safeDate(f.date), value: f.interest ?? 0 }))}
                        color={INTEREST_COLOR}
                        scaleId="right"
                        title="Interés"
                      />
                      <Chart.Bar
                        data={cashflowModalData.filter((f) => f.date).map((f) => ({ time: safeDate(f.date), value: f.principal ?? 0 }))}
                        color={PRINCIPAL_COLOR}
                        scaleId="right"
                        title="Capital"
                      />
                    </DelayedChart>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, color: '#212529' }}>Tasa Implícita</div>
                    <DelayedChart showToolbar loading={false}>
                      <Chart.Line
                        data={cashflowModalData.filter((f) => f.date).map((f) => ({ time: safeDate(f.date), value: (f.rate_tot ?? f.rate ?? 0) * 100 }))}
                        color={designSystem['green-400'].value}
                        scaleId="left"
                        title="Tasa %"
                      />
                    </DelayedChart>
                  </div>
                </div>
              )}

              {/* Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse', fontFamily: 'monospace' }}>
                  <thead>
                    <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                      <th style={thStyle}>Fecha</th>
                      <th style={thStyle}>Tasa %</th>
                      <th style={thStyle}>Balance Inicial</th>
                      <th style={thStyle}>Pago Cuota</th>
                      <th style={thStyle}>Intereses</th>
                      <th style={thStyle}>Principal</th>
                      <th style={thStyle}>Balance Final</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashflowModalData.map((row) => (
                      <tr key={`${row.date}-${row.beginning_balance}`} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={tdStyle}>{row.date?.split(' ')[0]}</td>
                        <td style={tdStyle}>{((row.rate_tot ?? row.rate ?? 0) * 100).toFixed(2)}%</td>
                        <td style={tdStyle}>{currencyFormat(row.beginning_balance, 0)}</td>
                        <td style={tdStyle}>{currencyFormat(row.payment, 0)}</td>
                        <td style={tdStyle}>{currencyFormat(row.interest, 0)}</td>
                        <td style={tdStyle}>{currencyFormat(row.principal, 0)}</td>
                        <td style={tdStyle}>{currencyFormat(row.ending_balance, 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Modal.Body>
      </Modal>

      <ToastContainer />
    </CoreLayout>
  );
}

// ─── Shared styles ──────────────────────────────────────────────────────────

const thStyle: React.CSSProperties = { padding: '6px 8px', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' };
const tdStyle: React.CSSProperties = { padding: '4px 8px', textAlign: 'right' };

// ─── Sub-components ─────────────────────────────────────────────────────────

/**
 * Wrapper that forces a re-render shortly after mount.
 * Needed because ChartContainer sets chart.current in useEffect (ref, no re-render),
 * so children miss the context on first render. This extra render lets them pick it up.
 */
function DelayedChart({ children, showToolbar, loading }: { children: React.ReactNode; showToolbar?: boolean; loading?: boolean }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <Chart showToolbar={showToolbar} loading={loading}>
      {ready ? children : null}
    </Chart>
  );
}

function SummaryItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ minWidth: 100 }}>
      <div style={{ fontSize: 10, color: '#6c757d', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', color: color ?? '#212529' }}>{value}</div>
    </div>
  );
}

function ToolbarBtn({ disabled, onClick, children }: { disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: '4px 12px', fontSize: 11, fontWeight: 600, borderRadius: 6,
        border: '1px solid #dee2e6', background: '#fff',
        cursor: disabled ? 'not-allowed' : 'pointer',
        color: disabled ? '#adb5bd' : '#495057',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}
