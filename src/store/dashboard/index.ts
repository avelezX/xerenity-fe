import { StateCreator } from 'zustand';
import {
  fetchCurrency,
  FetchCurrencyResponse,
} from 'src/models/charts/fetchCurrency';
import {
  fetchCpiIndex,
  FetchCPIIndexResponse,
} from 'src/models/charts/fetchCPIIndex';
import { TesYields } from 'src/types/tes';
import { LightSerieValue } from 'src/types/lightserie';
import {
  fetchBanrepSerie,
  FetchBanrepSerieResponse,
} from 'src/models/charts/fechBanrepSerie';
import {
  DashboardBox,
  fectchDashboardBoxes,
  FetchDashboardBoxesResponse,
} from 'src/models/charts/fetchDashboardBoxes';

export interface DashboardSlice {
  chartTES33Data: TesYields[];
  volumeTES33Data: LightSerieValue[];
  chartUSDCOPData: TesYields[];
  volumechartUSDCOPDData: LightSerieValue[];
  chartCPIIndexData: LightSerieValue[];
  chartPoliticaMonetaria: LightSerieValue[];
  dashboardBoxes: DashboardBox[];
  errorMessage: string | undefined;
  successMessage: string | undefined;
  loading: boolean;
  getChartUSDCOPData: () => void;
  getCpiIndexData: () => void;
  getPoliticaMonetariaData: () => void;
  getDashboardBoxes: () => void;
}

const initialState = {
  chartTES33Data: [],
  volumeTES33Data: [],
  chartUSDCOPData: [],
  volumechartUSDCOPDData: [],
  chartPoliticaMonetaria: [],
  chartCPIIndexData: [],
  dashboardBoxes: [],
  errorMessage: undefined,
  successMessage: undefined,
  loading: false,
};

const createDashboardSlice: StateCreator<DashboardSlice> = (set) => ({
  ...initialState,
  getChartUSDCOPData: async () => {
    set({ loading: true });

    const { data, error }: FetchCurrencyResponse =
      await fetchCurrency('USD:COP');

    if (error) {
      set({ loading: false, errorMessage: error, chartUSDCOPData: [] });
    } else if (data) {
      const allData = data as TesYields[];
      const chartUSDCOPData: TesYields[] = [];
      const volumechartUSDCOPDData: { time: string; value: number }[] = [];

      allData.forEach((tes) => {
        if (tes.volume) {
          volumechartUSDCOPDData.push({
            time: tes.day.split('T')[0],
            value: tes.volume,
          });
          chartUSDCOPData.push(tes);
        }
      });

      set({ chartUSDCOPData, volumechartUSDCOPDData });
    }
  },
  getCpiIndexData: async () => {
    set({ loading: true });

    const { data, error }: FetchCPIIndexResponse = await fetchCpiIndex(1, 12);

    if (error) {
      set({ loading: false, errorMessage: error, chartUSDCOPData: [] });
    } else if (data) {
      const chartCPIIndexData: LightSerieValue[] = data;

      set({ chartCPIIndexData });
    }
  },
  getDashboardBoxes: async () => {
    set({ loading: true });

    const { data, error }: FetchDashboardBoxesResponse =
      await fectchDashboardBoxes();

    if (error) {
      set({ loading: false, errorMessage: error, dashboardBoxes: [] });
    } else if (data) {
      const dashboardBoxes: DashboardBox[] = data;

      set({ dashboardBoxes });
    }
  },
  getPoliticaMonetariaData: async () => {
    set({ loading: true });

    const { data, error }: FetchBanrepSerieResponse = await fetchBanrepSerie(8);

    if (error) {
      set({ loading: false, errorMessage: error, chartPoliticaMonetaria: [] });
    } else if (data) {
      const chartPoliticaMonetaria: LightSerieValue[] = data;

      set({ chartPoliticaMonetaria });
    }
  },
});

export default createDashboardSlice;
