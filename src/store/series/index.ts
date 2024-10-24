import { LightSerieEntry, LightSerie } from 'src/types/lightserie';
import { StateCreator } from 'zustand';
import {
  fetchFilterSeries,
  SearchFilters,
} from 'src/models/series/fetchSeries';
import { fetchSeriesData } from 'src/models/series/fetchSerieData';

const LEFT_AXIS = 'left';
const RIGHT_AXIS = 'right';

export interface SeriesSlice {
  allSeries: LightSerieEntry[];
  filteredSeries: LightSerieEntry[];
  selectedSeries: LightSerie[];
  subGrpByGrp: Map<string, string[]>;
  grupos: { value: string; label: string }[];
  subGrupos: { value: string; label: string }[];
  selectedGroup: string | undefined;
  selectedSubGroup: string | undefined;
  showSerieModal: boolean;
  curentSerie: string | undefined;
  showColorSerieModal: boolean;
  setCurrentSerie: (serie: string) => void;
  setAllSeries: (data: LightSerieEntry[]) => void;
  searchSeries: (values: SearchFilters) => void;
  addSelectedSerie: (
    idSerie: string,
    newColor: string,
    serieName: string
  ) => void;
  removeSelectedSerie: (idSerie: string) => void;
  errorMessage: string | undefined;
  setSelectedGroup: (grp: string | undefined) => void;
  setSelectedSubGroup: (subGrp: string | undefined) => void;
  removeSelected: (serie: LightSerie) => void;
  handleColorChnage: (serieId: string, newColor: string) => void;
  handleAxisChnage: (serie: LightSerie) => void;
  setShowSerieModal: (show: boolean) => void;
  setShowSerieColor: (show: boolean) => void;
  filterByText: (searchText: string) => void;
  resetStore: () => void;
}

const initialState = {
  allSeries: [],
  selectedSeries: [],
  grupos: [],
  subGrupos: [],
  showSerieModal: false,
  curentSerie: undefined,
  showColorSerieModal: false,
  filteredSeries: [],
  subGrpByGrp: new Map(),
  selectedGroup: undefined,
  selectedSubGroup: undefined,
  errorMessage: undefined,
};

const createSeriesSlice: StateCreator<SeriesSlice> = (set) => ({
  ...initialState,
  handleColorChnage: (serieId: string, newColor: string) => {
    set((state) => {
      const newSelectedSerie: LightSerie[] = [];

      state.selectedSeries.forEach((s) => {
        if (s.tiker === serieId) {
          const newSerie: LightSerie = s;
          newSerie.color = newColor;
          newSelectedSerie.push(newSerie);
        } else {
          newSelectedSerie.push(s);
        }
      });
      return {
        selectedSeries: newSelectedSerie,
      };
    });
  },
  setCurrentSerie: (serie: string) => {
    set(() => ({ curentSerie: serie }));
  },
  setShowSerieModal: (show: boolean) => {
    set(() => ({ showSerieModal: show }));
  },
  setShowSerieColor: (show: boolean) => {
    set(() => ({ showColorSerieModal: show }));
  },
  handleAxisChnage: (serie: LightSerie) => {
    set((state) => {
      const newSelectedSerie: LightSerie[] = [];

      state.selectedSeries.forEach((s) => {
        if (s.tiker === serie.tiker) {
          const newSerie: LightSerie = s;
          if (s.axisName === LEFT_AXIS) {
            newSerie.axisName = RIGHT_AXIS;
          } else {
            newSerie.axisName = LEFT_AXIS;
          }
          newSelectedSerie.push(newSerie);
        } else {
          newSelectedSerie.push(s);
        }
      });
      return {
        selectedSeries: newSelectedSerie,
      };
    });
  },
  setAllSeries: (data: LightSerieEntry[]) => set(() => ({ allSeries: data })),
  removeSelected: (serie: LightSerie) => {
    set((state) => ({
      selectedSeries: state.selectedSeries.filter(
        (s) => s.tiker !== serie.tiker
      ),
    }));
  },
  filterByText: (searchText: string) => {
    if (searchText.length > 0) {
      const searchLower = searchText.toLowerCase();
      set((state) => ({
        filteredSeries: state.filteredSeries.filter((s) =>
          s.display_name.toLowerCase().includes(searchLower)
        ),
      }));
    } else {
      set((state) => ({ filteredSeries: state.allSeries }));
    }
  },
  searchSeries: async (values: SearchFilters) => {
    const response = await fetchFilterSeries({
      grupo: values.grupo,
      subGrupo: values.subGrupo,
    });

    if (response.error) {
      set(() => ({ errorMessage: response.error }));
    } else {
      const allData = response.data as LightSerieEntry[];
      const auxSub: Map<string, string[]> = new Map();

      allData.forEach((datap) => {
        const keyA = auxSub.get(datap.grupo);

        if (keyA) {
          if (!keyA.includes(datap.sub_group)) {
            auxSub.set(datap.grupo, [...keyA, datap.sub_group]);
          }
        } else {
          auxSub.set(datap.grupo, [datap.sub_group]);
        }
      });

      set(() => ({
        grupos: Array.from(auxSub.keys()).map((k) => ({ value: k, label: k })),
        subGrupos: allData.map((grp) => ({
          value: grp.sub_group,
          label: grp.sub_group,
        })),
        allSeries: allData,
        filteredSeries: allData,
        subGrpByGrp: auxSub,
      }));
    }
  },
  setSelectedGroup: (grp: string | undefined) => {
    if (grp) {
      set((state) => {
        const subGrps = state.subGrpByGrp.get(grp);

        const filtered = state.allSeries.filter((s) => s.grupo === grp);
        return {
          filteredSeries: filtered,
          selectedGroup: grp,
          subGrupos: subGrps?.map((gr) => ({ value: gr, label: gr })),
          selectedSubGroup: undefined,
        };
      });
    }
  },
  setSelectedSubGroup: (subGrp: string | undefined) => {
    if (subGrp) {
      set((state) => {
        if (state.selectedGroup) {
          const filtered = state.allSeries.filter(
            (s) => s.grupo === state.selectedGroup && s.sub_group === subGrp
          );
          return {
            filteredSeries: filtered,
            selectedSubGroup: subGrp,
          };
        }
        const filtered = state.allSeries.filter((s) => s.sub_group === subGrp);
        return {
          filteredSeries: filtered,
          selectedSubGroup: subGrp,
        };
      });
    }
  },
  addSelectedSerie: async (
    idSerie: string,
    newColor: string,
    serieName: string
  ) => {
    const response = await fetchSeriesData({
      idSerie,
      newColor,
    });
    if (response.error) {
      set({ errorMessage: response.error });
    } else if (response.data) {
      response.data.tiker = idSerie;
      response.data.name = serieName;
      set((state) => ({
        selectedSeries: [...state.selectedSeries, response.data as LightSerie],
      }));
    }
  },
  removeSelectedSerie: (idSerie: string) => {
    set((state) => ({
      selectedSeries: state.selectedSeries.filter((f) => f.tiker !== idSerie),
    }));
  },
  resetStore: () => set(initialState),
});

export default createSeriesSlice;
