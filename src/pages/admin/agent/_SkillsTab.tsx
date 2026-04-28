import React, { useEffect, useState } from 'react';
import { Form, Badge } from 'react-bootstrap';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faPlus, faPenToSquare, faTrash, faClockRotateLeft,
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import styled from 'styled-components';
import Button from '@components/UI/Button';
import useAppStore from 'src/store';
import type { AgentSkill } from 'src/types/agent-config';
import SkillEditorModal from './_SkillEditorModal';
import SkillHistoryModal from './_SkillHistoryModal';

const TableWrap = styled.div`
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  margin-bottom: 16px;

  .table { margin-bottom: 0; }
  .table thead th {
    background: #302b63 !important;
    color: #fff !important;
    font-size: 11px !important;
    font-weight: 600 !important;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 10px 12px !important;
  }
  .table tbody td {
    font-size: 13px;
    vertical-align: middle !important;
    padding: 8px 12px !important;
    border-color: #eee !important;
  }
  .table tbody tr:nth-child(even) { background: #fafaff; }
  .table tbody tr:hover { background: rgba(48, 43, 99, 0.06) !important; }
`;

const ActionBtn = styled.button`
  background: none;
  border: none;
  color: #6c757d;
  cursor: pointer;
  padding: 4px 6px;
  margin-right: 4px;
  &:hover { color: #302b63; }
  &.danger:hover { color: #dc3545; }
`;

export default function SkillsTab() {
  const {
    agentSkills,
    agentSkillsLoading,
    loadAgentSkills,
    toggleAgentSkill,
    deleteAgentSkill,
  } = useAppStore();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<AgentSkill | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historySkill, setHistorySkill] = useState<AgentSkill | null>(null);

  useEffect(() => {
    loadAgentSkills();
  }, [loadAgentSkills]);

  const handleNew = () => {
    setEditingSkill(null);
    setEditorOpen(true);
  };

  const handleEdit = (skill: AgentSkill) => {
    setEditingSkill(skill);
    setEditorOpen(true);
  };

  const handleHistory = (skill: AgentSkill) => {
    setHistorySkill(skill);
    setHistoryOpen(true);
  };

  const handleToggle = async (skill: AgentSkill) => {
    const res = await toggleAgentSkill(skill.id, !skill.active);
    if (res.success) {
      toast.success(`Skill ${skill.active ? 'desactivada' : 'activada'}`);
    } else {
      toast.error(res.error || 'Error');
    }
  };

  const handleDelete = async (skill: AgentSkill) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Eliminar skill "${skill.name}"? Esta accion borra todas sus versiones.`)) return;
    const res = await deleteAgentSkill(skill.id);
    if (res.success) {
      toast.success('Skill eliminada');
    } else {
      toast.error(res.error || 'Error');
    }
  };

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <strong>Skills del Agente ({agentSkills.length})</strong>
          <div style={{ fontSize: 12, color: '#6c757d' }}>
            Los skills se concatenan al prompt del agente en orden. Los cambios tardan hasta 60s en reflejarse (cache).
          </div>
        </div>
        <Button variant="primary" onClick={handleNew}>
          <Icon icon={faPlus} className="me-2" />
          Nueva Skill
        </Button>
      </div>

      <TableWrap>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>Orden</th>
              <th>Nombre</th>
              <th>Descripcion</th>
              <th style={{ width: 80 }}>Version</th>
              <th style={{ width: 80 }}>Activa</th>
              <th style={{ width: 150 }}>Actualizada</th>
              <th style={{ width: 140 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {agentSkillsLoading && (
              <tr><td colSpan={7} className="text-center">Cargando...</td></tr>
            )}
            {!agentSkillsLoading && agentSkills.length === 0 && (
              <tr><td colSpan={7} className="text-center text-muted">No hay skills configuradas</td></tr>
            )}
            {agentSkills.map((skill) => (
              <tr key={skill.id}>
                <td>{skill.display_order}</td>
                <td><strong>{skill.name}</strong></td>
                <td style={{ color: '#6c757d' }}>{skill.description || '—'}</td>
                <td><Badge bg="secondary">v{skill.current_version}</Badge></td>
                <td>
                  <Form.Check
                    type="switch"
                    checked={skill.active}
                    onChange={() => handleToggle(skill)}
                  />
                </td>
                <td style={{ fontSize: 11, color: '#6c757d' }}>
                  {new Date(skill.updated_at).toLocaleString()}
                </td>
                <td>
                  <ActionBtn onClick={() => handleEdit(skill)} title="Editar">
                    <Icon icon={faPenToSquare} />
                  </ActionBtn>
                  <ActionBtn onClick={() => handleHistory(skill)} title="Historial">
                    <Icon icon={faClockRotateLeft} />
                  </ActionBtn>
                  <ActionBtn className="danger" onClick={() => handleDelete(skill)} title="Eliminar">
                    <Icon icon={faTrash} />
                  </ActionBtn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>

      <SkillEditorModal
        show={editorOpen}
        skill={editingSkill}
        onClose={() => setEditorOpen(false)}
      />
      <SkillHistoryModal
        show={historyOpen}
        skill={historySkill}
        onClose={() => setHistoryOpen(false)}
      />
    </>
  );
}
