'use client';

import React, { useEffect, useState } from 'react';
import { CoreLayout } from '@layout';
import { Container, Row, Col, Table, Modal, Form, Badge } from 'react-bootstrap';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import { faCog, faPlus, faPenToSquare, faBuilding, faTrash } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import PageTitle from '@components/PageTitle';
import Button from '@components/UI/Button';
import useAppStore from 'src/store';
import RoleGuard from 'src/components/RoleGuard';
import type { UserRole, Company, AccountType } from 'src/types/user';

const ROLE_OPTIONS: UserRole[] = ['super_admin', 'corp_admin', 'gestor', 'lector'];
const ACCOUNT_TYPE_OPTIONS: { value: AccountType | 'none'; label: string }[] = [
  { value: 'individual', label: 'Individual' },
  { value: 'corporate', label: 'Corporativo' },
  { value: 'none', label: 'Sin asignar' },
];

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
    updateCompany,
    assignUserToCompany,
    deleteCompany,
  } = useAppStore();

  // Create company modal
  const [showCreateCompany, setShowCreateCompany] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [companyNit, setCompanyNit] = useState('');
  const [companyDomain, setCompanyDomain] = useState('');

  // Edit company modal
  const [showEditCompany, setShowEditCompany] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [editName, setEditName] = useState('');
  const [editNit, setEditNit] = useState('');
  const [editDomain, setEditDomain] = useState('');

  // Assign user modal
  const [showAssignUser, setShowAssignUser] = useState(false);
  const [assignUserId, setAssignUserId] = useState('');
  const [assignUserEmail, setAssignUserEmail] = useState('');
  const [assignCompanyId, setAssignCompanyId] = useState('');
  const [assignAccountType, setAssignAccountType] = useState<string>('corporate');

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
    const res = await createCompany(
      companyName.trim(),
      companyNit.trim() || null,
      companyDomain.trim() || null,
    );
    if (res.success) {
      toast.success('Empresa creada exitosamente');
      setShowCreateCompany(false);
      setCompanyName('');
      setCompanyNit('');
      setCompanyDomain('');
    } else {
      toast.error(res.error || 'Error al crear empresa');
    }
  };

  const openEditCompany = (company: Company) => {
    setEditingCompany(company);
    setEditName(company.name);
    setEditNit(company.nit || '');
    setEditDomain(company.domain || '');
    setShowEditCompany(true);
  };

  const handleEditCompany = async () => {
    if (!editingCompany || !editName.trim()) {
      toast.error('El nombre es requerido');
      return;
    }
    const res = await updateCompany(
      editingCompany.id,
      editName.trim(),
      editNit.trim() || null,
      editDomain.trim() || null,
    );
    if (res.success) {
      toast.success('Empresa actualizada');
      setShowEditCompany(false);
      setEditingCompany(null);
    } else {
      toast.error(res.error || 'Error al actualizar empresa');
    }
  };

  const handleDeleteCompany = async (company: Company) => {
    // eslint-disable-next-line no-alert
    const confirmed = window.confirm(`Eliminar "${company.name}"? Esta accion no se puede deshacer.`);
    if (!confirmed) return;
    const res = await deleteCompany(company.id);
    if (res.success) {
      toast.success('Empresa eliminada');
    } else {
      toast.error(res.error || 'Error al eliminar empresa');
    }
  };

  const openAssignUser = (userId: string, email: string, currentCompanyName?: string) => {
    setAssignUserId(userId);
    setAssignUserEmail(email);
    // Pre-select company if user already has one
    const currentCompany = companies.find((c) => c.name === currentCompanyName);
    setAssignCompanyId(currentCompany?.id || '');
    setAssignAccountType(currentCompany ? 'corporate' : 'individual');
    setShowAssignUser(true);
  };

  const handleAssignUser = async () => {
    const companyId = assignAccountType === 'corporate' && assignCompanyId
      ? assignCompanyId
      : null;
    const res = await assignUserToCompany(assignUserId, companyId, assignAccountType);
    if (res.success) {
      toast.success('Usuario actualizado');
      setShowAssignUser(false);
    } else {
      toast.error(res.error || 'Error al asignar usuario');
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
                    <th>Dominio</th>
                    <th>Creado</th>
                    <th style={{ width: '80px' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((c) => (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td>{c.nit || '-'}</td>
                      <td>
                        {c.domain ? (
                          <Badge bg="info">{c.domain}</Badge>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td>{new Date(c.created_at).toLocaleDateString('es-CO')}</td>
                      <td className="d-flex gap-1">
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => openEditCompany(c)}
                        >
                          <Icon icon={faPenToSquare} />
                        </Button>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => handleDeleteCompany(c)}
                        >
                          <Icon icon={faTrash} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {companies.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-muted">
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
                    <th>Tipo</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th style={{ width: '80px' }}>Empresa</th>
                  </tr>
                </thead>
                <tbody>
                  {allUsers.map((u) => (
                    <tr key={u.id}>
                      <td>{u.email}</td>
                      <td>{u.full_name}</td>
                      <td>{u.company_name || <span className="text-muted">-</span>}</td>
                      <td>
                        <Badge bg={u.company_name ? 'primary' : 'secondary'}>
                          {u.company_name ? 'Corp' : 'Individual'}
                        </Badge>
                      </td>
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
                      <td>
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => openAssignUser(u.id, u.email, u.company_name)}
                        >
                          <Icon icon={faBuilding} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {allUsers.length === 0 && !userLoading && (
                    <tr>
                      <td colSpan={7} className="text-center text-muted">
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
              <Form.Group className="mb-3">
                <Form.Label>Dominio de email (opcional)</Form.Label>
                <Form.Control
                  type="text"
                  value={companyDomain}
                  onChange={(e) => setCompanyDomain(e.target.value)}
                  placeholder="empresa.com"
                />
                <Form.Text className="text-muted">
                  Los usuarios con este dominio podran unirse automaticamente
                </Form.Text>
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

          {/* Edit Company Modal */}
          <Modal show={showEditCompany} onHide={() => setShowEditCompany(false)} centered>
            <Modal.Header closeButton>
              <Modal.Title>Editar Empresa</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form.Group className="mb-3">
                <Form.Label>Nombre</Form.Label>
                <Form.Control
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Nombre de la empresa"
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>NIT (opcional)</Form.Label>
                <Form.Control
                  type="text"
                  value={editNit}
                  onChange={(e) => setEditNit(e.target.value)}
                  placeholder="NIT"
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Dominio de email</Form.Label>
                <Form.Control
                  type="text"
                  value={editDomain}
                  onChange={(e) => setEditDomain(e.target.value)}
                  placeholder="empresa.com"
                />
                <Form.Text className="text-muted">
                  Los usuarios con este dominio podran unirse automaticamente
                </Form.Text>
              </Form.Group>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowEditCompany(false)}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={handleEditCompany} disabled={userLoading}>
                Guardar
              </Button>
            </Modal.Footer>
          </Modal>

          {/* Assign User to Company Modal */}
          <Modal show={showAssignUser} onHide={() => setShowAssignUser(false)} centered>
            <Modal.Header closeButton>
              <Modal.Title>Asignar Empresa</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <p className="text-muted mb-3">
                Usuario: <strong>{assignUserEmail}</strong>
              </p>
              <Form.Group className="mb-3">
                <Form.Label>Tipo de cuenta</Form.Label>
                <Form.Select
                  value={assignAccountType}
                  onChange={(e) => setAssignAccountType(e.target.value)}
                >
                  {ACCOUNT_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
              {assignAccountType === 'corporate' && (
                <Form.Group className="mb-3">
                  <Form.Label>Empresa</Form.Label>
                  <Form.Select
                    value={assignCompanyId}
                    onChange={(e) => setAssignCompanyId(e.target.value)}
                  >
                    <option value="">-- Seleccionar empresa --</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.domain ? `(${c.domain})` : ''}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowAssignUser(false)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={handleAssignUser}
                disabled={userLoading || (assignAccountType === 'corporate' && !assignCompanyId)}
              >
                Guardar
              </Button>
            </Modal.Footer>
          </Modal>
        </RoleGuard>
      </Container>
    </CoreLayout>
  );
};

export default AdminPage;
