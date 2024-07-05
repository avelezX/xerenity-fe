import Select, { MultiValue } from 'react-select';
import tokens from 'design-tokens/tokens.json';

const designSystem = tokens.xerenity;
const PURPLE_10 = designSystem['purple-10'].value;
const PURPLE_200 = designSystem['purple-200'].value;
const RADIUS_MD = parseInt(designSystem['radius-md'].value, 7);

type MultipleSelectProps = {
  data: MultiValue<{ value: string; label: string }>;
  placeholder?: string;
  onChange: (
    selections: MultiValue<{
      value: string;
      label: string;
    }>
  ) => void;
};

const MultipleSelect = ({
  placeholder,
  data,
  onChange,
}: MultipleSelectProps) => (
  <Select
    styles={{
      container: (baseStyles) => ({
        ...baseStyles,
        width: '100%',
      }),
    }}
    theme={(theme) => ({
      ...theme,
      borderRadius: RADIUS_MD,
      colors: {
        ...theme.colors,
        primary25: PURPLE_10,
        neutral10: PURPLE_10,
        primary: PURPLE_200,
      },
    })}
    isMulti
    options={data}
    placeholder={placeholder}
    onChange={onChange}
  />
);

export default MultipleSelect;
