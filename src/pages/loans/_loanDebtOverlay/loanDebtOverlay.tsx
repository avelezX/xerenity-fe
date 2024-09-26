import Offcanvas from 'react-bootstrap/Offcanvas';
import { LoanData } from 'src/types/loans';
import DataTableBase from '@components/Table/BaseDataTable';
import LoanDebtListColumns from '@components/Table/columnDefinition/loans/loanDebt/columns';

type LoanDebtOverlayProps = {
  handleShow: (show: boolean) => void;
  show: boolean;
  loanDebtData: LoanData[];
};

function LoanDebtOverlay({
  handleShow,
  show,
  loanDebtData,
}: LoanDebtOverlayProps) {
  return (
    <Offcanvas
      show={show}
      onHide={handleShow}
      placement="end"
      className="w-75 p-3"
    >
      <Offcanvas.Header closeButton>
        <Offcanvas.Title>Deuda Total</Offcanvas.Title>
      </Offcanvas.Header>
      <Offcanvas.Body>
        <DataTableBase
          columns={LoanDebtListColumns}
          data={loanDebtData}
          fixedHeader
        />
      </Offcanvas.Body>
    </Offcanvas>
  );
}

export default LoanDebtOverlay;
