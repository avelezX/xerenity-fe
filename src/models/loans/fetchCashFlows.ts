import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { LoanCashFlowIbr } from 'src/types/loans';
import {
  telemetry,
  combineAbortSignals,
  DEFAULT_FETCH_TIMEOUT_MS,
  isAbortError,
} from 'src/lib/telemetry';

// CashFlows Response
export type CashflowResponse = {
  data: LoanCashFlowIbr[];
  error: string | undefined;
};

export interface FetchCashFlowsOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

const CASH_FLOW = {
  key: 'loan_cash_flow',
  error: 'Error Fetching Cash Flows',
};

const CASH_FLOW_IBR = {
  key: 'ibr_cash_flow',
  error: 'Error Fetching IBR Cash Flows',
};

const CASH_FLOW_UVR = {
  key: 'uvr_cash_flow',
  error: 'Error Fetching UVR Cash Flows',
};

const SCHEMA = 'xerenity';
const supabase = createClientComponentClient();

export const fetchCashFlows = async (
  loanId: string,
  loanType: string,
  filterDate: string,
  opts?: FetchCashFlowsOptions,
): Promise<CashflowResponse> => {
  let requestKey = CASH_FLOW.key;

  if (loanType === 'ibr') {
    requestKey = CASH_FLOW_IBR.key;
  } else if (loanType === 'uvr') {
    requestKey = CASH_FLOW_UVR.key;
  }
  const response: CashflowResponse = {
    data: [],
    error: undefined,
  };
  const signal = combineAbortSignals(
    opts?.signal,
    opts?.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS,
  );
  return telemetry.time(
    'loans',
    requestKey,
    async () => {
      try {
        const { data, error } = await supabase
          .schema(SCHEMA)
          .rpc(requestKey, { credito_id: loanId, filter_date: filterDate })
          .abortSignal(signal);

        if (error) {
          telemetry.warn('loans', `${requestKey} rpc error`, {
            loanId,
            rpcMessage: error.message,
            code: error.code,
          });
          response.error = CASH_FLOW.error;
          return response;
        }

        response.data = data;
        return response;
      } catch (e) {
        if (isAbortError(e)) {
          telemetry.debug('loans', `${requestKey} aborted`, { loanId });
          // Propagate so callers using Promise.allSettled can distinguish
          // "my request was cancelled" from "backend error".
          throw e;
        }
        telemetry.warn('loans', `${requestKey} threw`, {
          loanId,
          message: e instanceof Error ? e.message : String(e),
        });
        response.error = CASH_FLOW.error;
        return response;
      }
    },
    { loanId, loanType, filterDate },
  );
};
