'use client';

import React, { useEffect, useState } from 'react';
import { CoreLayout } from '@layout';
import { Container, Row, Col, Table, Modal, Form, Badge } from 'react-bootstrap';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import { faCog, faPlus } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import PageTitle from '@components/PageTitle';
import Button from '@components/UI/Button';
import useAppStore from 'src/store';
import RoleGuard from 'src/components/RoleGuard';
import type { UserRole } from 'src/types/user';

const ROLE_OPTIONS: UserRole[] = ['super_admin', 'corp_admin', 'gestor', 'lector'];

const AdminPage = () => {
  const {
    userProfile,
    allUsers,
    companies,
    userLoading,
    loadUserProfile,
    loadAllUsers,
    loadCompanies,
    updateUserRole,
    createCompany,
  } = useAppStore();

  const [showCreateCompany, setShowCreateCompany] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [companyNit, setCompanyNit] = useState('');

  useEffect(() => {
    loadUserProfile();
    loadAllUsers();
    loadCompanies();
  }, [loadUserProfile, loadAllUsers, loadCompanies]);

  const handleCreateCompany = async () => {
    if (!companyName.trim()) {
      toast.error('El nombre de la empresa es requerido');
      return;
    }
    const res = await createCompany(companyName.trim(), companyNit.trim() || null);
    if (res.success) {
      toast.success('Empresa creada exitosamente');
      setShowCreateCompany(false);
      setCompanyName('');
      setCompanyNit('');
    } else {
      toast.error(res.error || 'Error al crear empresa');
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

  return (
    <CoreLayout>
      <Container fluid className="p-4">
        <RoleGuard
          requiredRole="super_admin"
          fallback={
            <Row>
              <Col>
                <p className="text-muted">No tienes permisos para acceder a esta pagina.</p>
              </Col>
            </Row>
          }
        >
          <PageTitle>
            <Icon icon={faCog} />
            <h4>Admin - Super Administrador</h4>
          </PageTitle>

          {/* Companies Section */}
          <Row className="mt-4">
            <Col>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h5>Empresas</h5>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowCreateCompany(true)}
                >
                  <Icon icon={faPlus} />
                  Nueva Empresa
                </Button>
              </div>
              <Table striped bordered hover size="sm" responsive>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>NIT</th>
                    <th>Creado</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((c) => (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td>{c.nit || '-'}</td>
                      <td>{new Date(c.created_at).toLocaleDateString('es-CO')}</td>
                    </tr>
                  ))}
                  {companies.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-center text-muted">
                        No hay empresas registradas
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </Col>
          </Row>

          {/* All Users Section */}
          <Row className="mt-4">
            <Col>
              <h5 className="mb-3">Todos los Usuarios</h5>
              {userLoading && <p className="text-muted">Cargando...</p>}
              <Table striped bordered hover size="sm" responsive>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Nombre</th>
                    <th>Empresa</th>
                    <th>Rol</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {allUsers.map((u) => (
                    <tr key={u.id}>
                      <td>{u.email}</td>
                      <td>{u.full_name}</td>
                      <td>{u.company_name || '-'}</td>
                      <td>
                        <Form.Select
                          size="sm"
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                          disabled={u.id === userProfile?.id}
                        >
                          {ROLE_OPTIONS.map((r) => (
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
                    </tr>
                  ))}
                  {allUsers.length === 0 && !userLoading && (
                    <tr>
                      <td colSpan={5} className="text-center text-muted">
                        No hay usuarios
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </Col>
          </Row>

          {/* Create Company Modal */}
          <Modal show={showCreateCompany} onHide={() => setShowCreateCompany(false)} centered>
            <Modal.Header closeButton>
              <Modal.Title>Nueva Empresa</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form.Group className="mb-3">
                <Form.Label>Nombre</Form.Label>
                <Form.Control
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Nombre de la empresa"
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>NIT (opcional)</Form.Label>
                <Form.Control
                  type="text"
                  value={companyNit}
                  onChange={(e) => setCompanyNit(e.target.value)}
                  placeholder="NIT"
                />
              </Form.Group>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowCreateCompany(false)}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={handleCreateCompany} disabled={userLoading}>
                Crear
              </Button>
            </Modal.Footer>
          </Modal>
        </RoleGuard>
      </Container>
    </CoreLayout>
  );
};

export default AdminPage;
