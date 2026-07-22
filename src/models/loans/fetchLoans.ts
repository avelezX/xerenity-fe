import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Bank, Loan } from 'src/types/loans';

const supabase = createClientComponentClient();
const SCHEMA = 'xerenity';

export type LoanResponse = {
  data: Loan[];
  error: string | undefined;
};

const LOANS = {
  key: 'get_loans',
  error: 'Error Fetching Loans',
};

// Bug historico (julio 2026): antes se enviaba banks.map(b => b.bank_name)
// como filtro por defecto, lo que ocultaba creditos cuyo banco no coincidia
// EXACTAMENTE con un nombre en loans.bank (case-sensitive). Ejemplo real:
// backfill de 57 creditos FinanFuturo → solo 5 aparecian visibles porque
// 9 de los 11 bancos no estaban en loans.bank con esa capitalizacion exacta.
// Fix: pasar null para desactivar el filtro en el backend. El filtrado
// por banco se hace localmente en la UI con los pills de filtro cuando
// el usuario lo activa explicitamente. El parametro `banks` se mantiene
// en la firma por compat con callers existentes pero ya no se envia al RPC.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const fetchLoans = async (banks: Bank[], companyId?: string): Promise<LoanResponse> => {
  const response: LoanResponse = {
    data: [],
    error: undefined,
  };
  try {
    const { data, error } = await supabase.schema(SCHEMA).rpc(LOANS.key, {
      bank_name_filter: null,
      p_company_id: companyId ?? null,
    });

    if (error) {
      response.error = LOANS.error;
      return response;
    }
    response.data = data;
    return response;
  } catch (e) {
    response.error = LOANS.error;
    return response;
  }
};
