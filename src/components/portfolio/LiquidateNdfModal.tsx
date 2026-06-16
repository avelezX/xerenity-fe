/* eslint-disable no-nested-ternary, no-underscore-dangle, arrow-body-style */
/**
 * Modal de liquidacion de NDF — v2 basada en datos del banco.
 *
 * Inputs requeridos (que llegan en el documento de liquidacion del banco):
 *   - Fecha de liquidacion
 *   - Monto a liquidar (USD)
 *   - Tasa negociada (strike efectivo, suele ser = strike de la posicion)
 *   - Tasa referencia (TRM al cierre)
 *   - Nota (opcional)
 *
 * El P&G bruto se calcula EN VIVO en la UI para feedback inmediato y
 * lo recalcula la RPC al confirmar (fuente de verdad). Formula:
 *
 *   signo  = +1 si direction='sell', -1 si direction='buy'
 *   PnL_COP = monto × (tasa_neg − tasa_ref) × signo
 *   PnL_USD = PnL_COP / tasa_ref
 *
 * Soporta liquidacion PARCIAL: si el monto es menor al notional actual,
 * se muestra el remanente que quedaria activo.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Form, Button, Alert, Spinner, Row, Col } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { liquidateNdfPosition } from 'src/models/trading';
import type { PortfolioRow } from './BlotterTable';

interface Props {
  show: boolean;
  onHide: () => void;
  row: PortfolioRow | null;
  onSuccess: () => void;
}

const fmtCop = (v: number): string => new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 0, maximumFractionDigits: 0,
}).format(Math.round(v));

const fmtUsd = (v: number): string => new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(v);

const fmtCompactCop = (v: number): string => {
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : v > 0 ? '+' : '';
  if (v === 0) return '$0';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${Math.round(abs)}`;
};

const fmtCompactUsd = (v: number): string => {
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : v > 0 ? '+' : '';
  if (v === 0) return '$0';
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
};

const pnlColor = (v: number): string => {
  // eslint-disable-next-line no-nested-ternary
  return v > 0 ? '#28a745' : v < 0 ? '#dc3545' : '#212529';
};

const todayIso = (): string => new Date().toISOString().slice(0, 10);

export default function LiquidateNdfModal({ show, onHide, row, onSuccess }: Props) {
  const ndf = row?._ndf;
  const direction = ndf?.direction || 'sell';
  const notionalActual = ndf?.notional_usd ?? 0;
  const strikePosicion = ndf?.strike ?? 0;

  const [liquidationDate, setLiquidationDate] = useState<string>(todayIso());
  const [montoStr, setMontoStr] = useState<string>('');
  const [tasaNegStr, setTasaNegStr] = useState<string>('');
  const [tasaRefStr, setTasaRefStr] = useState<string>('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reinicializa los inputs cuando se abre con una fila nueva
  useEffect(() => {
    if (!show || !ndf) return;
    setLiquidationDate(todayIso());
    setMontoStr(String(notionalActual));
    setTasaNegStr(strikePosicion ? String(strikePosicion) : '');
    setTasaRefStr('');
    setNote('');
    setError(null);
  }, [show, ndf, notionalActual, strikePosicion]);

  // Parseo numerico
  const monto = parseFloat(montoStr) || 0;
  const tasaNeg = parseFloat(tasaNegStr) || 0;
  const tasaRef = parseFloat(tasaRefStr) || 0;

  // ── Calculo en vivo del P&G bruto ──
  // signo = +1 si sell, -1 si buy
  const calc = useMemo(() => {
    if (monto <= 0 || tasaNeg <= 0 || tasaRef <= 0) {
      return { pnlCop: 0, pnlUsd: 0, remanente: notionalActual, esTotal: true };
    }
    const signo = direction === 'sell' ? 1 : -1;
    const pnlCop = monto * (tasaNeg - tasaRef) * signo;
    const pnlUsd = pnlCop / tasaRef;
    const remanente = Math.max(0, notionalActual - monto);
    const esTotal = remanente < 0.01;
    return { pnlCop, pnlUsd, remanente, esTotal };
  }, [monto, tasaNeg, tasaRef, direction, notionalActual]);

  // ── Validacion del form ──
  const validation = useMemo(() => {
    if (!liquidationDate) return 'Falta fecha de liquidacion';
    if (monto <= 0) return 'Monto debe ser mayor a 0';
    if (monto > notionalActual) return `Monto excede el notional disponible (${fmtUsd(notionalActual)} USD)`;
    if (tasaNeg <= 0) return 'Tasa negociada debe ser mayor a 0';
    if (tasaRef <= 0) return 'Tasa referencia debe ser mayor a 0';
    if (note.length > 500) return 'Nota muy larga (max 500)';
    return null;
  }, [liquidationDate, monto, notionalActual, tasaNeg, tasaRef, note]);

  const handleClose = useCallback(() => {
    if (loading) return;
    setError(null);
    onHide();
  }, [loading, onHide]);

  const handleConfirm = useCallback(async () => {
    if (!row) return;
    if (validation) {
      setError(validation);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await liquidateNdfPosition({
        positionId: row.id,
        liquidationDate,
        montoUsd: monto,
        tasaNegociada: tasaNeg,
        tasaReferencia: tasaRef,
        note: note.trim() || undefined,
      });
      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
      const tipo = result.data?.estado === 'Liquidado' ? 'total' : 'parcial';
      toast.success(
        `Liquidacion ${tipo} registrada — P&G bruto: ${fmtCompactCop(result.data?.pnl_cop ?? 0)} COP`,
        { autoClose: 4000 },
      );
      onSuccess();
      onHide();
    } catch (e) {
      setError((e as Error)?.message || 'Error inesperado al liquidar');
    } finally {
      setLoading(false);
    }
  }, [row, validation, liquidationDate, monto, tasaNeg, tasaRef, note, onSuccess, onHide]);

  if (!row) return null;

  const isActivo = row.estado === 'Activo';
  const positionLabel = row.id_operacion || row.label || '—';

  return (
    <Modal show={show} onHide={handleClose} centered backdrop={loading ? 'static' : true} size="lg">
      <Modal.Header closeButton={!loading} style={{ background: '#f8f9fa', borderBottom: '1px solid #dee2e6' }}>
        <Modal.Title style={{ fontSize: 16, color: '#155724', fontWeight: 600 }}>
          Liquidar NDF
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {!isActivo && (
          <Alert variant="warning" style={{ fontSize: 13 }}>
            Esta posicion no esta en estado <strong>Activo</strong> ({row.estado || 'sin estado'}).
            No se puede liquidar.
          </Alert>
        )}

        {/* ── Info de la posicion ── */}
        <div style={{
          background: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: 6,
          padding: 12, marginBottom: 14, fontSize: 12,
        }}
        >
          <Row className="g-2">
            <Col md={6}>
              <div style={{ color: '#6c757d', fontSize: 10, textTransform: 'uppercase' }}>ID Operacion</div>
              <strong style={{ fontFamily: 'monospace' }}>{positionLabel}</strong>
            </Col>
            <Col md={6}>
              <div style={{ color: '#6c757d', fontSize: 10, textTransform: 'uppercase' }}>Contraparte</div>
              <span>{row.counterparty || '—'}</span>
            </Col>
            <Col md={3}>
              <div style={{ color: '#6c757d', fontSize: 10, textTransform: 'uppercase' }}>Direction</div>
              <span style={{ fontFamily: 'monospace', textTransform: 'capitalize' }}>{direction}</span>
            </Col>
            <Col md={3}>
              <div style={{ color: '#6c757d', fontSize: 10, textTransform: 'uppercase' }}>Sociedad</div>
              <span>{row.sociedad || '—'}</span>
            </Col>
            <Col md={3}>
              <div style={{ color: '#6c757d', fontSize: 10, textTransform: 'uppercase' }}>Vencimiento</div>
              <span style={{ fontFamily: 'monospace' }}>{row.maturity_date}</span>
            </Col>
            <Col md={3}>
              <div style={{ color: '#6c757d', fontSize: 10, textTransform: 'uppercase' }}>Notional disponible</div>
              <span style={{ fontFamily: 'monospace' }}>${fmtUsd(notionalActual)} USD</span>
            </Col>
          </Row>
        </div>

        {/* ── Datos del cierre ── */}
        <div style={{ fontSize: 11, color: '#6c757d', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6, fontWeight: 600 }}>
          Datos del cierre (del banco)
        </div>
        <Row className="g-2 mb-3">
          <Col md={6}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12, marginBottom: 2 }}>Fecha de liquidacion</Form.Label>
              <Form.Control
                type="date"
                size="sm"
                value={liquidationDate}
                onChange={(e) => setLiquidationDate(e.target.value)}
                disabled={loading || !isActivo}
              />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12, marginBottom: 2 }}>
                Monto a liquidar (USD)
                {monto > 0 && monto < notionalActual && (
                  <span style={{ color: '#d97706', marginLeft: 6, fontSize: 10 }}>parcial</span>
                )}
              </Form.Label>
              <Form.Control
                type="number"
                size="sm"
                step="0.01"
                min={0.01}
                max={notionalActual}
                value={montoStr}
                onChange={(e) => setMontoStr(e.target.value)}
                disabled={loading || !isActivo}
                style={{ fontFamily: 'monospace' }}
              />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12, marginBottom: 2 }}>
                Tasa negociada
                <span style={{ color: '#6c757d', fontSize: 10, marginLeft: 4 }}>
                  (strike: ${fmtUsd(strikePosicion)})
                </span>
              </Form.Label>
              <Form.Control
                type="number"
                size="sm"
                step="0.01"
                min={0.01}
                value={tasaNegStr}
                onChange={(e) => setTasaNegStr(e.target.value)}
                disabled={loading || !isActivo}
                style={{ fontFamily: 'monospace' }}
              />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group>
              <Form.Label style={{ fontSize: 12, marginBottom: 2 }}>
                Tasa referencia
                <span style={{ color: '#6c757d', fontSize: 10, marginLeft: 4 }}>
                  (TRM al cierre)
                </span>
              </Form.Label>
              <Form.Control
                type="number"
                size="sm"
                step="0.01"
                min={0.01}
                value={tasaRefStr}
                onChange={(e) => setTasaRefStr(e.target.value)}
                disabled={loading || !isActivo}
                style={{ fontFamily: 'monospace' }}
                placeholder="ej. 3,475.72"
              />
            </Form.Group>
          </Col>
        </Row>

        {/* ── Calculo en vivo ── */}
        <div style={{
          background: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: 6,
          padding: 12, marginBottom: 14,
        }}
        >
          <div style={{ fontSize: 10, color: '#6c757d', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6, fontWeight: 600 }}>
            Saldo bruto a registrar
          </div>
          <Row className="g-3 align-items-center">
            <Col xs="auto">
              <div style={{ fontSize: 9, color: '#6c757d', textTransform: 'uppercase' }}>COP</div>
              <div style={{ fontSize: 20, fontFamily: 'monospace', fontWeight: 700, color: pnlColor(calc.pnlCop), lineHeight: 1.1 }}>
                {fmtCompactCop(calc.pnlCop)}
              </div>
              <div style={{ fontSize: 10, color: '#adb5bd', fontFamily: 'monospace' }}>
                ${fmtCop(calc.pnlCop)}
              </div>
            </Col>
            <Col xs="auto" style={{ borderLeft: '1px solid #dee2e6', paddingLeft: 16 }}>
              <div style={{ fontSize: 9, color: '#6c757d', textTransform: 'uppercase' }}>USD</div>
              <div style={{ fontSize: 16, fontFamily: 'monospace', fontWeight: 700, color: pnlColor(calc.pnlUsd), lineHeight: 1.1 }}>
                {fmtCompactUsd(calc.pnlUsd)}
              </div>
              <div style={{ fontSize: 10, color: '#adb5bd', fontFamily: 'monospace' }}>
                ${fmtUsd(calc.pnlUsd)}
              </div>
            </Col>
            <Col style={{ borderLeft: '1px solid #dee2e6', paddingLeft: 16, fontSize: 11, color: '#6c757d', fontFamily: 'monospace' }}>
              {monto > 0 && tasaNeg > 0 && tasaRef > 0 ? (
                <>
                  {fmtUsd(monto)} × ({fmtUsd(tasaNeg)} − {fmtUsd(tasaRef)}) ×{' '}
                  <span style={{ color: direction === 'sell' ? '#28a745' : '#dc3545' }}>
                    {direction === 'sell' ? '+1' : '−1'}
                  </span>
                </>
              ) : (
                <span style={{ fontStyle: 'italic', color: '#adb5bd' }}>
                  Completa los campos para ver el calculo
                </span>
              )}
            </Col>
          </Row>
          <div style={{ marginTop: 8, fontSize: 11, color: calc.esTotal ? '#6c757d' : '#d97706' }}>
            {calc.esTotal ? (
              <>✓ Liquidacion <strong>total</strong>: la posicion pasa a estado <strong>Liquidado</strong>.</>
            ) : (
              <>⚠ Liquidacion <strong>parcial</strong>: quedan <strong style={{ fontFamily: 'monospace' }}>${fmtUsd(calc.remanente)} USD</strong> activos en la posicion.</>
            )}
          </div>
        </div>

        {/* ── Nota ── */}
        <Form.Group>
          <Form.Label style={{ fontSize: 12, marginBottom: 2 }}>Nota (opcional)</Form.Label>
          <Form.Control
            as="textarea"
            rows={2}
            size="sm"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Razon de la liquidacion, # operacion del banco, etc."
            disabled={loading || !isActivo}
            maxLength={500}
          />
        </Form.Group>

        {error && (
          <Alert variant="danger" style={{ fontSize: 12, marginTop: 12, marginBottom: 0 }}>
            {error}
          </Alert>
        )}
      </Modal.Body>

      <Modal.Footer style={{ background: '#f8f9fa', borderTop: '1px solid #dee2e6' }}>
        <Button variant="secondary" size="sm" onClick={handleClose} disabled={loading}>
          Cancelar
        </Button>
        <Button
          variant="success"
          size="sm"
          onClick={handleConfirm}
          disabled={loading || !isActivo || !!validation}
        >
          {loading ? (
            <>
              <Spinner size="sm" animation="border" className="me-1" />
              Liquidando…
            </>
          ) : (
            'Confirmar liquidacion'
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
