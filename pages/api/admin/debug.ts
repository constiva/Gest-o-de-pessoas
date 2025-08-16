import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const MODULES = ['employees', 'metrics', 'reports'] as const;

function processEffectiveFeatures(plan: any, company: any) {
  const effective: Record<string, boolean> = {};
  if (Array.isArray(plan?.features_json)) {
    for (const f of plan.features_json) {
      if (MODULES.includes(f as any)) effective[f] = true;
    }
  }
  if (company?.plan_overrides) Object.assign(effective, company.plan_overrides);
  return effective;
}

async function getCompanyDebugSafe(supabase: SupabaseClient, companyId: string) {
  const trace: any[] = [];
  const errors: Record<string, string> = {};

  const { data: company, error: companyErr } = await supabase
    .from('companies')
    .select('id,name,plan_id,plan_overrides')
    .eq('id', companyId)
    .single();
  trace.push({ step: 'company', data: company, error: companyErr?.message });
  if (companyErr) errors.company = companyErr.message;

  const { data: admin, error: adminErr } = await supabase
    .from('users')
    .select('id,email,name')
    .eq('company_id', companyId)
    .maybeSingle();
  trace.push({ step: 'users', data: admin, error: adminErr?.message });
  if (adminErr) errors.users = adminErr.message;

  const { data: employees, error: empErr } = await supabase
    .from('companies_users')
    .select('user_id,name,email,role,scopes,allowed_fields')
    .eq('company_id', companyId);
  trace.push({ step: 'companies_users', data: employees, error: empErr?.message });
  if (empErr) errors.companies_users = empErr.message;

  let plan = null;
  if (company?.plan_id) {
    const { data: p, error: pErr } = await supabase
      .from('plans')
      .select('id,name,features_json')
      .eq('id', company.plan_id)
      .maybeSingle();
    trace.push({ step: 'plan_by_id', data: p, error: pErr?.message });
    if (pErr) errors.plan = pErr.message;
    plan = p;
  }

  return { company, admin, employees: employees || [], plan, trace, errors };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'missing token' });

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: user, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !user?.user) return res.status(401).json({ error: userErr?.message || 'invalid token' });
  const userId = user.user.id;

  await supabaseAdmin.rpc('debug_set_user_context', { user_uuid: userId });

  const { data: cu } = await supabaseAdmin
    .from('companies_users')
    .select('company_id')
    .eq('user_id', userId);
  let companyId: string | null = cu?.[0]?.company_id || null;
  if (!companyId) {
    const { data: u } = await supabaseAdmin
      .from('users')
      .select('company_id')
      .eq('id', userId)
      .maybeSingle();
    companyId = u?.company_id || null;
  }
  if (!companyId) return res.status(200).json({ companyId: null });

  const safe = await getCompanyDebugSafe(supabaseAdmin, companyId);
  if ((safe as any).error) return res.status(500).json(safe);

  const effectiveFeatures = processEffectiveFeatures(safe.plan, safe.company);
  const modules = {
    employees: effectiveFeatures.employees || false,
    metrics: effectiveFeatures.metrics || false,
    reports: effectiveFeatures.reports || false,
  };
  const userScopes = safe.employees[0]?.scopes || {};
  const allowedFields = safe.employees[0]?.allowed_fields || [];

  return res.status(200).json({
    company: {
      id: safe.company?.id,
      name: safe.company?.name,
      plan: safe.plan?.name || 'N/A',
    },
    effective_features: effectiveFeatures,
    modules,
    user_scopes: userScopes,
    allowed_fields: allowedFields,
    trace: safe.trace,
    errors: safe.errors,
  });
}
