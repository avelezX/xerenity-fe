import Offcanvas from 'react-bootstrap/Offcanvas';
import { LoanCashFlowIbr } from 'src/types/loans';
import DataTableBase from '@components/Table/BaseTable';
import CashFlowListColumns from '../../../components/Table/columnDefinition/loans/chasFlow/columns';

type CashFlowOverlaPros = {
  handleShow: (show: boolean) => void;
  show: boolean;
  cashFlows: LoanCashFlowIbr[];
};

function CashFlowOverlay({ handleShow, show, cashFlows }: CashFlowOverlaPros) {
  return (
    <Offcanvas
      show={show}
      onHide={handleShow}
      placement="end"
      className="w-75 p-3"
    >
      <Offcanvas.Header closeButton>
        <Offcanvas.Title>Flujo de caja</Offcanvas.Title>
      </Offcanvas.Header>
      <Offcanvas.Body>
        <DataTableBase
          columns={CashFlowListColumns}
          data={cashFlows}
          fixedHeader
        />
      </Offcanvas.Body>
    </Offcanvas>
  );
}

export default CashFlowOverlay;
