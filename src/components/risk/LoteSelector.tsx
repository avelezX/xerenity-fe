/* eslint-disable jsx-a11y/control-has-associated-label */
/**
 * Selector de Lote de Cafe.
 *
 * Vive dentro del tab Benchmark de /risk-management cuando la empresa
 * tiene CAFE en sus commodities. Permite cambiar entre lotes y crear
 * lotes nuevos. El lote seleccionado se persiste en localStorage via
 * useAppStore.selectedLoteId.
 *
 * UI: dropdown nativo + boton "+ Nuevo lote" que abre modal.
 * Modal de creacion: solo "nombre" es obligatorio.
 */
import { useCallback, useEffect, useState } from 'react';
import { Modal, Form, Button } from 'react-bootstrap';
import { toast } from 'react-toastify';
import useAppStore from 'src/store';
import {
  fetchCafeLotes,
  insertCafeLote,
  CafeLoteRow,
} from 'src/lib/risk/supabaseRisk';

interface Props {
  companyId: string;
}

export default function LoteSelector({ companyId }: Props) {
  const [lotes, setLotes] = useState<CafeLoteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form del modal
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [origen, setOrigen] = useState('');
  const [fechaApertura, setFechaApertura] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );

  const selectedLoteId = useAppStore((s) => s.selectedLoteId);
  const setSelectedLoteId = useAppStore((s) => s.setSelectedLoteId);

  // Carga de lotes al montar / cambiar empresa
  const loadLotes = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const data = await fetchCafeLotes(companyId);
      setLotes(data);
      // Si no hay lote seleccionado o el seleccionado no esta en la lista,
      // seleccionar el primero disponible.
      if (data.length > 0 && (!selectedLoteId || !data.some((l) => l.id === selectedLoteId))) {
        setSelectedLoteId(data[0].id);
      } else if (data.length === 0 && selectedLoteId) {
        // La empresa no tiene lotes — limpiar la seleccion.
        setSelectedLoteId(undefined);
      }
    } catch (e) {
      toast.error((e as Error)?.message || 'Error cargando lotes');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  useEffect(() => {
    loadLotes();
  }, [loadLotes]);

  const openModal = () => {
    setNombre(`Lote ${lotes.length + 1}`); // sugerencia: siguiente numero
    setDescripcion('');
    setOrigen('');
    setFechaApertura(new Date().toISOString().slice(0, 10));
    setShowModal(true);
  };

  const handleCreate = async () => {
    const nombreTrim = nombre.trim();
    if (!nombreTrim) {
      toast.error('El nombre del lote es obligatorio');
      return;
    }
    setCreating(true);
    try {
      const newLote = await insertCafeLote({
        company_id: companyId,
        nombre: nombreTrim,
        descripcion: descripcion.trim() || null,
        origen: origen.trim() || null,
        fecha_apertura: fechaApertura,
      });
      setLotes((prev) => [...prev, newLote].sort(
        (a, b) => (a.fecha_apertura < b.fecha_apertura ? -1 : 1),
      ));
      setSelectedLoteId(newLote.id);
      setShowModal(false);
      toast.success(`Lote "${nombreTrim}" creado`);
    } catch (e) {
      const msg = (e as Error)?.message || 'Error creando lote';
      // Caso comun: UNIQUE constraint violation (nombre duplicado per empresa)
      if (msg.includes('cafe_lotes_company_id_nombre_key') || msg.includes('duplicate')) {
        toast.error(`Ya existe un lote con el nombre "${nombreTrim}" para esta empresa`);
      } else {
        toast.error(msg);
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="lote-selector-root">
      <div className="lote-selector-bar">
        <span className="lote-selector-label">LOTE</span>
        <select
          className="lote-selector-select"
          value={selectedLoteId ?? ''}
          onChange={(e) => setSelectedLoteId(e.target.value || undefined)}
          disabled={loading || lotes.length === 0}
        >
          {lotes.length === 0 && <option value="">— sin lotes —</option>}
          {lotes.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nombre}
              {l.origen ? ` · ${l.origen}` : ''}
              {' · '}
              {l.fecha_apertura}
            </option>
          ))}
        </select>

        <button type="button" className="lote-selector-new-btn" onClick={openModal}>
          + Nuevo lote
        </button>
      </div>

      {/* Modal de creacion */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title style={{ fontSize: '1rem', fontWeight: 600 }}>Nuevo Lote de Café</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label className="small fw-semibold">Nombre <span style={{ color: '#b91c1c' }}>*</span></Form.Label>
            <Form.Control
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="e.g., Lote 2 - Cosecha Q2 2026"
              autoFocus
            />
            <Form.Text className="text-muted small">
              Debe ser único dentro de esta empresa.
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label className="small fw-semibold">Descripción <span className="text-muted small">(opcional)</span></Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Notas operativas, cliente, calidad, etc."
            />
          </Form.Group>

          <div className="row g-3">
            <div className="col-md-6">
              <Form.Group>
                <Form.Label className="small fw-semibold">Origen <span className="text-muted small">(opcional)</span></Form.Label>
                <Form.Control
                  type="text"
                  value={origen}
                  onChange={(e) => setOrigen(e.target.value)}
                  placeholder="e.g., Anserma, Huila"
                />
              </Form.Group>
            </div>
            <div className="col-md-6">
              <Form.Group>
                <Form.Label className="small fw-semibold">Fecha apertura</Form.Label>
                <Form.Control
                  type="date"
                  value={fechaApertura}
                  onChange={(e) => setFechaApertura(e.target.value)}
                />
              </Form.Group>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" size="sm" onClick={() => setShowModal(false)} disabled={creating}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" onClick={handleCreate} disabled={creating || !nombre.trim()}>
            {creating ? 'Creando...' : 'Crear lote'}
          </Button>
        </Modal.Footer>
      </Modal>

      <style jsx>{`
        .lote-selector-root {
          margin: 8px 0 12px;
        }
        .lote-selector-bar {
          display: inline-flex;
          align-items: stretch;
          gap: 0;
          background: #ffffff;
          border: 1px solid #cbd5e1;
        }
        .lote-selector-label {
          display: inline-flex;
          align-items: center;
          padding: 0 10px;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.12em;
          color: #64748b;
          background: #f8fafc;
          border-right: 1px solid #e2e8f0;
          font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
        }
        .lote-selector-select {
          font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.02em;
          color: #0f172a;
          background: #ffffff;
          padding: 5px 28px 5px 10px;
          min-width: 280px;
          border: none;
          outline: none;
          appearance: none;
          background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 8px center;
          cursor: pointer;
        }
        .lote-selector-select:hover:not(:disabled) {
          background-color: #f8fafc;
        }
        .lote-selector-select:disabled {
          color: #94a3b8;
          cursor: not-allowed;
        }
        .lote-selector-new-btn {
          font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.04em;
          color: #1e293b;
          background: #f8fafc;
          border: none;
          border-left: 1px solid #e2e8f0;
          padding: 0 14px;
          cursor: pointer;
          transition: background-color 80ms ease, color 80ms ease;
          white-space: nowrap;
        }
        .lote-selector-new-btn:hover {
          background: #9a3412;
          color: #ffffff;
        }
      `}
      </style>
    </div>
  );
}
