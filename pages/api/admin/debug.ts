import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const MODULES = ['employees', 'metrics', 'reports'] as const;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') return res.status(405).end();

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'missing token' });

  const { data: user, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !user?.user)
    return res.status(401).json({ error: userErr?.message || 'invalid token' });
  const userId = user.user.id;

  const debug: any = { errors: {}, trace: [] as any[] };
  let companyId: string | null = null;

  const { data: cu, error: cuErr } = await supabaseAdmin
    .from('companies_users')
    .select('company_id,scopes,allowed_fields')
    .eq('user_id', userId)
    .single();
  debug.trace.push({ step: 'companies_users', data: cu, error: cuErr?.message });
  if (cuErr) debug.errors.companies_users = cuErr.message;
  if (cu) {
    companyId = cu.company_id;
    debug.user_scopes = cu.scopes;
    debug.allowed_fields = cu.allowed_fields;
  }

  if (!companyId) {
    const { data: u, error: uErr } = await supabaseAdmin
      .from('users')
      .select('company_id')
      .eq('id', userId)
      .single();
    debug.trace.push({ step: 'users', data: u, error: uErr?.message });
    if (uErr) debug.errors.users = uErr.message;
    companyId = u?.company_id || null;
  }

  if (!companyId) {
    debug.companyId = 'N/A';
    return res.status(200).json(debug);
  }
  debug.companyId = companyId;

  const { data: company, error: compErr } = await supabaseAdmin
    .from('companies')
    .select('plan,plan_id,plan_overrides')
    .eq('id', companyId)
    .single();
  debug.trace.push({ step: 'company', data: company, error: compErr?.message });
  if (compErr) debug.errors.company = compErr.message;

  let plan: any = null;
  if (company?.plan_id) {
    const { data: p, error: pErr } = await supabaseAdmin
      .from('plans')
      .select('id,name,features_json')
      .eq('id', company.plan_id)
      .single();
    debug.trace.push({ step: 'plan_by_id', data: p, error: pErr?.message });
    if (pErr) debug.errors.plan = pErr.message;
    plan = p;
  } else if (company?.plan) {
    const { data: p, error: pErr } = await supabaseAdmin
      .from('plans')
      .select('id,name,features_json')
      .eq('name', company.plan)
      .single();
    debug.trace.push({ step: 'plan_by_name', data: p, error: pErr?.message });
    if (pErr) debug.errors.plan = pErr.message;
    plan = p;
  }

  debug.plan = plan?.name || company?.plan || null;
  debug.plan_id = plan?.id || company?.plan_id || null;
  debug.plan_features = plan?.features_json || null;
  debug.plan_overrides = company?.plan_overrides || null;

  const { data: eff, error: effErr } = await supabaseAdmin.rpc(
    'app_effective_features',
    { company: companyId }
  );
  debug.trace.push({ step: 'effective_features', data: eff, error: effErr?.message });
  if (effErr) debug.errors.effective_features = effErr.message;
  debug.effective_features = eff;

  const modules: Record<string, boolean> = {};
  const moduleErrors: Record<string, any> = {};
  for (const m of MODULES) {
    const { data, error: modErr } = await supabaseAdmin.rpc(
      'app_feature_enabled',
      { company: companyId, module: m }
    );
    modules[m] = !!data;
    debug.trace.push({ step: `module_${m}`, data, error: modErr?.message });
    if (modErr) moduleErrors[m] = modErr.message;
  }
  if (Object.keys(moduleErrors).length) debug.errors.modules = moduleErrors;
  debug.modules = modules;

  return res.status(200).json(debug);
}
