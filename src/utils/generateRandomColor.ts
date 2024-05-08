const randomColor = (): string => {
  let result = '';
  for (let i = 0; i < 6; i += 1) {
    const value = Math.floor(16 * Math.random());
    result += value.toString(16);
  }
  return `#${result}`;
};

export default randomColor;
