import { StateCreator } from 'zustand';
import { fetchTES33, FetchTES33Response } from 'src/models/charts/fetchTES_33';
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

export interface DashboardSlice {
  chartTES33Data: TesYields[];
  volumeTES33Data: LightSerieValue[];
  chartUSDCOPData: LightSerieValue[];
  chartUSDMXNData: LightSerieValue[];
  chartCPIIndexData: LightSerieValue[];
  errorMessage: string | undefined;
  successMessage: string | undefined;
  loading: boolean;
  getChartTES33Data: () => void;
  getChartUSDCOPData: () => void;
  getCpiIndexData: () => void;
  getUSDMXNData: () => void;
}

const initialState = {
  chartTES33Data: [],
  volumeTES33Data: [],
  chartUSDCOPData: [],
  chartUSDMXNData: [],
  chartCPIIndexData: [],
  errorMessage: undefined,
  successMessage: undefined,
  loading: false,
};

const createDashboardSlice: StateCreator<DashboardSlice> = (set) => ({
  ...initialState,
  getChartTES33Data: async () => {
    set({ loading: true });

    const { data, error }: FetchTES33Response = await fetchTES33();

    if (error) {
      set({ loading: false, errorMessage: error, chartTES33Data: [] });
    } else if (data) {
      const chartTES33Data: TesYields[] = data;
      const volumeTES33Data: { time: string; value: number }[] = [];

      chartTES33Data.forEach((tes) => {
        volumeTES33Data.push({
          time: tes.day.split('T')[0],
          value: tes.volume,
        });
      });

      set({ chartTES33Data, volumeTES33Data });
    }
  },
  getChartUSDCOPData: async () => {
    set({ loading: true });

    const { data, error }: FetchCurrencyResponse =
      await fetchCurrency('USD:COP');

    if (error) {
      set({ loading: false, errorMessage: error, chartUSDCOPData: [] });
    } else if (data) {
      const chartUSDCOPData: LightSerieValue[] = data;

      set({ chartUSDCOPData });
    }
  },
  getUSDMXNData: async () => {
    set({ loading: true });

    const { data, error }: FetchCurrencyResponse =
      await fetchCurrency('USD:MXN');

    if (error) {
      set({ loading: false, errorMessage: error, chartUSDCOPData: [] });
    } else if (data) {
      const chartUSDMXNData: LightSerieValue[] = data;

      set({ chartUSDMXNData });
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
});

export default createDashboardSlice;
