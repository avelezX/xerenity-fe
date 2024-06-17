'use client';

import { CoreLayout } from '@layout';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  Stack,
  Offcanvas,
  Spinner,
  Row,
  Col,
  Container,
  Accordion,
} from 'react-bootstrap';
import React, {
  useState,
  useEffect,
  useCallback,
  ChangeEvent,
  useRef,
} from 'react';
import {
  LightSerie,
  LightSerieValue,
  LightSerieEntry,
  lightSerieValueArray,
  defaultPriceFormat,
} from 'src/types/lightserie';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faSquarePollHorizontal,
  faFileCsv,
  faMagnifyingGlass,
  faChartSimple,
  faTrash,
  faLineChart,
  faEye,
  faAlignLeft,
  faAlignRight,
  faClipboard,
} from '@fortawesome/free-solid-svg-icons';
import SeriePicker from '@components/serie/SeriePicker';
import { ExportToCsv, downloadBlob } from '@components/csvDownload/cscDownload';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Toolbar from '@components/UI/Toolbar';
import Chart from '@components/chart/Chart';
import Button from '@components/UI/Button';
import PageTitle from '@components/PageTitle';
import Card from '@components/UI/Card';
import CardGrid from '@components/UI/CardGrid';
import SerieInfoModal from './_SerieInfoModal';
import strings from '../../strings/dahsboard.json';

const { actions } = strings;

export default function Dashboard() {
  const supabase = createClientComponentClient();
  const [loadingSerie, setLowdingSerie] = useState(false);
  const [selectedInfoSerie, handleSelectInfoSerie] =
    useState<LightSerieEntry | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<Map<string, LightSerie>>(
    new Map()
  );
  const [selectionOptionsSbg, setSelectionOptionsSbg] = useState<
    Map<string, Map<string, LightSerieEntry[]>>
  >(new Map());
  const [serieNameInfo, setSerieNameInfo] = useState<
    Map<string, LightSerieEntry>
  >(new Map());
  const normalize = useRef<boolean>(false);
  const [applyFunctions, setApplyunctions] = useState<string[]>([]);
  const [showCanvs, setShowCanvas] = useState(false);

  const handleClose = () => setShowCanvas(false);

  const handleShow = () => setShowCanvas(true);

  const FetchSerieValues = useCallback(
    async (idSerie: string, newColor: string) => {
      // TODO: Take this out to an outside function
      const { data, error } = await supabase
        .schema('xerenity')
        .rpc('search', { ticket: idSerie });

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
    // TODO: Take this out to an outside function
    const { data, error } = await supabase
      .schema('xerenity')
      .from('search_mv')
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
        serieData.set(entry.ticker, entry);

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

  const decideAxis = (index: number) => {
    if (normalize.current) {
      return 'right';
    }
    return index % 2 === 0 ? 'right' : 'left';
  };

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
        const newSerie = await FetchSerieValues(checkboxId, color);
        newSerie.axisName = decideAxis(newSelection.size);
        newSelection.set(checkboxId, newSerie);
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
        allValues.push([value.name].concat(lightSerieValueArray(entry)));
      });
    });

    const csv = ExportToCsv(allValues);

    downloadBlob(csv, 'xerenity_series.csv', 'text/csv;charset=utf-8;');
  };

  const handleNormalize = () => {
    normalize.current = !normalize.current;
    if (normalize.current) {
      setApplyunctions(['normalize']);
    } else {
      setApplyunctions([]);
    }
  };

  const handleAxisChnage = useCallback(
    async (serieId: string) => {
      const newSelection = new Map<string, LightSerie>();

      Array.from(selectedSeries.entries()).forEach(([key, value]) => {
        if (key === serieId) {
          const newSerie: LightSerie = value;

          if (value.axisName === 'left') {
            newSerie.axisName = 'right';
          } else {
            newSerie.axisName = 'left';
          }

          newSelection.set(key, newSerie);
        } else {
          newSelection.set(key, value);
        }
      });

      setSelectedSeries(newSelection);
    },
    [selectedSeries]
  );

  return (
    <CoreLayout>
      <Container fluid className="px-4">
        <ToastContainer />
        <Row>
          <div className="d-flex align-items-center gap-2 py-1">
            <PageTitle>
              <Icon icon={faChartSimple} size="1x" />
              <h4>Dashboard</h4>
            </PageTitle>
          </div>
        </Row>
        <Row>
          <div className="d-flex justify-content-end pb-3">
            <Toolbar>
              <Button variant="outline-primary" onClick={handleNormalize}>
                <Icon icon={faSquarePollHorizontal} className="mr-4" />
                Normalizar
              </Button>
              <Button variant="outline-primary" onClick={downloadSeries}>
                <Icon icon={faFileCsv} className="mr-4" />
                Descargar
              </Button>
              <Button variant="primary" onClick={handleShow}>
                <Icon icon={faMagnifyingGlass} className="mr-4" />
                Explorar Series
              </Button>
            </Toolbar>
          </div>
        </Row>
        <Row>
          <Col>
            <Chart chartHeight={800}>
              {Array.from(selectedSeries.values()).map((data) => (
                <Chart.Line
                  key={`chart-${data.name}`}
                  data={data.serie}
                  color={data.color}
                  title={data.name}
                  scaleId={data.axisName}
                  applyFunctions={applyFunctions}
                />
              ))}
            </Chart>
          </Col>
        </Row>
        <Col>
          <CardGrid>
            {Array.from(serieNameInfo.entries()).map(([key, value]) => [
              selectedSeries.has(key) && (
                <Card
                  title={value.display_name}
                  icon={faLineChart}
                  color={selectedSeries.get(key)?.color}
                  actions={[
                    {
                      name: 'copy',
                      actionIcon: faClipboard,
                      actionEvent: () => {
                        navigator.clipboard.writeText(value.ticker);
                        toast.info(actions.copy, {
                          position: toast.POSITION.BOTTOM_RIGHT,
                        });
                      },
                    },
                    {
                      name: 'axis',
                      actionIcon:
                        selectedSeries.get(key)?.axisName === 'left'
                          ? faAlignLeft
                          : faAlignRight,
                      actionEvent: () => handleAxisChnage(value.ticker),
                    },
                    {
                      name: 'details',
                      actionIcon: faEye,
                      actionEvent: () => handleSelectInfoSerie(value),
                    },
                    {
                      name: 'delete',
                      actionIcon: faTrash,
                      actionEvent: () => handleRemoveSerie(value.ticker),
                    },
                  ]}
                  description={value.description}
                  fuente={value.fuente}
                />
              ),
            ])}
          </CardGrid>
        </Col>
      </Container>
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
              <Col>{loadingSerie ? <Spinner animation="border" /> : null}</Col>
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
                                    key={`serie-${serie.ticker}`}
                                    handleSeriePick={handleCheckboxChange}
                                    handleColorPicker={handleColorChnage}
                                    showColor
                                    displayName={serie.display_name}
                                    serieID={serie.ticker}
                                    disable={loadingSerie}
                                    checked={selectedSeries.has(serie.ticker)}
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
      <SerieInfoModal
        onCancel={() => handleSelectInfoSerie(null)}
        show={selectedInfoSerie !== null}
        serie={selectedInfoSerie}
      />
    </CoreLayout>
  );
}
