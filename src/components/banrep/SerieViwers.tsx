'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  Table,
  Button,
  Stack,
  ListGroup,
  Offcanvas,
  Spinner,
  ButtonGroup,
  Row,
  Col,
  Container,
  Card,
  Accordion,
} from 'react-bootstrap';
import React, { useState, useEffect, useCallback, ChangeEvent } from 'react';
import {
  LightSerie,
  LightSerieValue,
  LightSerieEntry,
  LightSerieValueArray,
  defaultPriceFormat,
} from '@models/lightserie';
import CandleSerieViewer from '@components/compare/candleViewer';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faClose,
  faFileCsv,
  faLinesLeaning,
} from '@fortawesome/free-solid-svg-icons';
import SeriePicker from '@components/serie/SeriePicker';
import { ExportToCsv, downloadBlob } from '@components/csvDownload/cscDownload';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function SeriesViewer() {
  const supabase = createClientComponentClient();

  const [loadingSerie, setLowdingSerie] = useState(false);

  const [selectedSeries, setSelectedSeries] = useState<Map<string, LightSerie>>(
    new Map()
  );

  const [selectionOptionsSbg, setSelectionOptionsSbg] = useState<
    Map<string, Map<string, LightSerieEntry[]>>
  >(new Map());

  const [serieNameInfo, setSerieNameInfo] = useState<
    Map<string, LightSerieEntry>
  >(new Map());

  const [normalize, setNormalize] = useState(false);

  const [showCanvs, setShowCanvas] = useState(false);

  const handleClose = () => setShowCanvas(false);

  const handleShow = () => setShowCanvas(true);

  const FetchSerieValues = useCallback(
    async (idSerie: string, newColor: string) => {
      const { data, error } = await supabase
        .schema('xerenity')
        .rpc('search', { name: idSerie });

      if (error) {
        return {
          serie: [],
          color: '',
          name: '',
          type: 'line',
          priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
        } as LightSerie;
      }
      if (data) {
        return {
          serie: data.data as LightSerieValue[],
          color: newColor,
          name: serieNameInfo.get(idSerie)?.display_name,
        } as LightSerie;
      }

      return {
        serie: [],
        color: '',
        name: '',
        type: 'line',
        priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
      } as LightSerie;
    },
    [supabase, serieNameInfo]
  );

  const fetchData = useCallback(async () => {
    const { data, error } = await supabase
      .schema('xerenity')
      .from('search')
      .select();

    if (error) {
      setSelectionOptionsSbg(new Map());
      toast.error(error.message, { position: toast.POSITION.TOP_CENTER });
    } else if (data) {
      const options = data as LightSerieEntry[];
      const subGrupos = new Map<string, LightSerieEntry[]>();
      const serieData = new Map<string, LightSerieEntry>();

      const groupData = new Map<string, Map<string, LightSerieEntry[]>>();

      options.forEach((entry) => {
        let sbgroup = entry.sub_group;

        if (!sbgroup) {
          sbgroup = 'Sin clasificar';
        }
        serieData.set(entry.source_name, entry);

        if (subGrupos.has(sbgroup)) {
          subGrupos.get(sbgroup)?.push(entry);
        } else {
          subGrupos.set(sbgroup, [entry]);
        }
      });

      Array.from(subGrupos.entries()).forEach(([key, value]) => {
        value.forEach((serie) => {
          const grp = groupData.get(serie.grupo);

          if (grp) {
            grp.set(serie.sub_group, value);
          } else {
            const helper = new Map<string, LightSerieEntry[]>();
            helper.set(key, value);
            groupData.set(serie.grupo, helper);
          }
        });
      });

      setSelectionOptionsSbg(groupData);
      setSerieNameInfo(serieData);
    } else {
      setSelectionOptionsSbg(new Map());
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCheckboxChange = useCallback(
    async (
      event: ChangeEvent<HTMLInputElement>,
      checkboxId: string,
      color: string
    ) => {
      setLowdingSerie(true);

      const newSelection = new Map<string, LightSerie>();

      Array.from(selectedSeries.entries()).forEach(([key, value]) => {
        newSelection.set(key, value);
      });
      if (event.target.checked) {
        newSelection.set(checkboxId, await FetchSerieValues(checkboxId, color));
      } else {
        newSelection.delete(checkboxId);
      }

      setSelectedSeries(newSelection);

      setLowdingSerie(false);
    },
    [selectedSeries, setSelectedSeries, FetchSerieValues]
  );

  const handleColorChnage = useCallback(
    async (checkboxId: string, newColor: string) => {
      const newSelection = new Map<string, LightSerie>();

      Array.from(selectedSeries.entries()).forEach(([key, value]) => {
        if (key === checkboxId) {
          newSelection.set(key, {
            serie: value.serie,
            color: newColor,
            name: value.name,
            type: 'line',
            priceFormat: defaultPriceFormat,
          });
        } else {
          newSelection.set(key, value);
        }
      });

      setSelectedSeries(newSelection);
    },
    [selectedSeries]
  );

  const handleRemoveSerie = useCallback(
    async (serieId: string) => {
      const newSelection = new Map<string, LightSerie>();

      Array.from(selectedSeries.entries()).forEach(([key, value]) => {
        newSelection.set(key, value);
      });

      newSelection.delete(serieId);

      setSelectedSeries(newSelection);
    },
    [selectedSeries]
  );

  const downloadSeries = () => {
    const allValues: string[][] = [];
    allValues.push(['serie', 'time', 'value']);

    Array.from(selectedSeries.values()).forEach((value) => {
      value.serie.forEach((entry) => {
        allValues.push([value.name].concat(LightSerieValueArray(entry)));
      });
    });

    const csv = ExportToCsv(allValues);

    downloadBlob(csv, 'xerenity_series.csv', 'text/csv;charset=utf-8;');
  };

  return (
    <Container fluid>
      <ToastContainer />
      <Row>
        <Row>
          <Col sm={4}>
            <Card>
              <Card.Header>Normalizar</Card.Header>
              <Card.Body>
                <Button
                  variant={normalize ? 'primary' : 'outline-primary'}
                  onClick={() => setNormalize(!normalize)}
                >
                  {normalize ? 'Normalizado' : 'Normalizar'}
                </Button>
              </Card.Body>
            </Card>
          </Col>
          <Col sm={4}>
            <Card>
              <Card.Header>Descargar</Card.Header>
              <Card.Body>
                <Button variant="outline-primary" onClick={downloadSeries}>
                  Exportar CSV <FontAwesomeIcon size="xs" icon={faFileCsv} />
                </Button>
              </Card.Body>
            </Card>
          </Col>
          <Col sm={4}>
            <Card>
              <Card.Header>Ver Series</Card.Header>
              <Card.Body>
                <ButtonGroup>
                  <Button variant="outline-primary" onClick={handleShow}>
                    Ver serie <FontAwesomeIcon icon={faLinesLeaning} />
                  </Button>
                </ButtonGroup>
              </Card.Body>
            </Card>
          </Col>
        </Row>
        <Row>
          <Col>
            <hr />
          </Col>
        </Row>

        <Offcanvas
          id="offcanvasNavbar-expand-false"
          aria-labelledby="offcanvasNavbarLabel-expand-false"
          placement="end"
          scroll
          show={showCanvs}
          onHide={handleClose}
        >
          <Offcanvas.Header closeButton>
            <Offcanvas.Title id="offcanvasNavbarLabel-expand-false">
              <Row>
                <Col>Series</Col>
                <Col>
                  {loadingSerie ? <Spinner animation="border" /> : null}
                </Col>
              </Row>
            </Offcanvas.Title>
          </Offcanvas.Header>
          <Offcanvas.Body>
            <Stack gap={3}>
              {Array.from(selectionOptionsSbg.entries()).map(([key, value]) => [
                <Accordion key={`serie-group-${key}`}>
                  <Accordion.Item eventKey={key}>
                    <Accordion.Header>{key}</Accordion.Header>
                    <Accordion.Body>
                      <Stack gap={2}>
                        {Array.from(value.entries()).map(([skey, svalue]) => [
                          <Accordion key={`serie-group-${skey}`}>
                            <Accordion.Item eventKey={skey}>
                              <Accordion.Header>{skey}</Accordion.Header>
                              <Accordion.Body>
                                <Stack gap={2}>
                                  {svalue.map((serie) => [
                                    <SeriePicker
                                      key={`serie-${serie.source_name}`}
                                      handleSeriePick={handleCheckboxChange}
                                      handleColorPicker={handleColorChnage}
                                      showColor
                                      displayName={serie.display_name}
                                      serieID={serie.source_name}
                                      disable={loadingSerie}
                                      checked={selectedSeries.has(
                                        serie.source_name
                                      )}
                                    />,
                                  ])}
                                </Stack>
                              </Accordion.Body>
                            </Accordion.Item>
                          </Accordion>,
                        ])}
                      </Stack>
                    </Accordion.Body>
                  </Accordion.Item>
                </Accordion>,
              ])}
            </Stack>
          </Offcanvas.Body>
        </Offcanvas>
      </Row>
      <Row>
        <Col>
          <CandleSerieViewer
            candleSerie={null}
            otherSeries={Array.from(selectedSeries.values())}
            fit
            shorten
            normalyze={normalize}
            chartHeight="50rem"
          />
        </Col>
      </Row>
      <Row>
        <Col>
          <Table bordered hover responsive="sm" style={{ textAlign: 'center' }}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Descripcion</th>
                <th>Fuente</th>
                <th style={{ width: '2%' }}> Quitar</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(serieNameInfo.entries()).map(([key, value]) => [
                selectedSeries.has(key) ? (
                  <tr key={`t-row-serie${key}`}>
                    <td>
                      <ListGroup>
                        <ListGroup.Item
                          style={{
                            backgroundColor: selectedSeries.get(key)?.color,
                          }}
                        >
                          {value.display_name}
                        </ListGroup.Item>
                      </ListGroup>
                    </td>
                    <td>{value.description}</td>
                    <td>{value.fuente}</td>
                    <td>
                      <Button aria-label="descargar" variant="outline-primary">
                        <FontAwesomeIcon
                          size="xs"
                          icon={faClose}
                          onClick={() => handleRemoveSerie(value.source_name)}
                        />
                      </Button>
                    </td>
                  </tr>
                ) : null,
              ])}
            </tbody>
          </Table>
        </Col>
      </Row>
    </Container>
  );
}
