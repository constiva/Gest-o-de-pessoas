import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

const MODULES = ['employees', 'metrics', 'reports'] as const;

interface Plan {
  id: string;
  name: string;
  features_json: string[] | null;
}

interface DebugInfo {
  companyId: string;
  plan: string | null;
  plan_id: string | null;
  plan_features: any;
  plan_overrides: any;
  effective_features: any;
  user_scopes: any;
  allowed_fields: any;
  modules: Record<string, boolean>;
}

export default function AdminPage() {
  const [tab, setTab] = useState<'plans' | 'debug'>('plans');

  // Plan management state
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [planError, setPlanError] = useState<string | null>(null);

  // Debug state
  const [debug, setDebug] = useState<DebugInfo | null>(null);
  const [loadingDebug, setLoadingDebug] = useState(true);

  useEffect(() => {
    async function loadPlans() {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        setPlanError('unauthenticated');
        setLoadingPlans(false);
        return;
      }
      const res = await fetch('/api/admin/billing/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'plans_list' }),
      });
      const json = await res.json();
      if (json.ok) setPlans(json.plans as Plan[]);
      else setPlanError(json.error || 'Erro ao carregar');
      setLoadingPlans(false);
    }
    loadPlans();
  }, []);

  function toggle(planId: string, feature: string) {
    setPlans((prev) =>
      prev.map((p) => {
        if (p.id !== planId) return p;
        const arr = Array.isArray(p.features_json) ? [...p.features_json] : [];
        const idx = arr.indexOf(feature);
        if (idx >= 0) arr.splice(idx, 1);
        else arr.push(feature);
        return { ...p, features_json: arr };
      })
    );
  }

  async function save(plan: Plan) {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) return;
    await fetch('/api/admin/billing/action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: 'plans_update',
        id: plan.id,
        patch: { features_json: plan.features_json },
      }),
    });
  }

  useEffect(() => {
    async function loadDebug() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) {
        setLoadingDebug(false);
        return;
      }
      let companyId: string | null = null;
      let userScopes: any = null;
      let allowed: any = null;
      const { data: cu } = await supabase
        .from('companies_users')
        .select('company_id,scopes,allowed_fields')
        .eq('user_id', userId)
        .single();
      if (cu) {
        companyId = cu.company_id;
        userScopes = cu.scopes;
        allowed = cu.allowed_fields;
      } else {
        const { data: u } = await supabase
          .from('users')
          .select('company_id')
          .eq('id', userId)
          .single();
        if (u) companyId = u.company_id;
      }

      if (!companyId) {
        setDebug(null);
        setLoadingDebug(false);
        return;
      }

      const { data: company } = await supabase
        .from('companies')
        .select('id,plan,plan_id,plan_overrides')
        .eq('id', companyId)
        .single();

      let plan: any = null;
      if (company?.plan_id) {
        const { data: p } = await supabase
          .from('plans')
          .select('name,features_json')
          .eq('id', company.plan_id)
          .single();
        plan = p;
      } else if (company?.plan) {
        const { data: p } = await supabase
          .from('plans')
          .select('id,features_json')
          .eq('name', company.plan)
          .single();
        plan = p;
      }

      const { data: eff } = await supabase.rpc('app_effective_features', {
        company: companyId,
      });

      const modules: Record<string, boolean> = {};
      for (const m of MODULES) {
        const { data } = await supabase.rpc('app_feature_enabled', {
          company: companyId,
          module: m,
        });
        modules[m] = !!data;
      }

      setDebug({
        companyId,
        plan: company?.plan || null,
        plan_id: company?.plan_id || null,
        plan_features: plan?.features_json || null,
        plan_overrides: company?.plan_overrides || null,
        effective_features: eff,
        user_scopes: userScopes,
        allowed_fields: allowed,
        modules,
      });
      setLoadingDebug(false);
    }
    loadDebug();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Administração</h1>
      <div className="flex gap-4 border-b mb-4">
        <button
          onClick={() => setTab('plans')}
          className={`pb-2 ${
            tab === 'plans'
              ? 'border-b-2 border-brand font-medium'
              : 'text-gray-500'
          }`}
        >
          Planos
        </button>
        <button
          onClick={() => setTab('debug')}
          className={`pb-2 ${
            tab === 'debug'
              ? 'border-b-2 border-brand font-medium'
              : 'text-gray-500'
          }`}
        >
          Debug
        </button>
      </div>

      {tab === 'plans' && (
        <div className="space-y-6">
          {loadingPlans && <p>Carregando...</p>}
          {planError && <p className="text-red-500">{planError}</p>}
          {!loadingPlans && !planError &&
            plans.map((plan) => (
              <div key={plan.id} className="border rounded-md p-4 space-y-2">
                <h2 className="font-semibold">{plan.name}</h2>
                <div className="flex gap-4 flex-wrap">
                  {MODULES.map((m) => (
                    <label key={m} className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={plan.features_json?.includes(m) ?? false}
                        onChange={() => toggle(plan.id, m)}
                      />
                      {m}
                    </label>
                  ))}
                </div>
                <button
                  onClick={() => save(plan)}
                  className="px-3 py-1 bg-brand text-white rounded-md"
                >
                  Salvar
                </button>
              </div>
            ))}
        </div>
      )}

      {tab === 'debug' && (
        <div className="space-y-4">
          {loadingDebug && <p>Carregando...</p>}
          {!loadingDebug && debug && (
            <>
              <div>
                <h2 className="font-semibold">Empresa</h2>
                <p>ID: {debug.companyId}</p>
                <p>Plano: {debug.plan || 'N/A'}</p>
              </div>
              <div>
                <h2 className="font-semibold">Módulos</h2>
                <ul className="list-disc pl-5">
                  {MODULES.map((m) => (
                    <li key={m}>
                      {m}: {debug.modules[m] ? 'habilitado' : 'bloqueado'}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h2 className="font-semibold">Features efetivas</h2>
                <pre className="bg-gray-100 p-2 text-xs overflow-x-auto">
                  {JSON.stringify(debug.effective_features, null, 2)}
                </pre>
              </div>
              <div>
                <h2 className="font-semibold">Scopes do usuário</h2>
                <pre className="bg-gray-100 p-2 text-xs overflow-x-auto">
                  {JSON.stringify(debug.user_scopes, null, 2)}
                </pre>
              </div>
              <div>
                <h2 className="font-semibold">Allowed fields</h2>
                <pre className="bg-gray-100 p-2 text-xs overflow-x-auto">
                  {JSON.stringify(debug.allowed_fields, null, 2)}
                </pre>
              </div>
            </>
          )}
          {!loadingDebug && !debug && <p>Empresa não encontrada</p>}
        </div>
      )}
    </div>
  );
}

