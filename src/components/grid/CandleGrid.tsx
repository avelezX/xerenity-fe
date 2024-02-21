import { Table } from 'react-bootstrap';
import React, { ChangeEvent } from 'react';
import Form from 'react-bootstrap/Form';
import { GridEntry } from '@models/tes';
import NewPrevTag from '@components/price/NewPrevPriceTag';

export interface GridViewProps {
  selectCallback: (eventKey: ChangeEvent<HTMLFormElement>) => void;
  allTes: GridEntry[];
}

export default function CandleGridViewer({
  selectCallback,
  allTes,
}: GridViewProps) {
  return (
    <Form onChange={(e) => selectCallback(e as ChangeEvent<HTMLFormElement>)}>
      <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
        <Table
          bordered
          hover
          responsive="sm"
          style={{ fontSize: 13, textAlign: 'center' }}
        >
          <thead>
            <tr>
              <th>Name</th>

              <th>Change</th>

              <th>Last</th>

              <th>Prev</th>

              <th>Open</th>

              <th>Low</th>

              <th>High</th>

              <th>Volume</th>

              <th>Date/Hour</th>
            </tr>
          </thead>
          <tbody>
            {allTes.map((tesValue) => [
              <tr key={`tr-grid-row${tesValue.tes}`}>
                <td>
                  <Form.Check
                    inline
                    placeholder={tesValue.displayname}
                    type="radio"
                    label={tesValue.displayname
                      ?.replace('COLTES', 'T')
                      .toString()}
                    name="group1"
                    id={tesValue.tes}
                  />
                </td>
                <td>
                  <NewPrevTag current={tesValue.close} prev={tesValue.prev}>
                    {((tesValue.prev - tesValue.close) * 100).toFixed(1)} bps
                  </NewPrevTag>
                </td>
                <td>{tesValue.close.toFixed(2)}</td>
                <td>{tesValue.prev.toFixed(2)}</td>
                <td>{tesValue.open.toFixed(2)}</td>
                <td>{tesValue.low.toFixed(2)}</td>
                <td>{tesValue.high.toFixed(2)}</td>
                <td>{(tesValue.volume / 1000000000).toFixed(2)} MMM</td>
                <td>{tesValue.operation_time}</td>
              </tr>,
            ])}
          </tbody>
        </Table>
      </div>
    </Form>
  );
}
