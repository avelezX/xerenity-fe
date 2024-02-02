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
    rate: number;
}

export interface LoanCashFlowIbr 
{
    date:string;
    rate: number;
    payment: number;
    interest: number;
    principal: number;
    ending_balance: number;
    beginning_balance: number;
}
