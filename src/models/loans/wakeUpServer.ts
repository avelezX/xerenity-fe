import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

const supabase = createClientComponentClient();
const SCHEMA = 'xerenity';

export type WakeUpResponse = {
  message: string | undefined;
  error: string | undefined;
};

const LOAN_SERVER = {
  key: 'wake_up_loan_server',
  error: 'Error al comunicar con el servidor de creditos',
};

export const wakeUpServer = async (): Promise<WakeUpResponse> => {
  const response: WakeUpResponse = {
    message: undefined,
    error: undefined,
  };
  try {
    const { data, error } = await supabase.schema(SCHEMA).rpc(LOAN_SERVER.key);
    if (error) {
      response.error = error.message;
      return response;
    }
    response.message = data;
    return response;
  } catch (e) {
    response.error = LOAN_SERVER.error;
    return response;
  }
};
