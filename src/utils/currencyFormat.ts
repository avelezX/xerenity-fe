const currencyFormat = (value: number, fixed: number = 2) => {
  const formattedVal = value.toLocaleString('us-US', {
    currencyDisplay: 'symbol',
    maximumFractionDigits: fixed,
  });

  return formattedVal === '-0' ? '0' : formattedVal;
};

export default currencyFormat;
