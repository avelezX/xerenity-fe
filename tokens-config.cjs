const StyleDictionary = require('style-dictionary');

const SOURCE = 'design-tokens/tokens.json';
const PATH = 'src/styles/';
const DESTINATION = '_token-variables.scss';
const FORMAT = 'scss/variables';

const excludeJsonWrapper = ({ name }) =>
  name.replace(/^(xerenity-)|(.*)$/, '$2');

const config = {
  source: [SOURCE],
  transform: {
    prefixRemoval: {
      type: 'name',
      transformer: (prop) => excludeJsonWrapper(prop),
    },
  },
  platforms: {
    scss: {
      transforms: StyleDictionary.transformGroup.scss.concat(['prefixRemoval']),
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
