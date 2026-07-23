import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

const supabase = createClientComponentClient();
const SCHEMA = 'xerenity';

export type DeletePositionResponse = {
  data: { message: string } | undefined;
  error: string | undefined;
};

export const deleteXccyPositions = async (
  ids: string[]
): Promise<DeletePositionResponse> => {
  const response: DeletePositionResponse = { data: undefined, error: undefined };
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('delete_xccy_position', { position_ids: ids });
    if (error) {
      response.error = 'Error deleting XCCY position(s)';
      return response;
    }
    response.data = data;
    return response;
  } catch {
    response.error = 'Error deleting XCCY position(s)';
    return response;
  }
};

export const deleteNdfPositions = async (
  ids: string[]
): Promise<DeletePositionResponse> => {
  const response: DeletePositionResponse = { data: undefined, error: undefined };
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('delete_ndf_position', { position_ids: ids });
    if (error) {
      response.error = 'Error deleting NDF position(s)';
      return response;
    }
    response.data = data;
    return response;
  } catch {
    response.error = 'Error deleting NDF position(s)';
    return response;
  }
};

export const deleteIbrSwapPositions = async (
  ids: string[]
): Promise<DeletePositionResponse> => {
  const response: DeletePositionResponse = { data: undefined, error: undefined };
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('delete_ibr_swap_position', { position_ids: ids });
    if (error) {
      response.error = 'Error deleting IBR Swap position(s)';
      return response;
    }
    response.data = data;
    return response;
  } catch {
    response.error = 'Error deleting IBR Swap position(s)';
    return response;
  }
};

export const deleteCashPositions = async (
  ids: string[]
): Promise<DeletePositionResponse> => {
  const response: DeletePositionResponse = { data: undefined, error: undefined };
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('delete_cash_position', { position_ids: ids });
    if (error) {
      response.error = 'Error deleting CASH position(s)';
      return response;
    }
    response.data = data;
    return response;
  } catch {
    response.error = 'Error deleting CASH position(s)';
    return response;
  }
};

/**
 * Cierra una operacion CASH: registra TRM y fecha de cierre, marca active=false.
 * A partir de aca el P&L queda materializado (deja de marcar a spot).
 */
export const closeCashPosition = async (
  positionId: string,
  closedDate: string,
  closedPrice: number,
): Promise<DeletePositionResponse> => {
  const response: DeletePositionResponse = { data: undefined, error: undefined };
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('close_cash_position', {
        p_position_id: positionId,
        p_closed_date: closedDate,
        p_closed_price: closedPrice,
      });
    if (error) {
      response.error = 'Error closing CASH position';
      return response;
    }
    response.data = data;
    return response;
  } catch {
    response.error = 'Error closing CASH position';
    return response;
  }
};

export const deleteTesPositions = async (
  ids: string[]
): Promise<DeletePositionResponse> => {
  const response: DeletePositionResponse = { data: undefined, error: undefined };
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .rpc('delete_tes_position', { position_ids: ids });
    if (error) {
      response.error = 'Error deleting TES position(s)';
      return response;
    }
    response.data = data;
    return response;
  } catch {
    response.error = 'Error deleting TES position(s)';
    return response;
  }
};
