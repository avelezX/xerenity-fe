import { StateCreator } from 'zustand';
import { fetchTES33, FetchTES33Response } from 'src/models/charts/fetchTES_33';
import { TesYields } from 'src/types/tes';
import { LightSerieValue } from 'src/types/lightserie';

export interface DashboardSlice {
  chartTES33Data: TesYields[];
  volumeTES33Data: LightSerieValue[];
  errorMessage: string | undefined;
  successMessage: string | undefined;
  loading: boolean;
  getChartTES33Data: () => void;
}

const initialState = {
  chartTES33Data: [],
  volumeTES33Data: [],
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
});

export default createDashboardSlice;
