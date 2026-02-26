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
