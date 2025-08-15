import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

const MODULES = ['employees', 'metrics', 'reports'] as const;

interface Plan {
  id: string;
  name: string;
  features_json: string[] | null;
}

export default function PlansAdmin() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        setError('unauthenticated');
        setLoading(false);
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
      else setError(json.error || 'Erro ao carregar');
      setLoading(false);
    }
    load();
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
      body: JSON.stringify({ action: 'plans_update', id: plan.id, patch: { features_json: plan.features_json } }),
    });
  }

  if (loading) return <p className="p-6">Carregando...</p>;
  if (error) return <p className="p-6 text-red-500">{error}</p>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Planos</h1>
      {plans.map((plan) => (
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
  );
}

