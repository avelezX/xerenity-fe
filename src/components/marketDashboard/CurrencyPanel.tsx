import React from 'react';
import WatchlistPanelContainer from './styled/WatchlistPanelContainer.styled';
import { CurrencyItemContainer, CurrencyPanelTitle, CurrencySectionHeader } from './styled/CurrencyItem.styled';

const FIAT_CURRENCIES = [
  'USD', 'EUR', 'COP', 'MXN', 'BRL', 'AUD', 'JPY', 'CHF',
  'GBP', 'NOK', 'SEK', 'HUF', 'PLN', 'CNY', 'INR', 'IDR',
  'HKD', 'MYR', 'SGD',
];

const CRYPTO_CURRENCIES = [
  'BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'AVAX', 'DOT',
  'MATIC', 'LINK', 'BNB', 'LTC', 'UNI', 'ATOM', 'NEAR',
  'APT', 'ARB', 'OP', 'FTM', 'ALGO',
];

type CurrencyPanelProps = {
  title: string;
  selected: string | null;
  onSelect: (currency: string) => void;
};

export default function CurrencyPanel({ title, selected, onSelect }: CurrencyPanelProps) {
  return (
    <WatchlistPanelContainer>
      <CurrencyPanelTitle>{title}</CurrencyPanelTitle>
      <CurrencySectionHeader>Fiat</CurrencySectionHeader>
      {FIAT_CURRENCIES.map((currency) => (
        <CurrencyItemContainer
          key={currency}
          isSelected={selected === currency}
          onClick={() => onSelect(currency)}
        >
          {currency}
        </CurrencyItemContainer>
      ))}
      <CurrencySectionHeader>Crypto</CurrencySectionHeader>
      {CRYPTO_CURRENCIES.map((currency) => (
        <CurrencyItemContainer
          key={currency}
          isSelected={selected === currency}
          onClick={() => onSelect(currency)}
        >
          {currency}
        </CurrencyItemContainer>
      ))}
    </WatchlistPanelContainer>
  );
}
