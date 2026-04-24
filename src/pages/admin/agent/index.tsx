'use client';

import React, { useState } from 'react';
import { CoreLayout } from '@layout';
import { Container, Tab, Tabs } from 'react-bootstrap';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import { faRobot } from '@fortawesome/free-solid-svg-icons';
import PageTitle from '@components/PageTitle';
import RoleGuard from 'src/components/RoleGuard';
import SkillsTab from './_SkillsTab';
import SuggestionsTab from './_SuggestionsTab';

export default function AgentAdminPage() {
  const [activeTab, setActiveTab] = useState<string>('skills');

  return (
    <CoreLayout>
      <RoleGuard requiredRole="super_admin">
        <Container fluid className="px-4 pb-4">
          <PageTitle>
            <Icon icon={faRobot} />
            <h4>Configuracion del Agente IA</h4>
          </PageTitle>

          <Tabs
            activeKey={activeTab}
            onSelect={(k) => setActiveTab(k || 'skills')}
            className="mb-3"
          >
            <Tab eventKey="skills" title="Skills">
              <SkillsTab />
            </Tab>
            <Tab eventKey="suggestions" title="Sugerencias">
              <SuggestionsTab />
            </Tab>
          </Tabs>
        </Container>
      </RoleGuard>
    </CoreLayout>
  );
}
