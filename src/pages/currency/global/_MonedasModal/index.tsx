'use client';

import { useState } from 'react';
import { faDollarSign } from '@fortawesome/free-solid-svg-icons';
import Dropdown from 'react-bootstrap/Dropdown';
import Modal from '@components/UI/Modal';

type MonedasModalProps = {
  onCancel: () => void;
  onSave: (currencyFrom: string, currencyTo: string) => void;
  show: boolean;
};

const ALL_COINS = [
  'NOK',
  'JPY',
  'CHF',
  'SEK',
  'HUF',
  'PLN',
  'CNY',
  'INR',
  'IDR',
  'HKD',
  'MYR',
  'SGD',
  'USD',
  'EUR',
  'COP',
  'MXN',
  'BRL',
  'AUD',
];

const MODAL_TITLE = 'Agregar Comparación de Monedas';
const SAVE_TXT = 'Guardar';
const CANCEL_TXT = 'Cancelar';

const MonedasModal = ({ show, onCancel, onSave }: MonedasModalProps) => {
  const [currencyFrom, setCurrencyFrom] = useState<string>('HUF');
  const [currencyTo, setCurrencyTo] = useState<string>('EUR');

  return (
    <Modal
      onCancel={onCancel}
      cancelText={CANCEL_TXT}
      onSave={() => onSave(currencyFrom, currencyTo)}
      saveText={SAVE_TXT}
      title={MODAL_TITLE}
      display={show}
      icon={faDollarSign}
    >
      <div className="row px-4">
        <div className="col-xs-6 py-3">
          <Dropdown>
            <Dropdown.Toggle variant="success" id="dropdown-basic">
              {currencyFrom}
            </Dropdown.Toggle>
            <Dropdown.Menu>
              {ALL_COINS.map((currency) => (
                <Dropdown.Item
                  key={`drop-curr-${currency}`}
                  onClick={() => {
                    setCurrencyFrom(currency);
                  }}
                >
                  {currency}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
        </div>
        <div className="col-xs-6 py-3">
          <Dropdown>
            <Dropdown.Toggle variant="success" id="dropdown-basic">
              {currencyTo}
            </Dropdown.Toggle>
            <Dropdown.Menu>
              {ALL_COINS.map((currency) => (
                <Dropdown.Item
                  key={`drop-curr-${currency}`}
                  onClick={() => {
                    setCurrencyTo(currency);
                  }}
                >
                  {currency}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
        </div>
      </div>
    </Modal>
  );
};

export default MonedasModal;
