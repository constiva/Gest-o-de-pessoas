import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

const supabase = createClient(supabaseUrl, serviceRoleKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { email, password, name, phone, position, company_id } = req.body;

    const { data: userData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, phone },
    });

    if (authError || !userData.user) {
      return res.status(400).json({ error: authError?.message || 'Erro ao criar usuário' });
    }

    const userId = userData.user.id;

    const { data: companyUser, error: insertError } = await supabase
      .from('companies_users')
      .insert({ company_id, user_id: userId, name, email, phone, position })
      .select('user_id,name,email,phone,position')
      .single();

    if (insertError) {
      return res.status(400).json({ error: insertError.message });
    }

    return res.status(200).json({ user: companyUser });
  }

  if (req.method === 'PUT') {
    const { user_id, company_id, name, email, phone, position, password } = req.body;

    const updateAuthPayload: any = {
      email,
      user_metadata: { name, phone },
    };

    if (password) {
      updateAuthPayload.password = password;
    }

    const { error: updateAuthError } = await supabase.auth.admin.updateUserById(
      user_id,
      updateAuthPayload
    );

    if (updateAuthError) {
      return res.status(400).json({ error: updateAuthError.message });
    }

    const { data: updatedUser, error: updateError } = await supabase
      .from('companies_users')
      .update({ name, email, phone, position })
      .eq('company_id', company_id)
      .eq('user_id', user_id)
      .select('user_id,name,email,phone,position')
      .single();

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    return res.status(200).json({ user: updatedUser });
  }

  if (req.method === 'DELETE') {
    const { user_id, company_id } = req.body;

    const { error: deleteCompanyUserError } = await supabase
      .from('companies_users')
      .delete()
      .eq('company_id', company_id)
      .eq('user_id', user_id);

    if (deleteCompanyUserError) {
      return res.status(400).json({ error: deleteCompanyUserError.message });
    }

    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(user_id);

    if (deleteAuthError) {
      return res.status(400).json({ error: deleteAuthError.message });
    }

    return res.status(200).json({ success: true });
  }

  res.setHeader('Allow', ['POST', 'PUT', 'DELETE']);
  return res.status(405).end('Method Not Allowed');
}
