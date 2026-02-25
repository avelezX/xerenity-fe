import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { code } = req.query;

  if (typeof code === 'string') {
    const supabase = createPagesServerClient({ req, res });
    await supabase.auth.exchangeCodeForSession(code);
  }

  res.redirect('/dashboard');
}
