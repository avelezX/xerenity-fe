const StyleDictionary = require('style-dictionary');

const SOURCE = 'design-tokens/tokens.json';
const PATH = 'src/styles/';
const DESTINATION = '_token-variables.scss';
const FORMAT = 'scss/variables';

const excludeJsonWrapper = ({ name }) =>
  name.replace(/^(xerenity-)|(.*)$/, '$2');

// Transform token values to be easily consumed in SCSS
const valueTransformer = ({ value, type }) => {
  if (
    type === 'borderWidth' ||
    type === 'fontSizes' ||
    type === 'borderRadius'
  ) {
    return `${value}px`;
  } else if (type === 'fontFamilies') {
    return `'${value}'`;
  }
  return value;
};

const config = {
  source: [SOURCE],
  transform: {
    valueTransform: {
      type: 'value',
      transformer: valueTransformer,
    },
    prefixRemoval: {
      type: 'name',
      transformer: (prop) => excludeJsonWrapper(prop),
    },
  },
  platforms: {
    scss: {
      transforms: StyleDictionary.transformGroup.scss.concat([
        'valueTransform',
        'prefixRemoval',
      ]),
      buildPath: PATH,
      files: [
        {
          destination: DESTINATION,
          format: FORMAT,
        },
      ],
    },
  },
};

module.exports = config;
