import React, { useEffect, useState } from 'react';
import { Modal, Form } from 'react-bootstrap';
import { toast } from 'react-toastify';
import Button from '@components/UI/Button';
import useAppStore from 'src/store';
import type { AgentSkill } from 'src/types/agent-config';

interface Props {
  show: boolean;
  skill: AgentSkill | null;
  onClose: () => void;
}

export default function SkillEditorModal({ show, skill, onClose }: Props) {
  const { createAgentSkill, updateAgentSkill } = useAppStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [displayOrder, setDisplayOrder] = useState(100);
  const [changeNote, setChangeNote] = useState('');
  const [saving, setSaving] = useState(false);

  const isEdit = !!skill;

  useEffect(() => {
    if (show) {
      if (skill) {
        setName(skill.name);
        setDescription(skill.description || '');
        setContent(skill.content);
        setDisplayOrder(skill.display_order);
        setChangeNote('');
      } else {
        setName('');
        setDescription('');
        setContent('');
        setDisplayOrder(100);
        setChangeNote('');
      }
    }
  }, [show, skill]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }
    if (!content.trim()) {
      toast.error('El contenido es obligatorio');
      return;
    }
    if (isEdit && !changeNote.trim()) {
      toast.error('La nota del cambio es obligatoria al editar');
      return;
    }

    setSaving(true);
    const payload = {
      name: name.trim(),
      description: description.trim(),
      content,
      display_order: displayOrder,
    };

    const res = isEdit
      ? await updateAgentSkill(skill!.id, payload, changeNote.trim())
      : await createAgentSkill(payload);

    setSaving(false);

    if (res.success) {
      toast.success(isEdit ? 'Skill actualizada' : 'Skill creada');
      onClose();
    } else {
      toast.error(res.error || 'Error al guardar');
    }
  };

  return (
    <Modal show={show} onHide={onClose} size="xl" centered>
      <Modal.Header closeButton>
        <Modal.Title>{isEdit ? `Editar Skill: ${skill!.name}` : 'Nueva Skill'}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <div className="row">
            <div className="col-sm-9">
              <Form.Group className="mb-3">
                <Form.Label>Nombre</Form.Label>
                <Form.Control
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Inteligencia economica"
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
            <Form.Label>Descripcion (opcional)</Form.Label>
            <Form.Control
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Resumen corto del skill"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Contenido (markdown)</Form.Label>
            <Form.Control
              as="textarea"
              rows={20}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="## Titulo&#10;&#10;Instrucciones del skill en markdown..."
              style={{ fontFamily: 'monospace', fontSize: 12 }}
            />
          </Form.Group>

          {isEdit && (
            <Form.Group className="mb-3">
              <Form.Label>Nota del cambio (obligatoria)</Form.Label>
              <Form.Control
                value={changeNote}
                onChange={(e) => setChangeNote(e.target.value)}
                placeholder="Ej: Agregue patron de busqueda para empleo"
              />
            </Form.Group>
          )}
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
