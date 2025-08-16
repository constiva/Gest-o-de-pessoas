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
  errors: Record<string, any>;
  trace?: any[];
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
      const token = session?.access_token;
      if (!token) {
        setLoadingDebug(false);
        return;
      }
      const res = await fetch('/api/admin/debug', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setDebug(json);
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
              {Object.keys(debug.errors).length > 0 && (
                <div>
                  <h2 className="font-semibold">Erros</h2>
                  <pre className="bg-gray-100 p-2 text-xs overflow-x-auto">
                    {JSON.stringify(debug.errors, null, 2)}
                  </pre>
                </div>
              )}
              {debug.trace && (
                <div>
                  <h2 className="font-semibold">Trace</h2>
                  <pre className="bg-gray-100 p-2 text-xs overflow-x-auto">
                    {JSON.stringify(debug.trace, null, 2)}
                  </pre>
                </div>
              )}
            </>
          )}
          {!loadingDebug && !debug && <p>Empresa não encontrada</p>}
        </div>
      )}
    </div>
  );
}

