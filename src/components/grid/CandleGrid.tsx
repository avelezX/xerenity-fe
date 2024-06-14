import { Table } from 'react-bootstrap';
import React, { ChangeEvent } from 'react';
import Form from 'react-bootstrap/Form';
import { GridEntry } from 'src/types/tes';
import NewPrevTag from '@components/price/NewPrevPriceTag';
import currencyFormat from 'src/utils/currencyFormat';
import {
  TableCell,
  TableHeader,
  TableRow,
  HeaderCell,
} from '@components/UI/Table';

export interface GridViewProps {
  selectCallback: (eventKey: ChangeEvent<HTMLFormElement>) => void;
  allTes: GridEntry[];
  currentSelection?: string;
}

export default function CandleGridViewer({
  selectCallback,
  allTes,
  currentSelection,
}: GridViewProps) {
  return (
    <Form onChange={(e) => selectCallback(e as ChangeEvent<HTMLFormElement>)}>
      <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
        <Table hover>
          <TableHeader>
            <TableRow>
              <HeaderCell>Name</HeaderCell>

              <HeaderCell>Change</HeaderCell>

              <HeaderCell>Date/Hour</HeaderCell>

              <HeaderCell alignRight>Last</HeaderCell>

              <HeaderCell alignRight>Prev</HeaderCell>

              <HeaderCell alignRight>Open</HeaderCell>

              <HeaderCell alignRight>Low</HeaderCell>

              <HeaderCell alignRight>High</HeaderCell>

              <HeaderCell alignRight>Volume</HeaderCell>
            </TableRow>
          </TableHeader>
          <tbody>
            {allTes.map((tesValue) => [
              <TableRow key={`tr-grid-row${tesValue.tes}`}>
                <TableCell>
                  <Form.Check
                    inline
                    readOnly
                    checked={tesValue.tes === currentSelection}
                    placeholder={tesValue.displayname}
                    type="radio"
                    label={tesValue.displayname
                      ?.replace('COLTES', 'T')
                      .toString()}
                    name="group1"
                    id={tesValue.tes}
                  />
                </TableCell>
                <TableCell>
                  <NewPrevTag current={tesValue.close} prev={tesValue.prev}>
                    {((tesValue.prev - tesValue.close) * 100 * -1).toFixed(1)}{' '}
                    bps
                  </NewPrevTag>
                </TableCell>
                <TableCell>{tesValue.operation_time}</TableCell>
                <TableCell alignRight>{tesValue.close.toFixed(2)}</TableCell>
                <TableCell alignRight>{tesValue.prev.toFixed(2)}</TableCell>
                <TableCell alignRight>{tesValue.open.toFixed(2)}</TableCell>
                <TableCell alignRight>{tesValue.low.toFixed(2)}</TableCell>
                <TableCell alignRight>{tesValue.high.toFixed(2)}</TableCell>
                <TableCell alignRight>
                  {currencyFormat(tesValue.volume)}
                </TableCell>
              </TableRow>,
            ])}
          </tbody>
        </Table>
      </div>
    </Form>
  );
}
