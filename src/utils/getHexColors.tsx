import tokens from 'design-tokens/tokens.json';

const designSystem = tokens.xerenity;

export const XerenityHexColors = [
  designSystem['purple-300'].value,
  designSystem['gray-300'].value,
  designSystem['green-300'].value,
  designSystem['red-300'].value,
  designSystem['yellow-300'].value,
  designSystem['purple-500'].value,
  designSystem['gray-500'].value,
  designSystem['green-500'].value,
  designSystem['red-400'].value,
  designSystem['yellow-500'].value,
];

export function getHexColor(index: number) {
  return XerenityHexColors[index % XerenityHexColors.length];
}
