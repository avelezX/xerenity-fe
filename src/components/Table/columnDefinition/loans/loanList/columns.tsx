import IconButton from '@components/UI/IconButton';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { Loan } from 'src/types/loans';
import currencyFormat from 'src/utils/currencyFormat';
import useAppStore from '@store';

type DeletActionProps = {
  loan: Loan;
};

const DeleteAction = ({ loan }: DeletActionProps) => {
  const { onShowDeleteConfirm, setCurrentSelection } = useAppStore();

  return (
    <IconButton
      onClick={() => {
        setCurrentSelection(loan);
        onShowDeleteConfirm(true);
      }}
    >
      <Icon icon={faTrash} />
    </IconButton>
  );
};

const LoanListColumns = [
  {
    name: 'Contraparte',
    selector: (row: Loan) => row.bank,
    sortable: true,
  },
  {
    name: 'Identificador',
    selector: (row: Loan) => row.loan_identifier,
    sortable: true,
  },
  {
    name: 'Fecha de inicio',
    selector: (row: Loan) => row.start_date,
    sortable: true,
  },
  {
    name: 'Monto',
    selector: (row: Loan) => currencyFormat(row.original_balance),
    sortable: true,
  },
  {
    name: 'Tipo de tasa',
    selector: (row: Loan) => row.type,
    sortable: true,
  },
  {
    name: 'Periodicidad',
    selector: (row: Loan) => row.periodicity,
    sortable: true,
  },
  {
    name: 'Periodos',
    selector: (row: Loan) => row.number_of_payments,
    sortable: true,
  },
  {
    name: 'Tasa nominal',
    selector: (row: Loan) =>
      row.type === 'fija' ? `${row.interest_rate}%` : row.type,
    sortable: true,
  },
  {
    name: 'Spread',
    selector: (row: Loan) =>
      row.type === 'fija' ? '0.00%' : `${row.interest_rate}%`,
    sortable: true,
  },
  {
    name: 'Acciones',
    cell: (row: Loan) => <DeleteAction loan={row} />,
  },
];

export default LoanListColumns;
