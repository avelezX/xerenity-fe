'use client';

import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { CoreLayout } from '@layout';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import styled from 'styled-components';
import tokens from 'design-tokens/tokens.json';

const ds = tokens.xerenity;

const BackLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  color: ${ds['purple-200'].value};
  text-decoration: none;
  cursor: pointer;
  margin-bottom: 24px;

  &:hover {
    color: ${ds['purple-100'].value};
    text-decoration: none;
  }
`;

const PageContainer = styled.div`
  max-width: 860px;
  margin: 0 auto;
  padding: 24px 0 60px;
`;

const Title = styled.h2`
  font-size: 24px;
  font-weight: 600;
  color: ${ds['purple-400'].value};
  margin-bottom: 4px;
`;

const Subtitle = styled.p`
  font-size: 14px;
  color: ${ds['gray-400'].value};
  margin-bottom: 32px;
`;

const Section = styled.section`
  margin-bottom: 32px;
`;

const SectionTitle = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: ${ds['purple-300'].value};
  margin-bottom: 12px;
  padding-bottom: 6px;
  border-bottom: 1px solid ${ds['gray-200'].value};
`;

const Text = styled.p`
  font-size: 13.5px;
  line-height: 1.7;
  color: ${ds['gray-500'].value};
  margin-bottom: 10px;
`;

const InfoTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  margin-bottom: 16px;

  th {
    text-align: left;
    padding: 8px 12px;
    background: ${ds['beige-50'].value};
    color: ${ds['purple-300'].value};
    font-weight: 600;
    border-bottom: 1px solid ${ds['gray-200'].value};
  }

  td {
    padding: 7px 12px;
    color: ${ds['gray-500'].value};
    border-bottom: 1px solid ${ds['gray-100'].value};
    vertical-align: top;
  }

  tr:last-child td {
    border-bottom: none;
  }
`;

const FormulaBlock = styled.div`
  background: ${ds['purple-500'].value};
  color: ${ds['purple-50'].value};
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 13px;
  padding: 14px 18px;
  border-radius: 6px;
  margin: 12px 0 16px;
  line-height: 1.8;
  overflow-x: auto;
`;

const Highlight = styled.span`
  color: ${ds['purple-200'].value};
  font-weight: 600;
`;

const Badge = styled.span<{ variant?: 'open' | 'closed' | 'neutral' }>`
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  ${(props) => {
    switch (props.variant) {
      case 'open':
        return `background: ${ds['green-200'].value}; color: ${ds['green-700'].value};`;
      case 'closed':
        return `background: ${ds['red-300'].value}; color: ${ds['red-800'].value};`;
      default:
        return `background: ${ds['purple-10'].value}; color: ${ds['purple-300'].value};`;
    }
  }}
`;

const ColumnsGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 24px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const ColumnItem = styled.div`
  font-size: 12.5px;
  padding: 4px 0;
  border-bottom: 1px solid ${ds['gray-100'].value};

  strong {
    color: ${ds['purple-300'].value};
    font-weight: 600;
  }

  span {
    color: ${ds['gray-400'].value};
    margin-left: 4px;
  }
`;

export default function FICInfoPage() {
  return (
    <CoreLayout>
      <Container fluid className="px-4">
        <PageContainer>
          <Link href="/fic" passHref legacyBehavior>
            <BackLink>
              <FontAwesomeIcon icon={faArrowLeft} />
              Volver a FIC
            </BackLink>
          </Link>

          <Title>Fondos de Inversi&oacute;n Colectiva (FIC)</Title>
          <Subtitle>
            Gu&iacute;a t&eacute;cnica sobre estructura, regulaci&oacute;n y datos reportados
            &mdash; Superintendencia Financiera de Colombia
          </Subtitle>

          {/* ---- Qué es un FIC ---- */}
          <Section>
            <SectionTitle>Qu&eacute; es un FIC</SectionTitle>
            <Text>
              Un Fondo de Inversi&oacute;n Colectiva es un veh&iacute;culo que
              re&uacute;ne aportes de m&uacute;ltiples inversionistas para ser
              administrados profesionalmente por una entidad autorizada. Los
              recursos se invierten en un portafolio com&uacute;n y los
              resultados se distribuyen proporcionalmente seg&uacute;n las
              unidades que posee cada inversionista.
            </Text>
            <Text>
              Solo tres tipos de entidad pueden administrar FIC: Sociedades
              Fiduciarias, Comisionistas de Bolsa, y Sociedades
              Administradoras de Inversi&oacute;n. Todos est&aacute;n
              supervisados por la Superintendencia Financiera de Colombia (SFC).
            </Text>
          </Section>

          {/* ---- Tipos de FIC ---- */}
          <Section>
            <SectionTitle>Tipos de fondo</SectionTitle>
            <InfoTable>
              <thead>
                <tr>
                  <th style={{ width: 80 }}>C&oacute;digo</th>
                  <th>Tipo</th>
                  <th>Descripci&oacute;n</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>1</td>
                  <td>FIC General</td>
                  <td>
                    Categor&iacute;a amplia: renta fija, variable, balanceados. Sin
                    restricciones especiales de inversi&oacute;n.
                  </td>
                </tr>
                <tr>
                  <td>2</td>
                  <td>Mercado Monetario</td>
                  <td>
                    Instrumentos de corto plazo y alta liquidez. Bajo riesgo,
                    rentabilidad estable.
                  </td>
                </tr>
                <tr>
                  <td>3</td>
                  <td>Inmobiliario</td>
                  <td>
                    Inversi&oacute;n en bienes ra&iacute;ces y derechos sobre inmuebles.
                    Generalmente cerrados.
                  </td>
                </tr>
                <tr>
                  <td>6</td>
                  <td>Burs&aacute;til (ETF)</td>
                  <td>
                    Replican un &iacute;ndice. Listados en bolsa para
                    negociaci&oacute;n secundaria (ej: iShares COLCAP).
                  </td>
                </tr>
                <tr>
                  <td>7</td>
                  <td>Capital Privado</td>
                  <td>
                    Al menos 2/3 en activos no inscritos en bolsa. Siempre
                    cerrados. Regulaci&oacute;n especial (Decreto 1984/2018).
                  </td>
                </tr>
              </tbody>
            </InfoTable>
          </Section>

          {/* ---- Abierto vs Cerrado ---- */}
          <Section>
            <SectionTitle>
              Abiertos{' '}
              <Badge variant="open">ABIERTO</Badge> vs Cerrados{' '}
              <Badge variant="closed">CERRADO</Badge>
            </SectionTitle>
            <InfoTable>
              <thead>
                <tr>
                  <th style={{ width: 180 }}>Aspecto</th>
                  <th>Abierto</th>
                  <th>Cerrado</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Redenci&oacute;n</strong></td>
                  <td>En cualquier momento (m&aacute;x 3 d&iacute;as h&aacute;biles)</td>
                  <td>Solo al vencimiento del plazo</td>
                </tr>
                <tr>
                  <td><strong>L&iacute;mite por inversionista</strong></td>
                  <td>10% del patrimonio</td>
                  <td>60% del patrimonio</td>
                </tr>
                <tr>
                  <td><strong>Pacto de permanencia</strong></td>
                  <td>Opcional, con penalizaci&oacute;n</td>
                  <td>No aplica</td>
                </tr>
              </tbody>
            </InfoTable>
          </Section>

          {/* ---- Mecanismo de unidades ---- */}
          <Section>
            <SectionTitle>Mecanismo de unidades</SectionTitle>
            <Text>
              Cada fondo opera con un sistema de{' '}
              <Highlight>unidades de participaci&oacute;n</Highlight>. El valor
              inicial de la unidad es <strong>$10,000 COP</strong>. Los
              resultados se distribuyen diariamente de forma proporcional al
              n&uacute;mero de unidades que posee cada inversionista.
            </Text>
            <Text>
              <strong>Aportes</strong> &mdash; Se crean unidades nuevas:{' '}
              <em>Unidades = Monto / VUOt</em>
              <br />
              <strong>Retiros</strong> &mdash; Se destruyen unidades:{' '}
              <em>Unidades destruidas = Monto retirado / VUOt</em>
            </Text>
            <Text>
              El <Highlight>valor de la unidad de operaciones (VUOt)</Highlight>{' '}
              es el precio al que se ejecutan todas las operaciones del d&iacute;a:
            </Text>
            <FormulaBlock>
              VUOt = PCFt / NUFt-1
              <br />
              <br />
              PCFt &nbsp;= Precierre del fondo (valoraci&oacute;n a mercado - comisiones)
              <br />
              NUFt-1 = Unidades del fondo al cierre del d&iacute;a anterior
            </FormulaBlock>
            <Text>
              Al final del d&iacute;a, el valor del fondo al cierre incorpora los
              flujos:{' '}
              <em>VFCt = PCFt + Aportes - Retiros - Anulaciones</em>
            </Text>
          </Section>

          {/* ---- Tipos de participación ---- */}
          <Section>
            <SectionTitle>Tipos de participaci&oacute;n</SectionTitle>
            <Text>
              Un mismo fondo puede ofrecer{' '}
              <Highlight>m&uacute;ltiples tipos de participaci&oacute;n</Highlight>,
              diferenciados por la comisi&oacute;n de administraci&oacute;n
              seg&uacute;n el monto invertido. Cada tipo tiene su propio valor de
              unidad y rentabilidades independientes.
            </Text>
            <InfoTable>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Perfil</th>
                  <th>Comisi&oacute;n t&iacute;pica</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><Badge>Tipo A</Badge></td>
                  <td>Retail / montos menores</td>
                  <td>M&aacute;s alta (ej: 1.8% E.A.)</td>
                </tr>
                <tr>
                  <td><Badge>Tipo B</Badge></td>
                  <td>Intermedio</td>
                  <td>Media (ej: 1.5% E.A.)</td>
                </tr>
                <tr>
                  <td><Badge>Tipo C</Badge></td>
                  <td>Institucional / montos grandes</td>
                  <td>M&aacute;s baja (ej: 0.8% E.A.)</td>
                </tr>
              </tbody>
            </InfoTable>
            <Text>
              En los datos, el campo <code>tipo_participacion</code> (ej: 801,
              802) identifica la clase. Un fondo con 10 tipos de
              participaci&oacute;n genera 10 registros diarios independientes.
            </Text>
          </Section>

          {/* ---- Compartimentos ---- */}
          <Section>
            <SectionTitle>Compartimentos</SectionTitle>
            <Text>
              Los compartimentos solo est&aacute;n permitidos en{' '}
              <Highlight>Fondos de Capital Privado</Highlight> (Decreto
              1984/2018). Permiten crear m&uacute;ltiples estrategias bajo un
              solo reglamento, cada una con patrimonio independiente y separado.
            </Text>
            <Text>
              Si un compartimento tiene problemas, no afecta a los dem&aacute;s.
              En los datos, <code>principal_compartimento = 1</code> indica
              fondo principal o sin compartimentos; otro valor indica
              sub-compartimento.
            </Text>
          </Section>

          {/* ---- Rentabilidades ---- */}
          <Section>
            <SectionTitle>C&aacute;lculo de rentabilidades</SectionTitle>
            <Text>
              Todas las rentabilidades se reportan como{' '}
              <Highlight>tasa efectiva anual (E.A.)</Highlight>, seg&uacute;n el
              Anexo 6 de la Circular 029/2014:
            </Text>
            <FormulaBlock>
              R(p) = [ (VUOt / VUOt-p) ^ (365/p) - 1 ] &times; 100
            </FormulaBlock>
            <InfoTable>
              <thead>
                <tr>
                  <th>Campo</th>
                  <th style={{ width: 100 }}>Per&iacute;odo</th>
                  <th>Interpretaci&oacute;n</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>rentabilidad_diaria</code></td>
                  <td>1 d&iacute;a</td>
                  <td>
                    Variaci&oacute;n de un d&iacute;a anualizada. Puede ser muy
                    vol&aacute;til.
                  </td>
                </tr>
                <tr>
                  <td><code>rentabilidad_mensual</code></td>
                  <td>30 d&iacute;as</td>
                  <td>&Uacute;ltimos 30 d&iacute;as, anualizada.</td>
                </tr>
                <tr>
                  <td><code>rentabilidad_semestral</code></td>
                  <td>180 d&iacute;as</td>
                  <td>&Uacute;ltimos 6 meses, anualizada.</td>
                </tr>
                <tr>
                  <td><code>rentabilidad_anual</code></td>
                  <td>365 d&iacute;as</td>
                  <td>Variaci&oacute;n directa del &uacute;ltimo a&ntilde;o.</td>
                </tr>
              </tbody>
            </InfoTable>
          </Section>

          {/* ---- Capital Privado ---- */}
          <Section>
            <SectionTitle>Fondos de Capital Privado (FCP)</SectionTitle>
            <Text>
              Los FCP tienen regulaci&oacute;n separada (Decreto 1984/2018)
              porque invierten en activos il&iacute;quidos no listados en bolsa.
              Son siempre cerrados, con horizontes de 5 a 15 a&ntilde;os.
            </Text>
            <InfoTable>
              <thead>
                <tr>
                  <th style={{ width: 200 }}>Aspecto</th>
                  <th>FIC General</th>
                  <th>Capital Privado</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Estructura</td>
                  <td>Abierto o cerrado</td>
                  <td>Siempre cerrado</td>
                </tr>
                <tr>
                  <td>Activos</td>
                  <td>Valores inscritos en RNVE</td>
                  <td>&ge; 2/3 activos no inscritos</td>
                </tr>
                <tr>
                  <td>Compartimentos</td>
                  <td>No permitidos</td>
                  <td>S&iacute; permitidos</td>
                </tr>
                <tr>
                  <td>Redenci&oacute;n</td>
                  <td>Inmediata o seg&uacute;n plazo</td>
                  <td>Solo al vencimiento</td>
                </tr>
                <tr>
                  <td>Inversionistas</td>
                  <td>Sin restricci&oacute;n</td>
                  <td>Profesionales; retail m&aacute;x 20% ingresos</td>
                </tr>
              </tbody>
            </InfoTable>
          </Section>

          {/* ---- Datos reportados ---- */}
          <Section>
            <SectionTitle>Datos reportados (26 campos)</SectionTitle>
            <Text>
              Las administradoras reportan diariamente el{' '}
              <strong>Formato 523</strong> a la SFC. Los datos se publican en{' '}
              datos.gov.co con los siguientes campos:
            </Text>
            <ColumnsGrid>
              <ColumnItem>
                <strong>fecha_corte</strong>
                <span>Fecha del reporte</span>
              </ColumnItem>
              <ColumnItem>
                <strong>tipo_entidad</strong>
                <span>C&oacute;digo tipo administradora</span>
              </ColumnItem>
              <ColumnItem>
                <strong>nombre_tipo_entidad</strong>
                <span>Tipo de administradora</span>
              </ColumnItem>
              <ColumnItem>
                <strong>codigo_entidad</strong>
                <span>C&oacute;digo de la entidad</span>
              </ColumnItem>
              <ColumnItem>
                <strong>nombre_entidad</strong>
                <span>Nombre de la administradora</span>
              </ColumnItem>
              <ColumnItem>
                <strong>tipo_negocio</strong>
                <span>C&oacute;digo tipo negocio</span>
              </ColumnItem>
              <ColumnItem>
                <strong>nombre_tipo_patrimonio</strong>
                <span>Tipo de patrimonio</span>
              </ColumnItem>
              <ColumnItem>
                <strong>subtipo_negocio</strong>
                <span>C&oacute;digo subtipo</span>
              </ColumnItem>
              <ColumnItem>
                <strong>nombre_subtipo_patrimonio</strong>
                <span>Tipo de fondo</span>
              </ColumnItem>
              <ColumnItem>
                <strong>codigo_negocio</strong>
                <span>C&oacute;digo &uacute;nico del fondo</span>
              </ColumnItem>
              <ColumnItem>
                <strong>nombre_patrimonio</strong>
                <span>Nombre del fondo</span>
              </ColumnItem>
              <ColumnItem>
                <strong>principal_compartimento</strong>
                <span>1=principal, 2=sub</span>
              </ColumnItem>
              <ColumnItem>
                <strong>tipo_participacion</strong>
                <span>Clase de participaci&oacute;n</span>
              </ColumnItem>
              <ColumnItem>
                <strong>rendimientos_abonados</strong>
                <span>Rendimientos del d&iacute;a (COP)</span>
              </ColumnItem>
              <ColumnItem>
                <strong>precierre_fondo_dia_t</strong>
                <span>Valor pre-cierre (COP)</span>
              </ColumnItem>
              <ColumnItem>
                <strong>numero_unidades_fondo_cierre</strong>
                <span>Unidades al cierre</span>
              </ColumnItem>
              <ColumnItem>
                <strong>valor_unidad_operaciones</strong>
                <span>Precio de la unidad (COP)</span>
              </ColumnItem>
              <ColumnItem>
                <strong>aportes_recibidos</strong>
                <span>Aportes del d&iacute;a (COP)</span>
              </ColumnItem>
              <ColumnItem>
                <strong>retiros_redenciones</strong>
                <span>Retiros del d&iacute;a (COP)</span>
              </ColumnItem>
              <ColumnItem>
                <strong>anulaciones</strong>
                <span>Operaciones reversadas (COP)</span>
              </ColumnItem>
              <ColumnItem>
                <strong>valor_fondo_cierre_dia_t</strong>
                <span>AUM total al cierre (COP)</span>
              </ColumnItem>
              <ColumnItem>
                <strong>numero_inversionistas</strong>
                <span>Inversionistas activos</span>
              </ColumnItem>
              <ColumnItem>
                <strong>rentabilidad_diaria</strong>
                <span>Rent. E.A. 1 d&iacute;a</span>
              </ColumnItem>
              <ColumnItem>
                <strong>rentabilidad_mensual</strong>
                <span>Rent. E.A. 30 d&iacute;as</span>
              </ColumnItem>
              <ColumnItem>
                <strong>rentabilidad_semestral</strong>
                <span>Rent. E.A. 180 d&iacute;as</span>
              </ColumnItem>
              <ColumnItem>
                <strong>rentabilidad_anual</strong>
                <span>Rent. E.A. 365 d&iacute;as</span>
              </ColumnItem>
            </ColumnsGrid>
          </Section>

          {/* ---- Marco regulatorio ---- */}
          <Section>
            <SectionTitle>Marco regulatorio</SectionTitle>
            <InfoTable>
              <thead>
                <tr>
                  <th style={{ width: 220 }}>Norma</th>
                  <th>Alcance</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Decreto 2555 de 2010</td>
                  <td>Decreto &uacute;nico del sector financiero. Parte 3: FIC.</td>
                </tr>
                <tr>
                  <td>Decreto 1242 de 2013</td>
                  <td>
                    Reclasific&oacute; los FIC. Elimin&oacute; compartimentos para fondos
                    generales.
                  </td>
                </tr>
                <tr>
                  <td>Decreto 1984 de 2018</td>
                  <td>
                    Regulaci&oacute;n separada para Fondos de Capital Privado. Reintrodujo
                    compartimentos para FCP.
                  </td>
                </tr>
                <tr>
                  <td>Circular 029 de 2014</td>
                  <td>
                    Instrucciones operativas SFC. Anexo 6: f&oacute;rmulas de
                    rentabilidad.
                  </td>
                </tr>
                <tr>
                  <td>Formato 523</td>
                  <td>Reporte diario de rentabilidades a la SFC.</td>
                </tr>
              </tbody>
            </InfoTable>
          </Section>
        </PageContainer>
      </Container>
    </CoreLayout>
  );
}
