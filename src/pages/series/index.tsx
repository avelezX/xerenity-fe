'use client';

import { CoreLayout } from '@layout';
import {
  Row,
  Col,
  Container,
  Form,
  InputGroup,
  ToastContainer,
  Toast,
} from 'react-bootstrap';
import React, { useState, useEffect, useRef } from 'react';
import { LightSerieEntry, lightSerieValueArray } from 'src/types/lightserie';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faFileCsv,
  faChartSimple,
  faSearch,
} from '@fortawesome/free-solid-svg-icons';
import { ExportToCsv, downloadBlob } from 'src/utils/downloadCSV';
import 'react-toastify/dist/ReactToastify.css';
import Toolbar from '@components/UI/Toolbar';
import Chart from '@components/chart/Chart';
import Button from '@components/UI/Button';
import PageTitle from '@components/PageTitle';
import useAppStore from '@store';
import Panel from '@components/Panel';
import { SingleValue } from 'react-select';
import SingleSelect from '@components/UI/SingleSelect';
import { SelectableRows } from 'src/types/selectableRows';
import { XerenityHexColors } from 'src/utils/getHexColors';
import { getGroupColor } from 'src/utils/groupConstants';
import Circle from '@uiw/react-color-circle';
import SeriesTable from './_seriesTable';
import SelectedSeriesTable from './_selectedSeriesTable';
import SerieInfoModal from './_SerieInfoModal';

const PAGE_TITLE = 'Series';
const NORMALIZE_SINCE = 'Normalizar desde:';

export default function Dashboard() {
  const normalizeDate = useRef<string>('');
  const searchByName = useRef<string>('');

  const {
    filteredSeries,
    selectedSeries,
    allSeries,
    grupos,
    subGrupos,
    entidades,
    selectedGroup,
    soloActivos,
    addSelectedSerie,
    removeSelectedSerie,
    searchSeries,
    setSelectedGroup,
    setSelectedSubGroup,
    setSelectedEntidad,
    setSoloActivos,
    curentSerie,
    showSerieModal,
    showColorSerieModal,
    setShowSerieModal,
    handleColorChnage,
    setShowSerieColor,
    filterByText,
    resetStore,
    loading,
  } = useAppStore();

  const isFIC = selectedGroup === 'FIC';

  const normalize = useRef<boolean>(false);
  const [applyFunctions, setApplyunctions] = useState<string[]>([]);

  useEffect(() => {
    searchSeries({});
    return () => resetStore(); // Reset when component unmount
  }, [resetStore, searchSeries]);

  function arrayDifference<T>(array1: T[], array2: T[]): T {
    return array1.filter((item) => !array2.includes(item))[0];
  }

  const handleSelectSerie = ({
    selectedCount,
    selectedRows,
  }: SelectableRows<LightSerieEntry>) => {
    if (selectedCount > selectedSeries.length) {
      const added = arrayDifference(
        selectedRows.map((r) => r.ticker),
        selectedSeries.map((a) => a.tiker)
      );
      const removedData = selectedRows.find((a) => a.ticker === added);
      if (added && removedData) {
        const color = getGroupColor(removedData.grupo);
        addSelectedSerie(added, color, removedData.display_name);
      }
    } else {
      const removed = arrayDifference(
        selectedSeries.map((a) => a.tiker),
        selectedRows.map((r) => r.ticker)
      );
      if (removed) {
        removeSelectedSerie(removed);
      }
    }
  };

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

  const onGroupChnage = (
    newValue: SingleValue<{ value: string; label: string }>
  ) => {
    if (newValue) {
      setSelectedGroup(newValue.value);
    }
  };

  const onSubGroupChnage = (
    newValue: SingleValue<{ value: string; label: string }>
  ) => {
    if (newValue) {
      setSelectedSubGroup(newValue?.value);
    }
  };

  const onEntidadChange = (
    newValue: SingleValue<{ value: string; label: string }>
  ) => {
    if (newValue) {
      setSelectedEntidad(newValue.value);
    }
  };

  const HandleColorSelect = async (newColor: {
    hex: React.SetStateAction<string>;
  }) => {
    if (curentSerie) {
      handleColorChnage(curentSerie, newColor.hex.toString());
      setShowSerieColor(false);
    }
  };

  return (
    <CoreLayout>
      <SerieInfoModal
        onCancel={() => {
          setShowSerieModal(false);
        }}
        show={showSerieModal}
        serie={allSeries.find((s) => s.ticker === curentSerie)}
      />
      <ToastContainer>
        <Toast
          onClose={() => setShowSerieColor(false)}
          show={showColorSerieModal}
          animation
        >
          <Toast.Body>
            <Circle
              style={{ width: '100%', height: '100%' }}
              colors={XerenityHexColors}
              onChange={HandleColorSelect}
            />
          </Toast.Body>
        </Toast>
      </ToastContainer>
      <Container fluid className="px-4 pb-3">
        <Row>
          <div className="d-flex align-items-center gap-2 py-1">
            <PageTitle>
              <Icon icon={faChartSimple} size="1x" />
              <h4>{PAGE_TITLE}</h4>
            </PageTitle>
          </div>
        </Row>
        <Row>
          <div className="d-flex justify-content-end pb-3">
            <Toolbar>
              <InputGroup>
                <InputGroup.Checkbox onChange={handleNormalize} />
                <InputGroup.Text>{NORMALIZE_SINCE}</InputGroup.Text>
                <Form.Control
                  type="date"
                  onChange={(a) => {
                    normalizeDate.current = a.target.value;
                  }}
                />
              </InputGroup>
              <Button variant="outline-primary" onClick={downloadSeries}>
                <Icon icon={faFileCsv} className="mr-4" />
                Descargar
              </Button>
            </Toolbar>
          </div>
        </Row>
        <Row>
          <Row style={{ marginBottom: '23px' }}>
            <Col sm={8}>
              <Chart showToolbar loading={loading}>
                {selectedSeries.map((data) => (
                  <Chart.Line
                    key={`chart-${data.tiker}`}
                    data={data.serie}
                    color={data.color}
                    title={data.name}
                    scaleId={data.axisName}
                    applyFunctions={applyFunctions}
                    fromNormalizeDate={normalizeDate.current}
                  />
                ))}
              </Chart>
            </Col>
            <Col sm={4}>
              <SelectedSeriesTable list={selectedSeries} />
            </Col>
          </Row>
          <Col sm={12}>
            <Panel>
              <Row>
                <Col sm={12} md={4}>
                  <InputGroup>
                    <Form.Control
                      type="text"
                      onChange={(a) => {
                        searchByName.current = a.target.value;
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          filterByText(searchByName.current);
                        }
                      }}
                    />
                    <InputGroup.Text className="bg-white border-right-none">
                      <Icon
                        className="text-primary"
                        icon={faSearch}
                        fixedWidth
                        onClick={() => {
                          filterByText(searchByName.current);
                        }}
                      />
                    </InputGroup.Text>
                  </InputGroup>
                </Col>
                <Col sm={12} md={4}>
                  <SingleSelect
                    data={grupos}
                    placeholder="Seleccione el Grupo"
                    onChange={onGroupChnage}
                  />
                </Col>
                <Col sm={12} md={4} className="align-self-end">
                  <SingleSelect
                    data={subGrupos}
                    onChange={onSubGroupChnage}
                    placeholder="Seleccione el Sub Grupo"
                  />
                </Col>
              </Row>
              {isFIC && (
                <Row className="mt-2">
                  <Col sm={12} md={4}>
                    <SingleSelect
                      data={entidades}
                      onChange={onEntidadChange}
                      placeholder="Filtrar por Entidad"
                    />
                  </Col>
                  <Col
                    sm={12}
                    md={4}
                    className="d-flex align-items-center"
                  >
                    <Form.Check
                      type="switch"
                      id="solo-activos"
                      label="Solo activos (datos en últimos 90 días)"
                      checked={soloActivos}
                      onChange={(e) => setSoloActivos(e.target.checked)}
                    />
                  </Col>
                </Row>
              )}
              <SeriesTable list={filteredSeries} onSelect={handleSelectSerie} />
            </Panel>
          </Col>
        </Row>
      </Container>
    </CoreLayout>
  );
}
