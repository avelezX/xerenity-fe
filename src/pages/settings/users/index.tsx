'use client';

import React, { useEffect, useState } from 'react';
import { CoreLayout } from '@layout';
import { Container, Row, Col, Table, Modal, Form, Badge } from 'react-bootstrap';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import { faUsers, faPlus, faToggleOn, faToggleOff } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import PageTitle from '@components/PageTitle';
import Button from '@components/UI/Button';
import useAppStore from 'src/store';
import RoleGuard from 'src/components/RoleGuard';
import type { UserRole } from 'src/types/user';

const ASSIGNABLE_ROLES: UserRole[] = ['corp_admin', 'gestor', 'lector'];

const UsersPage = () => {
  const {
    userProfile,
    companyUsers,
    invitations,
    userLoading,
    loadUserProfile,
    loadCompanyUsers,
    loadInvitations,
    inviteUser,
    updateUserRole,
    deactivateUser,
  } = useAppStore();

  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('lector');

  useEffect(() => {
    loadUserProfile();
    loadCompanyUsers();
    loadInvitations();
  }, [loadUserProfile, loadCompanyUsers, loadInvitations]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      toast.error('El email es requerido');
      return;
    }
    const res = await inviteUser(inviteEmail.trim(), inviteRole);
    if (res.success) {
      toast.success('Invitacion enviada');
      setShowInvite(false);
      setInviteEmail('');
      setInviteRole('lector');
    } else {
      toast.error(res.error || 'Error al enviar invitacion');
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    const res = await updateUserRole(userId, newRole);
    if (res.success) {
      toast.success('Rol actualizado');
    } else {
      toast.error(res.error || 'Error al actualizar rol');
    }
  };

  const handleToggleActive = async (userId: string, isActive: boolean) => {
    if (isActive) {
      // Deactivate
      const res = await deactivateUser(userId);
      if (res.success) {
        toast.success('Usuario desactivado');
      } else {
        toast.error(res.error || 'Error al desactivar usuario');
      }
    } else {
      // Reactivate - use updateUserRole as a proxy (the RPC can handle reactivation)
      toast.info('Para reactivar un usuario, contacte al administrador');
    }
  };

  const pendingInvitations = invitations.filter((inv) => inv.status === 'pending');

  return (
    <CoreLayout>
      <Container fluid className="p-4">
        <RoleGuard
          requiredRole="corp_admin"
          fallback={
            <Row>
              <Col>
                <p className="text-muted">No tienes permisos para acceder a esta pagina.</p>
              </Col>
            </Row>
          }
        >
          <PageTitle>
            <Icon icon={faUsers} />
            <h4>Usuarios de la Empresa</h4>
          </PageTitle>

          {userProfile?.company_name && (
            <p className="text-muted mb-4">{userProfile.company_name}</p>
          )}

          {/* Company Users Table */}
          <Row className="mt-3">
            <Col>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h5>Miembros del Equipo</h5>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowInvite(true)}
                >
                  <Icon icon={faPlus} />
                  Invitar Usuario
                </Button>
              </div>
              {userLoading && <p className="text-muted">Cargando...</p>}
              <Table striped bordered hover size="sm" responsive>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Nombre</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {companyUsers.map((u) => (
                    <tr key={u.id}>
                      <td>{u.email}</td>
                      <td>{u.full_name}</td>
                      <td>
                        <Form.Select
                          size="sm"
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                          disabled={u.id === userProfile?.id}
                        >
                          {ASSIGNABLE_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </Form.Select>
                      </td>
                      <td>
                        <Badge bg={u.is_active ? 'success' : 'secondary'}>
                          {u.is_active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </td>
                      <td>
                        {u.id !== userProfile?.id && (
                          <Button
                            variant={u.is_active ? 'outline-danger' : 'outline-success'}
                            size="sm"
                            onClick={() => handleToggleActive(u.id, u.is_active)}
                          >
                            <Icon icon={u.is_active ? faToggleOff : faToggleOn} />
                            {u.is_active ? 'Desactivar' : 'Activar'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {companyUsers.length === 0 && !userLoading && (
                    <tr>
                      <td colSpan={5} className="text-center text-muted">
                        No hay usuarios en la empresa
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </Col>
          </Row>

          {/* Pending Invitations */}
          <Row className="mt-4">
            <Col>
              <h5 className="mb-3">Invitaciones Pendientes</h5>
              <Table striped bordered hover size="sm" responsive>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th>Enviada</th>
                    <th>Expira</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingInvitations.map((inv) => (
                    <tr key={inv.id}>
                      <td>{inv.email}</td>
                      <td>{inv.role}</td>
                      <td>
                        <Badge bg="warning" text="dark">
                          {inv.status}
                        </Badge>
                      </td>
                      <td>{new Date(inv.created_at).toLocaleDateString('es-CO')}</td>
                      <td>{new Date(inv.expires_at).toLocaleDateString('es-CO')}</td>
                    </tr>
                  ))}
                  {pendingInvitations.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-muted">
                        No hay invitaciones pendientes
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </Col>
          </Row>

          {/* Invite User Modal */}
          <Modal show={showInvite} onHide={() => setShowInvite(false)} centered>
            <Modal.Header closeButton>
              <Modal.Title>Invitar Usuario</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form.Group className="mb-3">
                <Form.Label>Email</Form.Label>
                <Form.Control
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="usuario@empresa.com"
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Rol</Form.Label>
                <Form.Select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as UserRole)}
                >
                  {ASSIGNABLE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowInvite(false)}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={handleInvite} disabled={userLoading}>
                Enviar Invitacion
              </Button>
            </Modal.Footer>
          </Modal>
        </RoleGuard>
      </Container>
    </CoreLayout>
  );
};

export default UsersPage;
