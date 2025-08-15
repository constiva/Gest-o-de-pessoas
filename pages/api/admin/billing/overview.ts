import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function requireAdmin(req: NextApiRequest) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  const { data: me } = await supabaseAdmin.from('users').select('id, is_admin').eq('id', data.user.id).maybeSingle();
  if (!me?.is_admin) return null;
  return data.user;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAdmin(req);
  if (!user) return res.status(401).json({ error: 'unauthorized' });

  // Carrega empresas
  const { data: companies, error: cErr } = await supabaseAdmin
    .from('companies')
    .select('id, name, plan, maxemployees')
    .order('name', { ascending: true });
  if (cErr) return res.status(500).json({ error: cErr.message });

  // Assinaturas de todas as empresas
  const { data: subs, error: sErr } = await supabaseAdmin
    .from('subscriptions')
    .select('id, company_id, plan_id, status, started_at, canceled_at, updated_at, actual_plan, efi_subscription_id, last_charge_id')
    .order('updated_at', { ascending: false });
  if (sErr) return res.status(500).json({ error: sErr.message });

  // Planos para mapear slug/nome/valor
  const { data: plans } = await supabaseAdmin
    .from('plans')
    .select('id, slug, name, price_cents');

  const planMap = new Map<string, any>();
  (plans || []).forEach(p => planMap.set(p.id, p));

  const subsByCompany = new Map<string, any[]>();
  (subs || []).forEach(s => {
    const arr = subsByCompany.get(s.company_id) || [];
    arr.push({ ...s, plan: s.plan_id ? planMap.get(s.plan_id) || null : null });
    subsByCompany.set(s.company_id, arr);
  });

  // Transações: pegamos as mais recentes por empresa (ex.: últimas 50 no total)
  const { data: txs, error: tErr } = await supabaseAdmin
    .from('transactions')
    .select('id, company_id, subscription_id, plan_id, efi_subscription_id, efi_charge_id, status, amount_cents, currency, created_at')
    .order('created_at', { ascending: false })
    .limit(500);
  if (tErr) return res.status(500).json({ error: tErr.message });

  const txsByCompany = new Map<string, any[]>();
  (txs || []).forEach(t => {
    const arr = txsByCompany.get(t.company_id) || [];
    arr.push(t);
    txsByCompany.set(t.company_id, arr);
  });

  const payload = {
    companies: (companies || []).map(c => ({
      id: c.id,
      name: c.name,
      plan: c.plan,
      maxemployees: c.maxemployees,
      subscriptions: subsByCompany.get(c.id) || [],
      transactions: (txsByCompany.get(c.id) || []).slice(0, 50),
    })),
  };

  return res.status(200).json(payload);
}