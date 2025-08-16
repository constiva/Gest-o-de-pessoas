import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const VALID_ALLOWED = ['name', 'email', 'phone', 'position', 'salary', 'cpf'] as const;

function normalizeAllowedFields(input: unknown): string[] {
  if (Array.isArray(input)) return Array.from(new Set(input.map(String)));
  if (typeof input === 'string') return [input];
  return [];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  switch (req.method) {
    case 'POST': {
      const { name, email, password, phone, position, company_id, scopes, allowed_fields } = req.body;
      if (!name || !email || !password || !company_id)
        return res.status(400).json({ error: 'Missing fields' });

      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        phone: phone || undefined,
        email_confirm: true,
      });
      if (error || !data.user)
        return res.status(400).json({ error: error?.message });

      const rawAllowed = normalizeAllowedFields(allowed_fields);
      const sanitizedAllowed = rawAllowed.filter((f) =>
        VALID_ALLOWED.includes(f as any)
      );

      const { error: linkError } = await supabaseAdmin
        .from('companies_users')
        .insert({
          company_id,
          user_id: data.user.id,
          name,
          email,
          phone: phone || null,
          position,
          scopes: scopes || {},
          allowed_fields: sanitizedAllowed,
        });
      if (linkError)
        return res.status(400).json({ error: linkError.message });

      return res.status(200).json({ user_id: data.user.id, allowed_fields: sanitizedAllowed });
    }

    case 'GET': {
      const { company_id } = req.query;
      const { data, error } = await supabaseAdmin
        .from('companies_users')
        .select('user_id, name, email, phone, position, scopes, allowed_fields')
        .eq('company_id', company_id as string);
      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json(data);
    }

    case 'PUT': {
      const { user_id, name, email, phone, position, password, scopes, allowed_fields, company_id } = req.body;
      const rawAllowed = normalizeAllowedFields(allowed_fields);
      const sanitizedAllowed = rawAllowed.filter((f) =>
        VALID_ALLOWED.includes(f as any)
      );
      if (process.env.NODE_ENV !== 'production') {
        console.log('[PUT /company-users] payload.allowed_fields (raw):', allowed_fields);
        console.log('[PUT /company-users] payload.allowed_fields (sanitized):', sanitizedAllowed);
      }
      const authUpdates: { email?: string; password?: string; phone?: string } = {};
      if (email) authUpdates.email = email;
      if (password) authUpdates.password = password;
      if (phone) authUpdates.phone = phone;

      if (Object.keys(authUpdates).length) {
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
          user_id,
          authUpdates
        );
        if (authError) return res.status(400).json({ error: authError.message });
      }

      const rowUpdates: {
        name?: string;
        email?: string;
        phone?: string | null;
        position?: string | null;
        scopes?: any;
        allowed_fields?: any;
      } = {};
      if (name) rowUpdates.name = name;
      if (email) rowUpdates.email = email;
      if (phone) rowUpdates.phone = phone;
      if (position) rowUpdates.position = position;
      if (scopes !== undefined) rowUpdates.scopes = scopes;
      if (allowed_fields !== undefined) rowUpdates.allowed_fields = sanitizedAllowed;

      if (Object.keys(rowUpdates).length) {
        const { data, error: linkError } = await supabaseAdmin
          .from('companies_users')
          .update(rowUpdates)
          .eq('user_id', user_id)
          .eq('company_id', company_id)
          .select('user_id, company_id, allowed_fields')
          .single();
        if (linkError) return res.status(400).json({ error: linkError.message });
        return res.status(200).json({ ok: true, data });
      }

      return res.status(200).json({ ok: true, data: { user_id, company_id, allowed_fields: sanitizedAllowed } });
    }

    case 'DELETE': {
      const { id, company_id } = req.query;
      await supabaseAdmin
        .from('companies_users')
        .delete()
        .eq('company_id', company_id as string)
        .eq('user_id', id as string);
      await supabaseAdmin.auth.admin.deleteUser(id as string);

      return res.status(200).json({ ok: true });
    }

    default:
      return res.status(405).end();
  }
}
