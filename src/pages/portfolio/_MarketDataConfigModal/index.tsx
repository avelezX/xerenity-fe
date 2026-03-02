import React, { useState, useEffect } from 'react';
import { Modal, Form } from 'react-bootstrap';
import Button from '@components/UI/Button';
import type {
  MarketDataConfig,
  SpotFxSource,
  NdfCurveSource,
  IbrSource,
  SofrSource,
} from 'src/types/trading';

const SPOT_FX_OPTIONS: { value: SpotFxSource; label: string }[] = [
  { value: 'set_fx', label: 'SET FX' },
  { value: 'fxempire', label: 'FXEmpire' },
  { value: 'manual', label: 'Manual' },
];

const NDF_CURVE_OPTIONS: { value: NdfCurveSource; label: string }[] = [
  { value: 'fxempire_fwd_pts', label: 'FXEmpire (fwd pts)' },
  { value: 'dtcc', label: 'DTCC' },
  { value: 'implied', label: 'Implied' },
  { value: 'manual', label: 'Manual' },
];

const IBR_OPTIONS: { value: IbrSource; label: string }[] = [
  { value: 'banrep', label: 'Banrep' },
  { value: 'set', label: 'SET' },
  { value: 'manual', label: 'Manual' },
];

const SOFR_OPTIONS: { value: SofrSource; label: string }[] = [
  { value: 'fed', label: 'Fed (NY Fed)' },
  { value: 'dtcc', label: 'DTCC' },
  { value: 'manual', label: 'Manual' },
];

interface Props {
  show: boolean;
  onHide: () => void;
  config: MarketDataConfig;
  onSave: (config: MarketDataConfig) => Promise<void>;
}

export default function MarketDataConfigModal({
  show,
  onHide,
  config,
  onSave,
}: Props) {
  const [draft, setDraft] = useState<MarketDataConfig>(config);
  const [saving, setSaving] = useState(false);

  // Sync draft when modal opens
  useEffect(() => {
    if (show) setDraft(config);
  }, [show, config]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      onHide();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered size="sm">
      <Modal.Header closeButton>
        <Modal.Title style={{ fontSize: 15 }}>
          Fuentes de Market Data
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Form.Group className="mb-3">
            <Form.Label style={{ fontSize: 12, fontWeight: 600, color: '#495057' }}>
              Spot FX
            </Form.Label>
            <Form.Select
              size="sm"
              value={draft.spot_fx}
              onChange={(e) =>
                setDraft((d) => ({ ...d, spot_fx: e.target.value as SpotFxSource }))
              }
            >
              {SPOT_FX_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label style={{ fontSize: 12, fontWeight: 600, color: '#495057' }}>
              Curva NDF
            </Form.Label>
            <Form.Select
              size="sm"
              value={draft.ndf_curve}
              onChange={(e) =>
                setDraft((d) => ({ ...d, ndf_curve: e.target.value as NdfCurveSource }))
              }
            >
              {NDF_CURVE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label style={{ fontSize: 12, fontWeight: 600, color: '#495057' }}>
              IBR
            </Form.Label>
            <Form.Select
              size="sm"
              value={draft.ibr}
              onChange={(e) =>
                setDraft((d) => ({ ...d, ibr: e.target.value as IbrSource }))
              }
            >
              {IBR_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-1">
            <Form.Label style={{ fontSize: 12, fontWeight: 600, color: '#495057' }}>
              SOFR
            </Form.Label>
            <Form.Select
              size="sm"
              value={draft.sofr}
              onChange={(e) =>
                setDraft((d) => ({ ...d, sofr: e.target.value as SofrSource }))
              }
            >
              {SOFR_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer style={{ padding: '8px 16px' }}>
        <Button variant="outline-secondary" size="sm" onClick={onHide} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
