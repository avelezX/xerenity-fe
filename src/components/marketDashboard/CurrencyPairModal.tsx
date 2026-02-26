import { useState } from 'react';
import { faDollarSign } from '@fortawesome/free-solid-svg-icons';
import Dropdown from 'react-bootstrap/Dropdown';
import Modal from '@components/UI/Modal';

type CurrencyPairModalProps = {
  show: boolean;
  onCancel: () => void;
  onSave: (pair: string) => void;
};

const ALL_COINS = [
  'USD',
  'EUR',
  'COP',
  'MXN',
  'BRL',
  'AUD',
  'JPY',
  'CHF',
  'GBP',
  'NOK',
  'SEK',
  'HUF',
  'PLN',
  'CNY',
  'INR',
  'IDR',
  'HKD',
  'MYR',
  'SGD',
];

export default function CurrencyPairModal({
  show,
  onCancel,
  onSave,
}: CurrencyPairModalProps) {
  const [currencyFrom, setCurrencyFrom] = useState<string>('USD');
  const [currencyTo, setCurrencyTo] = useState<string>('COP');

  const handleSave = () => {
    if (currencyFrom !== currencyTo) {
      onSave(`${currencyFrom}:${currencyTo}`);
    }
  };

  return (
    <Modal
      onCancel={onCancel}
      cancelText="Cancelar"
      onSave={handleSave}
      saveText="Agregar"
      title="Agregar par de monedas"
      display={show}
      icon={faDollarSign}
    >
      <div className="d-flex gap-3 px-4 py-3 align-items-center">
        <Dropdown>
          <Dropdown.Toggle variant="outline-primary" size="sm">
            {currencyFrom}
          </Dropdown.Toggle>
          <Dropdown.Menu style={{ maxHeight: 250, overflowY: 'auto' }}>
            {ALL_COINS.map((c) => (
              <Dropdown.Item key={c} onClick={() => setCurrencyFrom(c)}>
                {c}
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown>
        <span style={{ fontSize: 16, fontWeight: 600 }}>:</span>
        <Dropdown>
          <Dropdown.Toggle variant="outline-primary" size="sm">
            {currencyTo}
          </Dropdown.Toggle>
          <Dropdown.Menu style={{ maxHeight: 250, overflowY: 'auto' }}>
            {ALL_COINS.filter((c) => c !== currencyFrom).map((c) => (
              <Dropdown.Item key={c} onClick={() => setCurrencyTo(c)}>
                {c}
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown>
      </div>
    </Modal>
  );
}
