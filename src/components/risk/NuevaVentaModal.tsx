/**
 * NuevaVentaModal — formulario para registrar una venta nueva
 * (tipo_venta='factura_cop') de forma manual.
 *
 * Campos: fecha, factura, cliente, producto, kilos, valor_kilo (COP/kg).
 *
 * Al guardar, hace lookups inline a Supabase para capturar TRM BanRep y
 * precio KC al dia de la venta — quedan persistidos en la fila para
 * que los calculos de USD/exposicion no dependan de futuros refetch.
 *
 * Si el lookup falla (sin TRM/KC para esa fecha) inserta igual con
 * NULL en esos campos — no es bloqueante.
 *
 * Lista de clientes existentes se ofrece como sugerencia en datalist;
 * el usuario puede tipear uno nuevo libremente.
 */
import React, { useMemo, useState } from 'react';
import { Modal, Form, Button, Spinner, Alert } from 'react-bootstrap';
import { toast } from 'react-toastify';
import {
  insertCafeVenta,
  fetchTrmAtDate,
  fetchKcPriceAtDate,
  type CafeVentaRow,
} from 'src/lib/risk/supabaseRisk';
import { kgVerdeEquiv, kgVerdeFactor } from 'src/lib/risk/cafeVerdeFactor';

interface Props {
  show: boolean;
  onHide: () => void;
  companyId: string;
  /** Para sugerencias en el datalist del cliente. */
  existingRows: CafeVentaRow[];
  /** Callback al insertar exitosamente — el parent debe refetch la lista. */
  onSaved: () => void | Promise<void>;
}

const todayIso = (): string => new Date().toISOString().slice(0, 10);

const KG_PER_SACO = 70;

export default function NuevaVentaModal({
  show, onHide, companyId, existingRows, onSaved,
}: Props) {
  const [fecha, setFecha] = useState<string>(todayIso());
  const [factura, setFactura] = useState<string>('');
  const [cliente, setCliente] = useState<string>('');
  const [producto, setProducto] = useState<string>('');
  const [kilos, setKilos] = useState<string>('');
  const [valorKilo, setValorKilo] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lista de clientes existentes (unica) para el datalist
  const clientesExistentes = useMemo(() => {
    const set = new Set<string>();
    existingRows.forEach((r) => {
      if (r.tipo_venta === 'factura_cop' && r.cliente) set.add(r.cliente);
    });
    return Array.from(set).sort();
  }, [existingRows]);

  // Productos vistos historicamente, para sugerir
  const productosExistentes = useMemo(() => {
    const set = new Set<string>();
    existingRows.forEach((r) => {
      if (r.tipo_venta === 'factura_cop' && r.producto) set.add(r.producto);
    });
    return Array.from(set).sort();
  }, [existingRows]);

  // Preview del calculo (en vivo mientras tipea)
  const preview = useMemo(() => {
    const k = parseFloat(kilos) || 0;
    const v = parseFloat(valorKilo) || 0;
    const totalCop = k * v;
    const sacos = k / KG_PER_SACO;
    const factor = kgVerdeFactor(producto);
    const kVerde = kgVerdeEquiv(producto, k);
    return { k, v, totalCop, sacos, factor, kVerde };
  }, [kilos, valorKilo, producto]);

  const reset = () => {
    setFecha(todayIso());
    setFactura('');
    setCliente('');
    setProducto('');
    setKilos('');
    setValorKilo('');
    setError(null);
  };

  const handleClose = () => {
    if (saving) return;
    reset();
    onHide();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validaciones basicas
    const k = parseFloat(kilos);
    const v = parseFloat(valorKilo);
    if (!fecha) { setError('La fecha es requerida'); return; }
    if (!factura.trim()) { setError('La factura es requerida'); return; }
    if (!cliente.trim()) { setError('El cliente es requerido'); return; }
    if (!producto.trim()) { setError('El producto es requerido'); return; }
    if (!Number.isFinite(k) || k <= 0) { setError('Kilos debe ser > 0'); return; }
    if (!Number.isFinite(v) || v <= 0) { setError('Valor / Kilo debe ser > 0'); return; }

    setSaving(true);
    try {
      // Lookups paralelos al dia de la venta (no bloqueante si fallan)
      const [trm, kc] = await Promise.all([
        fetchTrmAtDate(fecha).catch(() => null),
        fetchKcPriceAtDate(fecha).catch(() => null),
      ]);

      const row: Omit<CafeVentaRow, 'id' | 'created_at' | 'updated_at'> = {
        company_id: companyId,
        tipo_venta: 'factura_cop',
        fecha_fijacion: fecha,
        factura: factura.trim(),
        cliente: cliente.trim(),
        producto: producto.trim(),
        sacos: k / KG_PER_SACO,
        kg: k,
        valor_kilo: v,
        moneda: 'COP',
        estado: 'Facturada',
        trm_dia: trm,
        precio_kc_cents: kc,
        ref_contrato: factura.trim(),
        // Campos NY no aplican
        ny_mes: '',
        calidad: '',
        fijacion_ny: null,
        prima: null,
        fijacion_cop: null,
      };

      await insertCafeVenta(row);
      toast.success(`Venta ${factura} registrada · TRM ${trm ?? 'N/A'} · KC ${kc ?? 'N/A'}`);
      await onSaved();
      reset();
      onHide();
    } catch (err) {
      const msg = (err as Error)?.message ?? 'Error desconocido';
      setError(msg);
      toast.error(`Error al guardar: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal show={show} onHide={handleClose} centered size="lg" backdrop={saving ? 'static' : true}>
      <Modal.Header closeButton={!saving}>
        <Modal.Title style={{ fontSize: 16, color: '#0f766e' }}>
          ☕ Registrar nueva venta de cafe
        </Modal.Title>
      </Modal.Header>

      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          {error && (
            <Alert variant="danger" className="mb-3" style={{ fontSize: 13 }}>
              {error}
            </Alert>
          )}

          <div className="row g-3">
            <div className="col-md-4">
              <Form.Label style={{ fontSize: 12, fontWeight: 600 }}>Fecha</Form.Label>
              <Form.Control
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                required
                size="sm"
              />
            </div>
            <div className="col-md-4">
              <Form.Label style={{ fontSize: 12, fontWeight: 600 }}>
                # Factura <span style={{ color: '#dc2626' }}>*</span>
              </Form.Label>
              <Form.Control
                type="text"
                value={factura}
                onChange={(e) => setFactura(e.target.value)}
                placeholder="EMB-451"
                required
                size="sm"
              />
            </div>
            <div className="col-md-4">
              <Form.Label style={{ fontSize: 12, fontWeight: 600 }}>Moneda</Form.Label>
              <Form.Control
                type="text"
                value="COP"
                readOnly
                disabled
                size="sm"
                style={{ background: '#f1f5f9' }}
              />
            </div>

            <div className="col-md-6">
              <Form.Label style={{ fontSize: 12, fontWeight: 600 }}>
                Cliente <span style={{ color: '#dc2626' }}>*</span>
              </Form.Label>
              <Form.Control
                type="text"
                list="clientes-existentes"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                placeholder="Ej: SUCAFINA COLOMBIA SAS"
                required
                size="sm"
              />
              <datalist id="clientes-existentes">
                {clientesExistentes.map((c) => <option key={c} value={c} aria-label={c} />)}
              </datalist>
              <Form.Text className="text-muted" style={{ fontSize: 10 }}>
                Tipea uno nuevo o elige de la lista historica.
              </Form.Text>
            </div>
            <div className="col-md-6">
              <Form.Label style={{ fontSize: 12, fontWeight: 600 }}>
                Producto <span style={{ color: '#dc2626' }}>*</span>
              </Form.Label>
              <Form.Control
                type="text"
                list="productos-existentes"
                value={producto}
                onChange={(e) => setProducto(e.target.value)}
                placeholder="Ej: WIZARD, CAFE PERGAMINO SECO"
                required
                size="sm"
              />
              <datalist id="productos-existentes">
                {productosExistentes.map((p) => <option key={p} value={p} aria-label={p} />)}
              </datalist>
            </div>

            <div className="col-md-4">
              <Form.Label style={{ fontSize: 12, fontWeight: 600 }}>
                Kilos <span style={{ color: '#dc2626' }}>*</span>
              </Form.Label>
              <Form.Control
                type="number"
                step="0.01"
                min="0"
                value={kilos}
                onChange={(e) => setKilos(e.target.value)}
                placeholder="ej. 1500"
                required
                size="sm"
                style={{ textAlign: 'right', fontFamily: 'monospace' }}
              />
            </div>
            <div className="col-md-4">
              <Form.Label style={{ fontSize: 12, fontWeight: 600 }}>
                Valor / Kilo (COP) <span style={{ color: '#dc2626' }}>*</span>
              </Form.Label>
              <Form.Control
                type="number"
                step="0.01"
                min="0"
                value={valorKilo}
                onChange={(e) => setValorKilo(e.target.value)}
                placeholder="ej. 35000"
                required
                size="sm"
                style={{ textAlign: 'right', fontFamily: 'monospace' }}
              />
            </div>
            <div className="col-md-4">
              <Form.Label style={{ fontSize: 12, fontWeight: 600 }}>
                Sacos (auto)
              </Form.Label>
              <Form.Control
                type="text"
                value={preview.sacos > 0 ? preview.sacos.toFixed(2) : ''}
                readOnly
                disabled
                size="sm"
                style={{ background: '#f1f5f9', textAlign: 'right', fontFamily: 'monospace' }}
              />
              <Form.Text className="text-muted" style={{ fontSize: 10 }}>
                kilos / 70 (saco excelso)
              </Form.Text>
            </div>
          </div>

          {/* Preview del total + factor verde */}
          {preview.totalCop > 0 && (
            <div style={{
              marginTop: 18,
              padding: '12px 16px',
              background: 'linear-gradient(135deg, #f0fdf4 0%, #f8fafc 100%)',
              borderRadius: 8,
              border: '1px solid #bbf7d0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 16,
            }}
            >
              <div>
                <div style={{ fontSize: 10, color: '#15803d', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Total venta
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', color: '#14532d' }}>
                  ${preview.totalCop.toLocaleString('en-US', { maximumFractionDigits: 0 })} COP
                </div>
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                  = {preview.k.toLocaleString('en-US')} kg × ${preview.v.toLocaleString('en-US')}/kg
                </div>
              </div>
              <div style={{
                fontSize: 11,
                color: '#64748b',
                textAlign: 'right',
                borderLeft: '1px solid #bbf7d0',
                paddingLeft: 16,
                minWidth: 220,
              }}
              >
                <div style={{ fontWeight: 600, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 10 }}>
                  Hedge KC equivalente
                </div>
                <div style={{ marginTop: 4, fontFamily: 'monospace', color: '#0f172a' }}>
                  {preview.kVerde.toLocaleString('en-US', { maximumFractionDigits: 0 })} kg verde
                  <span style={{ color: '#94a3b8' }}> · factor {preview.factor.toFixed(2)}</span>
                </div>
                <div style={{ marginTop: 4, fontSize: 10, color: '#64748b' }}>
                  {(() => {
                    const p = producto.toUpperCase();
                    if (p.includes('PASILLA')) return 'Pasilla = sin hedge KC';
                    if (p.includes('PERGAMINO')) return 'Pergamino → verde (×0.80 trilla)';
                    if (p.includes('CEREZA')) return 'Cereza → verde (×0.143 trillla + secado)';
                    return 'Producto verde (×1.0)';
                  })()}
                </div>
                <div style={{ marginTop: 6, fontSize: 10, color: '#94a3b8' }}>
                  TRM + KC se buscaran al guardar.
                </div>
              </div>
            </div>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button variant="outline-secondary" size="sm" onClick={handleClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" type="submit" disabled={saving}>
            {saving ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Guardando...
              </>
            ) : (
              'Guardar venta'
            )}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
