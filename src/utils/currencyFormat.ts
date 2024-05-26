const currencyFormat = (value: number) => {
  const formattedVal = value.toLocaleString('us-US', {
    currencyDisplay: 'symbol',
    maximumFractionDigits: 0,
  });

  return formattedVal === '-0' ? '0' : formattedVal;
};

export default currencyFormat;
