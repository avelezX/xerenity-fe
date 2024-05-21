import { Loan } from '@models/loans';
import { Form, Table } from 'react-bootstrap';
import Alert from '@components/UI/Alert';
import Badge from '@components/UI/Badge';
import IconButton from '@components/UI/IconButton';

import tokens from 'design-tokens/tokens.json';
import { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import { ChangeEvent, MouseEventHandler } from 'react';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';

const designSystem = tokens.xerenity;
const PURPLE_COLOR_100 = designSystem['purple-100'].value;
const GREY_COLOR_300 = designSystem['gray-300'].value;

type LoanAction = {
    actionIcon: IconDefinition;
    actionEvent: MouseEventHandler<HTMLButtonElement>;
    name: string;
};

type LoanDisplayProps = {
    loan:Loan;
    actions:LoanAction[];
    checked:boolean;
    disabled:boolean;
    onSelect:(event: ChangeEvent<HTMLInputElement>,loanId: string,loanType: string)=>void;
}

export default function LoanDisplay({loan,actions,onSelect,checked,disabled}: LoanDisplayProps) {


    return (
        <Alert >
            <div className="container">
                <div className="row">
                    <div className="col-1">
                        <Form.Check
                            type="switch"
                            checked={checked}
                            id={`check-${loan.id}`}
                            disabled={disabled}
                            onChange={(e) =>
                                onSelect(e, loan.id, loan.type)
                            }
                        />
                    </div>
                    <div className="col">            
                        <Table>
                            <tbody>

                                <td>
                                    {loan.type === 'ibr' ? (
                                        <Badge pill bg={PURPLE_COLOR_100}>
                                            {loan.type}
                                        </Badge>
                                    ) : (
                                        <Badge pill bg={GREY_COLOR_300}>
                                            {loan.type}
                                        </Badge>
                                    )}
                                </td>
                                <td>{loan.bank}</td>
                                <td>{loan.original_balance}</td>
                                <td>{loan.periodicity}</td>
                                <td>{loan.interest_rate}</td>
                                <td>{loan.interest_rate}</td>
                                <td >
                                    <div className="row">
                                        {actions?.map(({ name, actionIcon, actionEvent }) => (
                                            <IconButton key={name} onClick={actionEvent}>
                                                <Icon icon={actionIcon} />
                                            </IconButton>
                                        ))}
                                    </div>
                                </td>
                            </tbody>
                        </Table>
                    </div>
                </div>
            </div>
        </Alert>
    );
}
