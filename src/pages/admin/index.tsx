'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CoreLayout } from '@layout';
import { Container, Row, Col, Modal, Form, Badge } from 'react-bootstrap';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faCog,
  faPlus,
  faPenToSquare,
  faBuilding,
  faTrash,
  faSortUp,
  faSortDown,
  faSort,
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import styled from 'styled-components';
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

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  corp_admin: 'Admin Corp',
  gestor: 'Gestor',
  lector: 'Lector',
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: '#dc3545',
  corp_admin: '#6f42c1',
  gestor: '#0d6efd',
  lector: '#6c757d',
};

type SortField = 'email' | 'full_name' | 'company_name' | 'account_type' | 'role' | 'is_active';
type SortDir = 'asc' | 'desc';

const TableWrap = styled.div`
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  margin-bottom: 16px;

  .table { margin-bottom: 0; }
  .table thead th {
    background: #302b63 !important;
    color: #fff !important;
    border-color: #3d3580 !important;
    font-size: 11px !important;
    font-weight: 600 !important;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    white-space: nowrap;
    vertical-align: middle !important;
    padding: 10px 12px !important;
  }
  .table thead th.sortable { cursor: pointer; user-select: none; transition: background 0.15s; }
  .table thead th.sortable:hover { background: #4a44a0 !important; }
  .table thead th .sort-icon { margin-left: 6px; font-size: 10px; opacity: 0.4; }
  .table thead th .sort-icon.active { opacity: 1; color: #f0c040; }
  .table tbody td { font-size: 13px; vertical-align: middle !important; padding: 8px 12px !important; border-color: #eee !important; }
  .table tbody tr:nth-child(even) { background: #fafaff; }
  .table tbody tr:hover { background: rgba(48, 43, 99, 0.06) !important; }
`;

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

  // Sort state
  const [sortField, setSortField] = useState<SortField>('email');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

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

  // Sorted users
  const sortedUsers = useMemo(() => {
    const sorted = [...allUsers];
    sorted.sort((a, b) => {
      let valA: string | boolean = '';
      let valB: string | boolean = '';

      switch (sortField) {
        case 'email': valA = a.email || ''; valB = b.email || ''; break;
        case 'full_name': valA = a.full_name || ''; valB = b.full_name || ''; break;
        case 'company_name': valA = a.company_name || ''; valB = b.company_name || ''; break;
        case 'account_type': valA = (a as unknown as Record<string, unknown>).account_type as string || ''; valB = (b as unknown as Record<string, unknown>).account_type as string || ''; break;
        case 'role': valA = a.role || ''; valB = b.role || ''; break;
        case 'is_active': valA = a.is_active; valB = b.is_active; break;
        default: break;
      }

      if (typeof valA === 'boolean') {
        return sortDir === 'asc'
          ? (valA === valB ? 0 : valA ? -1 : 1)
          : (valA === valB ? 0 : valA ? 1 : -1);
      }

      const cmp = String(valA).localeCompare(String(valB), 'es');
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [allUsers, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return faSort;
    return sortDir === 'asc' ? faSortUp : faSortDown;
  };

  const badgeStyle = { fontSize: '11px', padding: '5px 10px', borderRadius: '12px', fontWeight: 600 as const };
  const getAccountTypeBadge = (user: Record<string, unknown>) => {
    const at = user.account_type as string | null | undefined;
    if (at === 'corporate') return <Badge style={{ ...badgeStyle, background: '#302b63' }}>Corporativo</Badge>;
    if (at === 'individual') return <Badge bg="warning" text="dark" style={badgeStyle}>Individual</Badge>;
    return <Badge bg="light" text="dark" style={{ ...badgeStyle, border: '1px solid #dee2e6' }}>Sin asignar</Badge>;
  };

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
                <h5>Empresas ({companies.length})</h5>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowCreateCompany(true)}
                >
                  <Icon icon={faPlus} />
                  Nueva Empresa
                </Button>
              </div>
              <TableWrap>
              <table className="table table-hover table-sm">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>NIT</th>
                    <th>Dominio</th>
                    <th>Creado</th>
                    <th style={{ width: '100px' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((c) => (
                    <tr key={c.id}>
                      <td><strong>{c.name}</strong></td>
                      <td>{c.nit || <span className="text-muted">-</span>}</td>
                      <td>
                        {c.domain ? (
                          <Badge bg="info">{c.domain}</Badge>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td>{new Date(c.created_at).toLocaleDateString('es-CO')}</td>
                      <td>
                        <div className="d-flex gap-1">
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
                        </div>
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
              </table>
              </TableWrap>
            </Col>
          </Row>

          {/* All Users Section */}
          <Row className="mt-4">
            <Col>
              <h5 className="mb-3">Todos los Usuarios ({allUsers.length})</h5>
              {userLoading && <p className="text-muted">Cargando...</p>}
              <TableWrap>
              <table className="table table-hover table-sm">
                <thead>
                  <tr>
                    <th className="sortable" onClick={() => toggleSort('email')}>
                      Email
                      <Icon icon={getSortIcon('email')} className={`sort-icon ${sortField === 'email' ? 'active' : ''}`} />
                    </th>
                    <th className="sortable" onClick={() => toggleSort('full_name')}>
                      Nombre
                      <Icon icon={getSortIcon('full_name')} className={`sort-icon ${sortField === 'full_name' ? 'active' : ''}`} />
                    </th>
                    <th className="sortable" onClick={() => toggleSort('company_name')}>
                      Empresa
                      <Icon icon={getSortIcon('company_name')} className={`sort-icon ${sortField === 'company_name' ? 'active' : ''}`} />
                    </th>
                    <th className="sortable" onClick={() => toggleSort('account_type')}>
                      Tipo
                      <Icon icon={getSortIcon('account_type')} className={`sort-icon ${sortField === 'account_type' ? 'active' : ''}`} />
                    </th>
                    <th className="sortable" onClick={() => toggleSort('role')}>
                      Rol
                      <Icon icon={getSortIcon('role')} className={`sort-icon ${sortField === 'role' ? 'active' : ''}`} />
                    </th>
                    <th className="sortable" onClick={() => toggleSort('is_active')}>
                      Estado
                      <Icon icon={getSortIcon('is_active')} className={`sort-icon ${sortField === 'is_active' ? 'active' : ''}`} />
                    </th>
                    <th>Asignar</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedUsers.map((u) => (
                    <tr key={u.id}>
                      <td>{u.email}</td>
                      <td>{u.full_name || <span className="text-muted">-</span>}</td>
                      <td>{u.company_name ? <span style={{ fontWeight: 500, color: '#302b63' }}>{u.company_name}</span> : <span className="text-muted">-</span>}</td>
                      <td>{getAccountTypeBadge(u as unknown as Record<string, unknown>)}</td>
                      <td>
                        <Form.Select
                          size="sm"
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                          disabled={u.id === userProfile?.id}
                          style={{
                            fontSize: '12px',
                            color: ROLE_COLORS[u.role] || '#333',
                            fontWeight: 600,
                          }}
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABELS[r] || r}
                            </option>
                          ))}
                        </Form.Select>
                      </td>
                      <td>
                        {u.is_active
                          ? <span style={{ color: '#198754', fontSize: '12px', fontWeight: 600 }}>● Activo</span>
                          : <span style={{ color: '#dc3545', fontSize: '12px', fontWeight: 600 }}>● Inactivo</span>}
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
              </table>
              </TableWrap>
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
