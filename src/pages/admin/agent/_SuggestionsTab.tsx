import React, { useEffect, useState } from 'react';
import { Form } from 'react-bootstrap';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import { faPlus, faPenToSquare, faTrash } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import styled from 'styled-components';
import Button from '@components/UI/Button';
import useAppStore from 'src/store';
import type { AgentSuggestion } from 'src/types/agent-config';
import SuggestionEditorModal from './_SuggestionEditorModal';

const TableWrap = styled.div`
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);

  .table { margin-bottom: 0; }
  .table thead th {
    background: #302b63 !important;
    color: #fff !important;
    font-size: 11px !important;
    font-weight: 600 !important;
    text-transform: uppercase;
    padding: 10px 12px !important;
  }
  .table tbody td {
    font-size: 13px;
    vertical-align: middle !important;
    padding: 8px 12px !important;
    border-color: #eee !important;
  }
  .table tbody tr:nth-child(even) { background: #fafaff; }
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

export default function SuggestionsTab() {
  const {
    agentSuggestions,
    agentSuggestionsLoading,
    loadAgentSuggestions,
    toggleAgentSuggestion,
    deleteAgentSuggestion,
  } = useAppStore();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AgentSuggestion | null>(null);

  useEffect(() => {
    loadAgentSuggestions();
  }, [loadAgentSuggestions]);

  const handleToggle = async (s: AgentSuggestion) => {
    const res = await toggleAgentSuggestion(s.id, !s.active);
    if (res.success) toast.success(`Sugerencia ${s.active ? 'desactivada' : 'activada'}`);
    else toast.error(res.error || 'Error');
  };

  const handleDelete = async (s: AgentSuggestion) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Eliminar sugerencia "${s.title}"?`)) return;
    const res = await deleteAgentSuggestion(s.id);
    if (res.success) toast.success('Sugerencia eliminada');
    else toast.error(res.error || 'Error');
  };

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <strong>Sugerencias del Chat ({agentSuggestions.length})</strong>
          <div style={{ fontSize: 12, color: '#6c757d' }}>
            Botones que aparecen al abrir el chat vacio. Al hacer click, envian el prompt al agente.
          </div>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setEditing(null);
            setEditorOpen(true);
          }}
        >
          <Icon icon={faPlus} className="me-2" />
          Nueva Sugerencia
        </Button>
      </div>

      <TableWrap>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>Orden</th>
              <th style={{ width: 60 }}>Icono</th>
              <th>Titulo</th>
              <th>Prompt</th>
              <th style={{ width: 80 }}>Activa</th>
              <th style={{ width: 100 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {agentSuggestionsLoading && (
              <tr><td colSpan={6} className="text-center">Cargando...</td></tr>
            )}
            {!agentSuggestionsLoading && agentSuggestions.length === 0 && (
              <tr><td colSpan={6} className="text-center text-muted">No hay sugerencias</td></tr>
            )}
            {agentSuggestions.map((s) => (
              <tr key={s.id}>
                <td>{s.display_order}</td>
                <td style={{ fontSize: 20 }}>{s.icon}</td>
                <td><strong>{s.title}</strong></td>
                <td style={{ color: '#6c757d', maxWidth: 400 }}>
                  <span title={s.prompt}>
                    {s.prompt.length > 80 ? `${s.prompt.slice(0, 80)}...` : s.prompt}
                  </span>
                </td>
                <td>
                  <Form.Check
                    type="switch"
                    checked={s.active}
                    onChange={() => handleToggle(s)}
                  />
                </td>
                <td>
                  <ActionBtn
                    onClick={() => {
                      setEditing(s);
                      setEditorOpen(true);
                    }}
                    title="Editar"
                  >
                    <Icon icon={faPenToSquare} />
                  </ActionBtn>
                  <ActionBtn className="danger" onClick={() => handleDelete(s)} title="Eliminar">
                    <Icon icon={faTrash} />
                  </ActionBtn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>

      <SuggestionEditorModal
        show={editorOpen}
        suggestion={editing}
        onClose={() => setEditorOpen(false)}
      />
    </>
  );
}
