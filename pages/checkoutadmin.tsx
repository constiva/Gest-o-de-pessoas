// pages/checkoutadmin.tsx
import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { supabase } from '../lib/supabaseClient';

type SubRow = {
  id: string;
  status: string | null;
  plan_id: string | number | null;
  efi_subscription_id?: number | null; // algumas migrações usam esse nome
  efibank_id?: number | null;          // outras usam esse
  created_at?: string | null;
  updated_at?: string | null;
  started_at?: string | null;
  canceled_at?: string | null;
  company_id?: string | null;
};

type PlanRow = {
  id: string;
  name?: string | null;
  slug?: string | null;
  efi_plan_id?: number | null;
  price_cents?: number | null;
  currency?: string | null;
  active?: boolean | null;
  interval_months?: number | null;
  features_json?: string[] | null;
  updated_at?: string | null;
};

type PWRow = {
  id: string;
  provider?: string | null;
  received_at?: string | null;
  event_type?: string | null;
  ip?: string | null;
  body?: any;
  headers?: any;
};

const fmt = (s?: string | null) =>
  s ? new Date(s).toLocaleString('pt-BR') : '—';

const currencyBRL = (n?: number | null) =>
  typeof n === 'number'
    ? (n / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : '—';

export default function CheckoutAdmin() {
  // ====== Token do webhook (guardado no localStorage para não expor em env público)
  const [token, setToken] = useState('');
  useEffect(() => {
    const t = localStorage.getItem('efiWebhookToken');
    if (t) setToken(t);
  }, []);
  function saveToken() {
    localStorage.setItem('efiWebhookToken', token.trim());
    alert('Token salvo no navegador.');
  }

  // ====== Endpoint calculado
  const base =
    typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_WEBHOOK_BASE_URL || '';
  const webhookEndpoint = `${base}/api/efi/webhook`;

  // ====== Log bruto do arquivo (GET ?dump=1)
  const [logText, setLogText] = useState<string>('(clique em “Ler log”)');
  const [busyLog, setBusyLog] = useState(false);

  async function readLog() {
    if (!token) return alert('Informe o token (mesmo token configurado na Efí).');
    setBusyLog(true);
    try {
      const url = `${webhookEndpoint}?dump=1&t=${encodeURIComponent(token)}`;
      const res = await fetch(url);
      const txt = await res.text();
      setLogText(txt || '(vazio)');
    } catch (e: any) {
      setLogText(`(erro ao ler log: ${e?.message || e})`);
    } finally {
      setBusyLog(false);
    }
  }

  async function clearLog() {
    if (!token) return alert('Informe o token.');
    if (!confirm('Limpar o arquivo de log do webhook?')) return;
    setBusyLog(true);
    try {
      const url = `${webhookEndpoint}?clear=1&t=${encodeURIComponent(token)}`;
      await fetch(url);
      setLogText('(vazio)');
    } finally {
      setBusyLog(false);
    }
  }

  async function postTest() {
    if (!token) return alert('Informe o token.');
    const payload = {
      subscription_id: 123,
      status: 'paid',
      note: 'teste-manual-painel',
    };
    const res = await fetch(`${webhookEndpoint}?t=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const txt = await res.text();
    alert(`HTTP ${res.status}\n${txt}`);
    // Depois do POST, tente ler o log novamente
    readLog();
    // E recarregar a grade de webhooks
    loadWebhookRows();
  }

  // ====== Supabase: listas
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [webhooks, setWebhooks] = useState<PWRow[]>([]);
  const [loadingDB, setLoadingDB] = useState(false);

  async function loadSubs() {
    const { data } = await supabase
      .from('subscriptions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setSubs((data as any) || []);
  }
  async function loadPlans() {
    const { data } = await supabase
      .from('plans')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(50);
    setPlans((data as any) || []);
  }
  async function loadWebhookRows() {
    // se a tabela existir
    const { data, error } = await supabase
      .from('payment_webhook')
      .select('*')
      .order('received_at', { ascending: false })
      .limit(100);
    if (!error) setWebhooks((data as any) || []);
  }

  async function loadAllDB() {
    setLoadingDB(true);
    try {
      await Promise.all([loadSubs(), loadPlans(), loadWebhookRows()]);
    } finally {
      setLoadingDB(false);
    }
  }

  useEffect(() => {
    // exige sessão para listar (seu Layout/guard já pode redirecionar)
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return; // Layout deve redirecionar
      loadAllDB();
    })();
  }, []);

  const computedNotificationURL = useMemo(() => {
    const tLabel = token ? token : '<SEU_TOKEN_AQUI>';
    return `${webhookEndpoint}?t=${tLabel}`;
  }, [webhookEndpoint, token]);

  return (
    <Layout>
      <Head><title>Checkout — Admin</title></Head>

      <div className="mb-6">
        <h1 className="text-2xl font-bold">Checkout Admin</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe logs do webhook e dados de planos/assinaturas.
        </p>
      </div>

      {/* Resumo / Config */}
      <section className="rounded-2xl border p-6 bg-white shadow-sm mb-8">
        <h2 className="text-lg font-semibold mb-3">Configuração do Webhook</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-sm text-muted-foreground mb-1">Endpoint</div>
            <div className="font-mono text-sm break-all p-2 rounded border bg-gray-50">
              {webhookEndpoint}
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">URL para configurar na Efí</div>
            <div className="font-mono text-sm break-all p-2 rounded border bg-gray-50">
              {computedNotificationURL}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Token do webhook</label>
            <input
              className="rounded-md border px-3 py-2 w-80"
              placeholder="cole o token aqui"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </div>
          <Button onClick={saveToken} className="h-10">Salvar token</Button>
          <Button variant="outline" onClick={() => navigator.clipboard.writeText(computedNotificationURL)}>
            Copiar URL com token
          </Button>
        </div>
      </section>

      {/* Log do arquivo */}
      <section className="rounded-2xl border p-6 bg-white shadow-sm mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Log de Webhook (arquivo)</h2>
          <div className="flex gap-2">
            <Button variant="outline" onClick={readLog} disabled={busyLog}>Ler log</Button>
            <Button variant="outline" onClick={clearLog} disabled={busyLog}>Limpar</Button>
            <Button onClick={postTest} disabled={!token}>POST de teste</Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-2">
          Em produção este arquivo mora em <code>/tmp/webhook.txt</code> (volátil).
        </p>
        <textarea
          className="w-full h-64 font-mono text-xs rounded-md border p-3 bg-gray-50"
          readOnly
          value={logText}
        />
      </section>

      {/* Painéis DB */}
      <section className="grid gap-8 md:grid-cols-2">
        <div className="rounded-2xl border p-6 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Assinaturas (últimas 50)</h2>
            <Button variant="outline" onClick={loadSubs} disabled={loadingDB}>Recarregar</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-3">ID</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Plan</th>
                  <th className="py-2 pr-3">EFI sub</th>
                  <th className="py-2 pr-3">Criada</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => {
                  const efiSubId = s.efi_subscription_id ?? s.efibank_id ?? '—';
                  return (
                    <tr key={s.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-mono">{s.id}</td>
                      <td className="py-2 pr-3">{s.status || '—'}</td>
                      <td className="py-2 pr-3">{String(s.plan_id ?? '—')}</td>
                      <td className="py-2 pr-3">{String(efiSubId)}</td>
                      <td className="py-2 pr-3">{fmt(s.created_at)}</td>
                    </tr>
                  );
                })}
                {subs.length === 0 && (
                  <tr><td className="py-4 text-muted-foreground" colSpan={5}>Sem registros.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border p-6 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Planos (últimos 50)</h2>
            <Button variant="outline" onClick={loadPlans} disabled={loadingDB}>Recarregar</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-3">ID</th>
                  <th className="py-2 pr-3">Nome</th>
                  <th className="py-2 pr-3">Slug</th>
                  <th className="py-2 pr-3">EFI plan</th>
                  <th className="py-2 pr-3">Preço</th>
                  <th className="py-2 pr-3">Ativo</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-mono">{p.id}</td>
                    <td className="py-2 pr-3">{p.name || '—'}</td>
                    <td className="py-2 pr-3">{p.slug || '—'}</td>
                    <td className="py-2 pr-3">{p.efi_plan_id ?? '—'}</td>
                    <td className="py-2 pr-3">{currencyBRL(p.price_cents)}</td>
                    <td className="py-2 pr-3">{String(p.active ?? false)}</td>
                  </tr>
                ))}
                {plans.length === 0 && (
                  <tr><td className="py-4 text-muted-foreground" colSpan={6}>Sem registros.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border p-6 bg-white shadow-sm mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">payment_webhook (últimos 100)</h2>
          <Button variant="outline" onClick={loadWebhookRows} disabled={loadingDB}>Recarregar</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-3">ID</th>
                <th className="py-2 pr-3">Quando</th>
                <th className="py-2 pr-3">Provider</th>
                <th className="py-2 pr-3">Evento</th>
                <th className="py-2 pr-3">IP</th>
              </tr>
            </thead>
            <tbody>
              {webhooks.map((w) => (
                <tr key={w.id} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-mono">{w.id}</td>
                  <td className="py-2 pr-3">{fmt(w.received_at)}</td>
                  <td className="py-2 pr-3">{w.provider || '—'}</td>
                  <td className="py-2 pr-3">{w.event_type || '—'}</td>
                  <td className="py-2 pr-3">{w.ip || '—'}</td>
                </tr>
              ))}
              {webhooks.length === 0 && (
                <tr><td className="py-4 text-muted-foreground" colSpan={5}>Sem registros.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Dica: no seu handler de webhook, sempre insira uma linha em <code>payment_webhook</code> com o corpo/headers recebidos — isso garante histórico persistente.
        </p>
      </section>
    </Layout>
  );
}
