export interface Loan {
    id:string;
    start_date:string;
    number_of_payments:number;
    original_balance:number;
    rate_type:number;
    periodicity:string;
    interest_rate:number;
    type:string;
}

export interface LoanCashFlow
{
    date: string;
    beginning_balance: number;
    payment: number;
    interest: number;
    principal: number;
    ending_balance: number;
}

export interface LoanCashFlowIbr extends LoanCashFlow
{
    rate: number;
}

export interface LoanType {
    value:string;
    display:string;
}