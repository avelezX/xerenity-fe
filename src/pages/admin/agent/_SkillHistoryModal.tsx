import React, { useEffect, useState } from 'react';
import { Modal, Form, Badge } from 'react-bootstrap';
import { toast } from 'react-toastify';
import styled from 'styled-components';
import Button from '@components/UI/Button';
import useAppStore from 'src/store';
import type { AgentSkill, AgentSkillVersion } from 'src/types/agent-config';

const SplitLayout = styled.div`
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 16px;
  min-height: 500px;
`;

const VersionList = styled.div`
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  overflow-y: auto;
  max-height: 500px;
`;

const VersionItem = styled.div<{ $selected?: boolean }>`
  padding: 10px 12px;
  border-bottom: 1px solid #f1f5f9;
  cursor: pointer;
  background: ${(p) => (p.$selected ? '#eef2ff' : 'white')};
  &:hover { background: ${(p) => (p.$selected ? '#eef2ff' : '#f8fafc')}; }

  .version-num { font-weight: 600; font-size: 12px; color: #4F46E5; }
  .version-meta { font-size: 11px; color: #64748b; margin-top: 2px; }
  .version-note { font-size: 11px; color: #334155; margin-top: 4px; font-style: italic; }
`;

interface Props {
  show: boolean;
  skill: AgentSkill | null;
  onClose: () => void;
}

export default function SkillHistoryModal({ show, skill, onClose }: Props) {
  const {
    agentSkillVersions,
    agentSkillVersionsLoading,
    loadAgentSkillVersions,
    revertAgentSkill,
  } = useAppStore();

  const [selected, setSelected] = useState<AgentSkillVersion | null>(null);
  const [reverting, setReverting] = useState(false);

  useEffect(() => {
    if (show && skill) {
      loadAgentSkillVersions(skill.id);
      setSelected(null);
    }
  }, [show, skill, loadAgentSkillVersions]);

  useEffect(() => {
    if (agentSkillVersions.length > 0 && !selected) {
      setSelected(agentSkillVersions[0]);
    }
  }, [agentSkillVersions, selected]);

  const handleRevert = async () => {
    if (!skill || !selected) return;
    if (selected.version_number === skill.current_version) {
      toast.info('Esta es la version actual');
      return;
    }
    // eslint-disable-next-line no-alert
    const note = window.prompt(
      `Revertir a v${selected.version_number}?\n\nNota del cambio (opcional):`,
      `Revert a version ${selected.version_number}`,
    );
    if (note === null) return;

    setReverting(true);
    const res = await revertAgentSkill(skill.id, selected.id, note);
    setReverting(false);

    if (res.success) {
      toast.success('Revertido exitosamente');
      onClose();
    } else {
      toast.error(res.error || 'Error al revertir');
    }
  };

  if (!skill) return null;

  return (
    <Modal show={show} onHide={onClose} size="xl" centered>
      <Modal.Header closeButton>
        <Modal.Title>Historial: {skill.name}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <SplitLayout>
          <VersionList>
            {agentSkillVersionsLoading && (
              <div style={{ padding: 16, textAlign: 'center', color: '#64748b' }}>Cargando...</div>
            )}
            {!agentSkillVersionsLoading && agentSkillVersions.length === 0 && (
              <div style={{ padding: 16, textAlign: 'center', color: '#64748b' }}>Sin versiones</div>
            )}
            {agentSkillVersions.map((v) => (
              <VersionItem
                key={v.id}
                $selected={selected?.id === v.id}
                onClick={() => setSelected(v)}
              >
                <div className="version-num">
                  v{v.version_number}
                  {v.version_number === skill.current_version && (
                    <Badge bg="success" className="ms-2" style={{ fontSize: 9 }}>ACTUAL</Badge>
                  )}
                </div>
                <div className="version-meta">
                  {new Date(v.changed_at).toLocaleString()}
                  {v.changed_by_email && ` · ${v.changed_by_email}`}
                </div>
                {v.change_note && (
                  <div className="version-note">{v.change_note}</div>
                )}
              </VersionItem>
            ))}
          </VersionList>

          <div>
            {selected ? (
              <>
                <div className="mb-2">
                  <strong>{selected.name}</strong> — v{selected.version_number}
                </div>
                <Form.Control
                  as="textarea"
                  rows={22}
                  value={selected.content}
                  readOnly
                  style={{ fontFamily: 'monospace', fontSize: 11 }}
                />
              </>
            ) : (
              <div style={{ color: '#94a3b8', padding: 24 }}>Selecciona una version para ver el contenido</div>
            )}
          </div>
        </SplitLayout>
      </Modal.Body>
      <Modal.Footer>
        {selected && selected.version_number !== skill.current_version && (
          <Button variant="primary" onClick={handleRevert} disabled={reverting}>
            {reverting ? 'Revirtiendo...' : `Revertir a v${selected.version_number}`}
          </Button>
        )}
        <Button variant="secondary" onClick={onClose}>Cerrar</Button>
      </Modal.Footer>
    </Modal>
  );
}
