import Select, { MultiValue } from 'react-select';
import styled from 'styled-components';

type MultipleSelectProps = {
  data: MultiValue<{ value: string; label: string }>;
  onChange: (
    selections: MultiValue<{
      value: string;
      label: string;
    }>
  ) => Promise<void>;
};

const SelectContainer = styled(Select)`
  width: 100%;
`;

const MultipleSelect = ({ data, onChange }: MultipleSelectProps) => (
  <SelectContainer
    isMulti
    options={data}
    onChange={onChange as (newValue: unknown) => void}
  />
);

export default MultipleSelect;
