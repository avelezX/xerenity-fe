import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { code } = req.query;

  if (typeof code === 'string') {
    const supabase = createPagesServerClient({ req, res });
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      // eslint-disable-next-line no-console
      console.error('OAuth callback error:', error.message);
      const msg = encodeURIComponent(error.message);
      res.redirect(`/login?error=${msg}`);
      return;
    }
  } else {
    res.redirect('/login?error=missing_code');
    return;
  }

  res.redirect('/suameca');
}
