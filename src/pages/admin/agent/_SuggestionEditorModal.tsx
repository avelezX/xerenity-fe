import React, { useEffect, useState } from 'react';
import { Modal, Form } from 'react-bootstrap';
import { toast } from 'react-toastify';
import Button from '@components/UI/Button';
import useAppStore from 'src/store';
import type { AgentSuggestion } from 'src/types/agent-config';

interface Props {
  show: boolean;
  suggestion: AgentSuggestion | null;
  onClose: () => void;
}

export default function SuggestionEditorModal({ show, suggestion, onClose }: Props) {
  const { createAgentSuggestion, updateAgentSuggestion } = useAppStore();

  const [icon, setIcon] = useState('💬');
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [displayOrder, setDisplayOrder] = useState(100);
  const [saving, setSaving] = useState(false);

  const isEdit = !!suggestion;

  useEffect(() => {
    if (show) {
      if (suggestion) {
        setIcon(suggestion.icon);
        setTitle(suggestion.title);
        setPrompt(suggestion.prompt);
        setDisplayOrder(suggestion.display_order);
      } else {
        setIcon('💬');
        setTitle('');
        setPrompt('');
        setDisplayOrder(100);
      }
    }
  }, [show, suggestion]);

  const handleSave = async () => {
    if (!title.trim() || !prompt.trim()) {
      toast.error('Titulo y prompt son obligatorios');
      return;
    }

    setSaving(true);
    const payload = {
      icon: icon || '💬',
      title: title.trim(),
      prompt: prompt.trim(),
      display_order: displayOrder,
    };

    const res = isEdit
      ? await updateAgentSuggestion(suggestion!.id, payload)
      : await createAgentSuggestion(payload);

    setSaving(false);

    if (res.success) {
      toast.success(isEdit ? 'Sugerencia actualizada' : 'Sugerencia creada');
      onClose();
    } else {
      toast.error(res.error || 'Error');
    }
  };

  return (
    <Modal show={show} onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>{isEdit ? 'Editar Sugerencia' : 'Nueva Sugerencia'}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <div className="row">
            <div className="col-sm-3">
              <Form.Group className="mb-3">
                <Form.Label>Icono</Form.Label>
                <Form.Control
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  placeholder="💬"
                  maxLength={4}
                  style={{ fontSize: 20, textAlign: 'center' }}
                />
              </Form.Group>
            </div>
            <div className="col-sm-3">
              <Form.Group className="mb-3">
                <Form.Label>Orden</Form.Label>
                <Form.Control
                  type="number"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(parseInt(e.target.value, 10) || 100)}
                />
              </Form.Group>
            </div>
          </div>

          <Form.Group className="mb-3">
            <Form.Label>Titulo (texto del boton)</Form.Label>
            <Form.Control
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Graficame la TRM"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Prompt (lo que se envia al agente al hacer click)</Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Graficame la TRM de los ultimos 6 meses"
            />
            <Form.Text className="text-muted">
              Puede ser distinto al titulo si quieres que el boton diga algo corto pero el prompt sea mas especifico.
            </Form.Text>
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
