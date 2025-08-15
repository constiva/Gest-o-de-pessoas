import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import Layout from '../../components/Layout';
import { Button } from '../../components/ui/button';

// Util
function moneyBRL(cents?: number | null) {
  const v = Number(cents ?? 0) / 100;
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmt(dt?: string | null) {
  return dt ? new Date(dt).toLocaleString('pt-BR') : '—';
}

// Tipos (espelho do que a API retorna)
type Tx = {
  id: string;
  company_id: string;
  subscription_id: string;
  plan_id: string | null;
  efi_subscription_id: number | null;
  efi_charge_id: number | null;
  status: 'waiting' | 'paid' | 'failed';
  amount_cents: number;
  currency: 'BRL';
  created_at: string;
};

type Sub = {
  id: string;
  company_id: string;
  plan_id: string | null;
  status: string | null;
  started_at: string | null;
  canceled_at: string | null;
  updated_at: string | null;
  actual_plan: 'yes' | 'no' | null;
  efi_subscription_id: number | null;
  last_charge_id: number | null;
  plan?: { id: string; slug: string; name: string; price_cents: number | null } | null;
};

type CompanyRow = {
  id: string;
  name: string | null;
  plan: string | null;
  maxemployees: number | null;
  subscriptions: Sub[];
  transactions: Tx[];
};

type OverviewPayload = { companies: CompanyRow[] };

export default function CheckoutAdmin() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [data, setData] = useState<OverviewPayload | null>(null);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'overdue' | 'canceled'>('all');

  useEffect(() => {
    (async () => {
      // gate: precisa estar logado e ser admin
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }

      const { data: me } = await supabase
        .from('users')
        .select('id, is_admin')
        .eq('id', user.id)
        .maybeSingle();

      if (!me?.is_admin) { router.replace('/'); return; }
      setIsAdmin(true);

      // chama a overview com o access token
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;

      const res = await fetch('/api/admin/billing/overview', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const json: OverviewPayload = await res.json();
      setData(json);
      setLoading(false);
    })();
  }, [router]);

  const filtered = useMemo(() => {
    if (!data) return [] as CompanyRow[];
    const search = q.trim().toLowerCase();
    return data.companies
      .filter(c => {
        const hay = `${c.name ?? ''} ${c.id}`.toLowerCase();
        return !search || hay.includes(search);
      })
      .map(c => {
        if (statusFilter === 'all') return c;
        const subs = c.subscriptions.filter(s => {
          const st = (s.status || '').toLowerCase();
          if (statusFilter === 'active') return st === 'active';
          if (statusFilter === 'pending') return st === 'pending_payment' || st === 'waiting' || st === 'new';
          if (statusFilter === 'overdue') return st === 'overdue';
          if (statusFilter === 'canceled') return st === 'canceled';
          return true;
        });
        return { ...c, subscriptions: subs };
      });
  }, [data, q, statusFilter]);

  async function doAction(kind: 'refresh' | 'cancel' | 'mark_actual', payload: any) {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const res = await fetch('/api/admin/billing/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: kind, ...payload }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Falha na ação');
      // Recarrega overview após ações que mudam o estado
      if (kind !== 'refresh') {
        const res2 = await fetch('/api/admin/billing/overview', { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
        const json: OverviewPayload = await res2.json();
        setData(json);
      }
      alert('OK');
    } catch (e: any) {
      alert(e?.message || String(e));
    }
  }

  if (!isAdmin) return null;

  return (
    <Layout>
      <Head><title>Checkout Admin</title></Head>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Checkout Admin</h1>
          <p className="text-sm text-muted-foreground">Empresas, assinaturas e transações</p>
        </div>
        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por empresa ou ID…"
            className="h-10 rounded-md border px-3"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="h-10 rounded-md border px-3"
          >
            <option value="all">Todas</option>
            <option value="active">Ativas</option>
            <option value="pending">Pendentes</option>
            <option value="overdue">Em atraso</option>
            <option value="canceled">Canceladas</option>
          </select>
        </div>
      </div>

      {loading && (<div className="py-10 text-center text-muted-foreground">Carregando…</div>)}

      {!loading && filtered.length === 0 && (
        <div className="py-10 text-center text-muted-foreground">Nenhuma empresa encontrada.</div>
      )}

      <div className="space-y-6">
        {filtered.map((c) => {
          const current = c.subscriptions.find(s => s.actual_plan === 'yes');
          return (
            <div key={c.id} className="rounded-2xl border bg-white shadow-sm">
              <div className="flex items-center justify-between gap-4 border-b p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-lg font-semibold">{c.name || '—'}</h2>
                    <span className="truncate text-xs text-muted-foreground">({c.id})</span>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Plano atual (empresa): <span className="font-medium">{c.plan || 'free'}</span>
                    {typeof c.maxemployees === 'number' ? <span> • limite {c.maxemployees}</span> : null}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  {current?.efi_subscription_id ? (
                    <Button
                      variant="outline"
                      onClick={() => doAction('refresh', { efi_subscription_id: current.efi_subscription_id })}
                    >Re-sync Efí</Button>
                  ) : null}
                </div>
              </div>

              {/* Assinaturas */}
              <div className="p-4">
                <div className="mb-2 text-sm font-medium">Assinaturas</div>
                <div className="overflow-auto">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="px-2 py-1">Atual</th>
                        <th className="px-2 py-1">Status</th>
                        <th className="px-2 py-1">EFI Sub ID</th>
                        <th className="px-2 py-1">Plano</th>
                        <th className="px-2 py-1">Início</th>
                        <th className="px-2 py-1">Últ. Charge</th>
                        <th className="px-2 py-1">Atualizado</th>
                        <th className="px-2 py-1">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.subscriptions.map((s) => (
                        <tr key={s.id} className="border-t">
                          <td className="px-2 py-2">{s.actual_plan === 'yes' ? '✔️' : ''}</td>
                          <td className="px-2 py-2">{s.status || '—'}</td>
                          <td className="px-2 py-2">{s.efi_subscription_id ?? '—'}</td>
                          <td className="px-2 py-2">{s.plan?.slug || '—'}{s.plan?.price_cents ? ` (${moneyBRL(s.plan.price_cents)})` : ''}</td>
                          <td className="px-2 py-2">{fmt(s.started_at)}</td>
                          <td className="px-2 py-2">{s.last_charge_id ?? '—'}</td>
                          <td className="px-2 py-2">{fmt(s.updated_at)}</td>
                          <td className="px-2 py-2">
                            <div className="flex flex-wrap gap-2">
                              {s.efi_subscription_id ? (
                                <Button
                                  variant="outline"
                                  onClick={() => doAction('refresh', { efi_subscription_id: s.efi_subscription_id })}
                                >Re-sync</Button>
                              ) : null}
                              {s.efi_subscription_id && s.status !== 'canceled' ? (
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    if (confirm('Cancelar esta assinatura na Efí e marcar como cancelada localmente?')) {
                                      doAction('cancel', { subscription_id: s.id, efi_subscription_id: s.efi_subscription_id });
                                    }
                                  }}
                                >Cancelar</Button>
                              ) : null}
                              {s.actual_plan !== 'yes' ? (
                                <Button
                                  variant="outline"
                                  onClick={() => doAction('mark_actual', { subscription_id: s.id })}
                                >Tornar atual</Button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Transações */}
              <div className="border-t p-4">
                <div className="mb-2 text-sm font-medium">Transações (mais recentes)</div>
                <div className="overflow-auto">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="px-2 py-1">Criada em</th>
                        <th className="px-2 py-1">Sub</th>
                        <th className="px-2 py-1">EFI Charge</th>
                        <th className="px-2 py-1">Status</th>
                        <th className="px-2 py-1">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.transactions.map((t) => (
                        <tr key={t.id} className="border-t">
                          <td className="px-2 py-2">{fmt(t.created_at)}</td>
                          <td className="px-2 py-2">{t.subscription_id}</td>
                          <td className="px-2 py-2">{t.efi_charge_id ?? '—'}</td>
                          <td className="px-2 py-2">{t.status}</td>
                          <td className="px-2 py-2">{moneyBRL(t.amount_cents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Layout>
  );
}