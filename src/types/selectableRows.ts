export interface SelectableRows<T> {
  selectedCount: number;
  selectedRows: T[];
}

export interface SelectedLoansDate<T> {
  selectedCount: number;
  selectedRows: T[];
  filterDate: string;
}
