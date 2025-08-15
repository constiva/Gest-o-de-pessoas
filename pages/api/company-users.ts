import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'POST') {
    const { email, password, phone, company_id } = req.body;
    if (!email || !password || !company_id)
      return res.status(400).json({ error: 'Missing fields' });
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      phone: phone || undefined,
      email_confirm: true,
    });
    if (error || !data.user) return res.status(400).json({ error: error?.message });
    const { error: linkError } = await supabaseAdmin
      .from('companies_users')
      .insert({ company_id, user_id: data.user.id });
    if (linkError) return res.status(400).json({ error: linkError.message });
    return res.status(200).json({ user_id: data.user.id });
  }

  if (req.method === 'GET') {
    const { company_id } = req.query;
    const { data, error } = await supabaseAdmin
      .from('companies_users')
      .select('*')
      .eq('company_id', company_id as string);
    if (error) return res.status(400).json({ error: error.message });
    const users = await Promise.all(
      data.map(async (u) => {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(
          u.user_id
        );
        return {
          ...u,
          email: userData?.user?.email,
          phone: (userData?.user as any)?.phone || null,
        };
      })
    );
    return res.status(200).json(users);
  }

  if (req.method === 'PUT') {
    const { user_id, password, phone } = req.body;
    const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      password,
      phone: phone || undefined,
    });
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const { id, company_id } = req.query;
    await supabaseAdmin
      .from('companies_users')
      .delete()
      .eq('company_id', company_id as string)
      .eq('user_id', id as string);
    await supabaseAdmin.auth.admin.deleteUser(id as string);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
