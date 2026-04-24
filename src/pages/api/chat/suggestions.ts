import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = createPagesServerClient({ req, res });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  const { data, error } = await supabase
    .schema('xerenity')
    .rpc('get_active_agent_suggestions');

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ suggestions: data || [] });
}
