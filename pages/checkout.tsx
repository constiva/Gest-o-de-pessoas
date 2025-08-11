import { useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { supabase } from '../lib/supabaseClient';
import Script from 'next/script';

// Helper para acessar o global sem brigar com os tipos
const getEfi = () =>
  (typeof window !== 'undefined' ? (window as any).EfiPay : undefined);

type Plan = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_cents: number;
  interval_months: number;
  trial_days: number;
  max_employees: number;
  efi_plan_id: number | null;
  active: boolean;
  features_json: string[] | null;
};
type Profile = { id: string; name: string; email: string; company_id: string };

//declare global { interface Window { EfiPay?: any } }

// ======= ENV / CONSTS =======
const RAW_ENV_ACCOUNT_ID =
  (process.env.NEXT_PUBLIC_EFIBANK_ACCOUNT_ID || process.env.NEXT_PUBLIC_EFI_ACCOUNT_ID || '').trim();
const EFI_ENV = (process.env.NEXT_PUBLIC_EFI_ENV || 'sandbox') as 'sandbox' | 'production';
const SDK_URL = '/efi/payment-token-efi-umd.min.js';
const API_SUBSCRIBE = '/api/efi/subscribe';

// ======= HELPERS =======
function formatBRL(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function mask(s?: string, keep = 3) {
  if (!s) return '(vazio)';
  const str = String(s);
  return str.length <= keep * 2 ? str : `${str.slice(0, keep)}…${str.slice(-keep)}`;
}
function maskAccountId(id?: string) {
  if (!id) return '(vazio)';
  if (id.length <= 6) return id;
  return `${id.slice(0, 3)}…${id.slice(-3)}`;
}
function detectBrand(num: string): string | null {
  const n = num.replace(/\D/g, '');
  if (/^4/.test(n)) return 'visa';
  if (/^5[1-5]/.test(n)) return 'mastercard';
  if (/^3[47]/.test(n)) return 'amex';
  if (/^(636368|438935|504175|451416|636297|5067|4576|4011)/.test(n)) return 'elo';
  if (/^(606282|3841)/.test(n)) return 'hipercard';
  return null;
}
function sanitizeCustomId(input: string) {
  return input.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 64);
}

export default function Checkout() {
  const router = useRouter();
  const { planId, companyId, debug, accountId: qsAccountId } = router.query as any;

  // efetivo (env ou ?accountId=)
  const ACCOUNT_ID = useMemo(() => {
    const fromQS = typeof qsAccountId === 'string' ? qsAccountId.trim() : '';
    return RAW_ENV_ACCOUNT_ID || fromQS;
  }, [qsAccountId]);

  // ======= UI / DATA =======
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ======= SDK diagnostics =======
  const [scriptHTTP, setScriptHTTP] = useState<'pending'|'ok'|'fail'>('pending');
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [hasEfiPay, setHasEfiPay] = useState(false);
  const [hasCreditCard, setHasCreditCard] = useState(false);
  const [fingerBlocked, setFingerBlocked] = useState<boolean | null>(null);

  // JSONP proxy debug (dev)
  const [lastJsonpUrl, setLastJsonpUrl] = useState<string | null>(null);
  const [lastProxiedUrl, setLastProxiedUrl] = useState<string | null>(null);

  // ======= form fields =======
  const [holderName, setHolderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expMonth, setExpMonth] = useState('');
  const [expYear, setExpYear] = useState('');
  const [cvv, setCvv] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [birth, setBirth] = useState('');
  const [phone, setPhone] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [zipcode, setZipcode] = useState('');
  const [city, setCity] = useState('');
  const [stateUF, setStateUF] = useState('');
  const cardBrandRef = useRef<string | null>(null);

  // ======= DATA LOAD: session + plan =======
  useEffect(() => {
    (async () => {
      if (!router.isReady) return;
      if (!planId || !companyId) {
        setError('Parâmetros inválidos. Volte e selecione um plano novamente.');
        setLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }

      const { data: u, error: uerr } = await supabase
        .from('users')
        .select('id,name,email,company_id')
        .eq('id', user.id)
        .single();

      if (uerr || !u) { setError('Não foi possível carregar seu perfil.'); setLoading(false); return; }
      if (u.company_id !== companyId) { setError('Você não pertence a esta empresa.'); setLoading(false); return; }
      setProfile(u as Profile);
      setEmail(u.email || '');

      const { data: p, error: perr } = await supabase
        .from('plans')
        .select('id,name,slug,description,price_cents,interval_months,trial_days,max_employees,efi_plan_id,active,features_json')
        .eq('id', planId)
        .eq('active', true)
        .single();

      if (perr || !p) { setError('Plano inválido ou inativo.'); setLoading(false); return; }
      setPlan(p as Plan);
      if (u.name && !holderName) setHolderName(u.name);

      setLoading(false);
    })();
  }, [router, planId, companyId]);

  // ======= Intercepta JSONP da Efí no DEV (mata CORS) =======
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (process.env.NODE_ENV !== 'development') return;

    const origFetch = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      try {
        const url = typeof input === 'string' ? input : (input as Request).url;
        if (url && url.startsWith('https://cobrancas-h.api.efipay.com.br/v1/card/')) {
          const u = new URL(url);
          const m = u.pathname.match(/\/v1\/card\/([^/]+)\/jsonp/i);
          if (m) {
            const accountId = m[1];
            const proxied = `/api/efi/card-jsonp?accountId=${encodeURIComponent(accountId)}&${u.searchParams.toString()}`;
            setLastJsonpUrl(u.toString());
            setLastProxiedUrl(proxied);
            // Força GET simples sem headers especiais (evita preflight)
            console.log('[checkout][proxy] desviando JSONP:', { from: u.toString(), to: proxied });
            return origFetch(proxied, { method: 'GET' });
          }
        }
      } catch (e) {
        console.warn('[checkout][proxy] intercept error', e);
      }
      return origFetch(input as any, init);
    };

    return () => { window.fetch = origFetch; };
  }, []);

  // ======= SDK: verify file exists =======
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(SDK_URL, { method: 'HEAD', cache: 'no-store' });
        if (!mounted) return;
        setScriptHTTP(res.ok ? 'ok' : 'fail');
      } catch {
        if (!mounted) return;
        setScriptHTTP('fail');
      }
    })();
    return () => { mounted = false };
  }, []);

  // ======= SDK: globals & fingerprint =======
  useEffect(() => {
    if (!sdkLoaded) return;
    const ep = !!getEfi();
    const cc = !!getEfi()?.CreditCard;
    setHasEfiPay(ep);
    setHasCreditCard(cc);

    (async () => {
      if (cc && typeof getEfi().CreditCard.isScriptBlocked === 'function') {
        try {
          const blocked = await getEfi().CreditCard.isScriptBlocked();
          setFingerBlocked(!!blocked);
          if (blocked) setError('O script de fingerprint está bloqueado (extensão/navegador). Desative bloqueadores e recarregue.');
        } catch { setFingerBlocked(null); }
      } else {
        setFingerBlocked(null);
      }
    })();
  }, [sdkLoaded]);

  // ======= resumo =======
  const summary = useMemo(() => {
    if (!plan) return null;
    const monthly = formatBRL(plan.price_cents);
    const perEmployee = plan.slug !== 'enterprise' && plan.max_employees > 0
      ? (plan.price_cents / 100 / plan.max_employees).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : null;
    return { monthly, perEmployee };
  }, [plan]);

  // ======= helper: ensure Efi JS =======
  async function ensureEfiJs() {
    if (typeof window === 'undefined') return false;
    if (getEfi()?.CreditCard) return true;
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SDK_URL;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Falha ao carregar Efi JS'));
      document.head.appendChild(s);
    });
    return !!getEfi()?.CreditCard;
  }

  // ======= submit =======
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // PRECHECKS
    if (!(await ensureEfiJs()) || !getEfi()?.CreditCard) {
      setError('SDK de pagamento não carregou. Recarregue a página.');
      return;
    }
    if (!plan || !profile) return;
    if (!ACCOUNT_ID) { setError('Faltou Identificador de Conta da Efí (env ou ?accountId=)'); return; }

    // validations
    const cleanCard = cardNumber.replace(/\s+/g, '');
    const brand = detectBrand(cleanCard);
    if (!brand) return setError('Não foi possível identificar a bandeira do cartão.');
    if (!holderName || !cpf || !email || !birth || !phone) {
      return setError('Preencha os dados do titular (nome, CPF, e-mail, nascimento, telefone).');
    }
    if (!street || !number || !neighborhood || !zipcode || !city || !stateUF) {
      return setError('Preencha o endereço de cobrança completo.');
    }

    setSubmitting(true);
    try {
      // TOKENIZAÇÃO
      console.log('[EfiPay][token] início', {
        accountId: maskAccountId(ACCOUNT_ID),
        env: EFI_ENV,
        brand,
        lastJsonpUrl,
        lastProxiedUrl,
      });

      const tokenResult = await getEfi().CreditCard
        .setAccount(ACCOUNT_ID)              // Identificador de Conta (payee)
        .setEnvironment(EFI_ENV)             // 'sandbox' | 'production'
        .setCreditCardData({
          brand,
          number: cleanCard,
          cvv,
          expirationMonth: expMonth,
          expirationYear: expYear,
          holderName,
          holderDocument: cpf.replace(/\D/g, ''),
          reuse: false
        })
        .getPaymentToken();

      console.log('[EfiPay][token] resultado bruto:', tokenResult);

      if (!tokenResult?.payment_token) {
        setSubmitting(false);
        return setError(
          (tokenResult?.error_description || tokenResult?.error) ?? 'Falha ao gerar token de pagamento.'
        );
      }

      // custom_id seguro (sem caracteres fora de [a-zA-Z0-9_-])
      const safeCustomId = sanitizeCustomId(`${profile.company_id}-${plan.slug}`);

      // notification_url só em https
      const notificationUrl =
        typeof window !== 'undefined' && window.location.protocol === 'https:'
          ? `${window.location.origin}/api/webhooks/efi`
          : undefined;

      const payload = {
        plan_uuid: plan.id,
        plan_slug: plan.slug,
        company_id: profile.company_id,
        efi_plan_id: plan.efi_plan_id || null,
        item: { name: plan.name, value: plan.price_cents, amount: 1 },
        metadata: {
          custom_id: safeCustomId,
          ...(notificationUrl ? { notification_url: notificationUrl } : {}),
        },
        customer: {
          name: holderName,
          email,
          cpf: cpf.replace(/\D/g, ''),
          phone_number: phone.replace(/\D/g, ''),
          birth,
        },
        billing_address: {
          street,
          number,
          neighborhood,
          zipcode: zipcode.replace(/\D/g, ''),
          city,
          state: stateUF.toUpperCase(),
        },
        payment_token: tokenResult.payment_token,
      };

      console.log('[checkout][subscribe] POST', API_SUBSCRIBE, {
        item: payload.item,
        plan_slug: payload.plan_slug,
        company_id: mask(payload.company_id, 6),
        payment_token: mask(payload.payment_token, 6),
      });

      const resp = await fetch(API_SUBSCRIBE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const raw = await resp.text();
      let data: any = null;
      try { data = JSON.parse(raw); } catch { /* não-JSON */ }

      if (!resp.ok) {
        console.error('[subscribe] resp.status', resp.status, 'raw:', raw);
        setSubmitting(false);
        return setError(data?.error || `Falha na API (HTTP ${resp.status}). Ver console para detalhes.`);
      }

      console.log('[subscribe] OK:', data);
      const qCharge = data?.charge_id ? `&charge_id=${data.charge_id}` : '';
      router.push(`/checkout/confirmacao?subscription_id=${data.subscription_id}&status=${data.status}${qCharge}`);
    } catch (err: any) {
      console.error('[EfiPay] tokenização/assinatura erro:', err);
      const msg = err?.error_description || err?.error || err?.message || 'Erro ao processar pagamento.';
      setError(msg);
      setSubmitting(false);
    }
  }

  // ======= RENDER =======
  if (loading) {
    return (
      <Layout>
        <div className="py-16 text-center text-muted-foreground">Carregando checkout...</div>
      </Layout>
    );
  }
  if (error && !plan) {
    return (
      <Layout>
        <div className="max-w-xl mx-auto mt-10 rounded-xl border p-6">
          <h1 className="text-xl font-semibold mb-2">Não foi possível iniciar o checkout</h1>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => router.push('/upgrade')}>Voltar para planos</Button>
        </div>
      </Layout>
    );
  }

  const isEnterprise = plan?.slug === 'enterprise';

  return (
    <Layout>
      <Head><title>Checkout — {plan?.name ?? ''}</title></Head>

      {/* SDK */}
      <Script
        src={SDK_URL}
        strategy="afterInteractive"
        onLoad={() => { setSdkLoaded(true); }}
        onError={() => { setSdkLoaded(false); setError('Falha ao carregar SDK de pagamento.'); }}
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_420px] items-start">
        {/* FORM */}
        <section className="rounded-2xl border p-6 shadow-sm bg-white">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Pagamento com cartão</h1>
            <p className="text-sm text-muted-foreground">
              Preencha os dados do titular e do cartão para concluir sua assinatura.
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-sm font-medium">Nome (como no cartão)</label>
                <input className="mt-1 w-full rounded-md border px-3 py-2"
                  value={holderName} onChange={(e) => setHolderName(e.target.value)} required />
              </div>

              <div className="sm:col-span-2">
                <label className="text-sm font-medium">Número do cartão</label>
                <input className="mt-1 w-full rounded-md border px-3 py-2"
                  inputMode="numeric" autoComplete="cc-number" placeholder="0000 0000 0000 0000"
                  value={cardNumber}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^\d ]/g, '');
                    setCardNumber(v);
                    cardBrandRef.current = detectBrand(v) || null;
                  }}
                  required
                />
                {cardBrandRef.current && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    Bandeira detectada: {cardBrandRef.current}
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium">Mês</label>
                <select className="mt-1 w-full rounded-md border px-3 py-2"
                  value={expMonth} onChange={(e) => setExpMonth(e.target.value)} required>
                  <option value="">MM</option>
                  {Array.from({ length: 12 }, (_, i) => {
                    const mm = String(i + 1).padStart(2, '0');
                    return <option key={mm} value={mm}>{mm}</option>;
                  })}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Ano</label>
                <select className="mt-1 w-full rounded-md border px-3 py-2"
                  value={expYear} onChange={(e) => setExpYear(e.target.value)} required>
                  <option value="">AAAA</option>
                  {Array.from({ length: 15 }, (_, i) => {
                    const yy = new Date().getFullYear() + i;
                    return <option key={yy} value={String(yy)}>{yy}</option>;
                  })}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">CVV</label>
                <input className="mt-1 w-full rounded-md border px-3 py-2"
                  inputMode="numeric" autoComplete="cc-csc" placeholder="123" maxLength={4}
                  value={cvv} onChange={(e) => setCvv(e.target.value.replace(/\D/g, ''))} required />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">CPF</label>
                <input className="mt-1 w-full rounded-md border px-3 py-2"
                  placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(e.target.value)} required />
              </div>
              <div>
                <label className="text-sm font-medium">Nascimento</label>
                <input type="date" className="mt-1 w-full rounded-md border px-3 py-2"
                  value={birth} onChange={(e) => setBirth(e.target.value)} required />
              </div>
              <div>
                <label className="text-sm font-medium">Telefone</label>
                <input className="mt-1 w-full rounded-md border px-3 py-2"
                  placeholder="(00) 00000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </div>
              <div>
                <label className="text-sm font-medium">E-mail</label>
                <input type="email" className="mt-1 w-full rounded-md border px-3 py-2"
                  value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="text-sm font-medium">Rua</label>
                <input className="mt-1 w-full rounded-md border px-3 py-2"
                  value={street} onChange={(e) => setStreet(e.target.value)} required />
              </div>
              <div>
                <label className="text-sm font-medium">Número</label>
                <input className="mt-1 w-full rounded-md border px-3 py-2"
                  value={number} onChange={(e) => setNumber(e.target.value)} required />
              </div>
              <div>
                <label className="text-sm font-medium">Bairro</label>
                <input className="mt-1 w-full rounded-md border px-3 py-2"
                  value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} required />
              </div>
              <div>
                <label className="text-sm font-medium">CEP</label>
                <input className="mt-1 w-full rounded-md border px-3 py-2"
                  placeholder="00000-000" value={zipcode} onChange={(e) => setZipcode(e.target.value)} required />
              </div>
              <div>
                <label className="text-sm font-medium">Cidade</label>
                <input className="mt-1 w-full rounded-md border px-3 py-2"
                  value={city} onChange={(e) => setCity(e.target.value)} required />
              </div>
              <div>
                <label className="text-sm font-medium">UF</label>
                <input className="mt-1 w-full rounded-md border px-3 py-2"
                  placeholder="SP" value={stateUF} onChange={(e) => setStateUF(e.target.value.toUpperCase())} maxLength={2} required />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={submitting || !hasCreditCard || fingerBlocked === true}>
              {submitting ? 'Processando...' : `Assinar ${plan?.name ?? ''}`}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              🔒 Pagamento seguro. Nós não armazenamos os dados do seu cartão.
            </p>
          </form>

          {debug && (
            <div className="mt-6 rounded-lg bg-gray-50 border p-4 text-xs">
              <div className="font-semibold mb-2">Diagnóstico do SDK</div>
              <ul className="space-y-1">
                <li>Arquivo SDK: <code>{SDK_URL}</code> — HTTP: <b>{scriptHTTP}</b></li>
                <li>Script carregado: <b>{String(sdkLoaded)}</b></li>
                <li>getEfi(): <b>{String(hasEfiPay)}</b></li>
                <li>EfiPay.CreditCard: <b>{String(hasCreditCard)}</b></li>
                <li>Fingerprint bloqueado: <b>{fingerBlocked === null ? 'indisponível' : String(fingerBlocked)}</b></li>
                <li>ENV: accountId=<b>{maskAccountId(ACCOUNT_ID)}</b> env=<b>{EFI_ENV}</b></li>
                <li>API endpoint: <b>{API_SUBSCRIBE}</b></li>
                {process.env.NODE_ENV === 'development' && (
                  <>
                    <li className="mt-2">JSONP original (última):<br/><code className="break-all">{lastJsonpUrl || '(nunca chamado)'}</code></li>
                    <li>Via proxy (última):<br/><code className="break-all">{lastProxiedUrl || '(nunca chamado)'}</code></li>
                  </>
                )}
              </ul>
              <div className="mt-2 flex gap-2">
                <Button variant="secondary" onClick={ensureEfiJs} type="button">Recarregar SDK</Button>
                <Button variant="secondary" type="button" onClick={() => location.reload()}>Recarregar página</Button>
              </div>
            </div>
          )}
        </section>

        {/* RESUMO */}
        <aside className="rounded-2xl border p-6 shadow-sm bg-white">
          <div className="mb-4">
            <div className="text-sm text-muted-foreground">Seu plano</div>
            <div className="flex items-baseline gap-2">
              <h2 className="text-xl font-semibold">{plan?.name}</h2>
              <span className="text-xs rounded-full bg-gray-100 px-2 py-0.5">{plan?.slug}</span>
            </div>
          </div>

          <div className="mb-6">
            <div className="text-3xl font-bold">
              {summary?.monthly}<span className="text-base text-muted-foreground">/mês</span>
            </div>
            {summary?.perEmployee && (
              <div className="text-sm text-muted-foreground">{summary.perEmployee} por funcionário/mês</div>
            )}
          </div>

          <ul className="text-sm space-y-2 mb-6">
            <li className="font-medium">
              {isEnterprise ? 'Funcionários ilimitados' : `Até ${plan?.max_employees} funcionários`}
            </li>
            {Array.isArray(plan?.features_json) &&
              plan!.features_json!.map((f, i) => <li key={i} className="text-muted-foreground">• {f}</li>)}
            {plan && plan.trial_days > 0 && <li className="text-muted-foreground">• {plan.trial_days} dias de teste</li>}
          </ul>

          <div className="rounded-xl bg-gray-50 p-4 text-sm">
            <div className="font-medium mb-1">Resumo</div>
            <div className="flex justify-between">
              <span>{plan?.name}</span>
              <span>{plan ? formatBRL(plan.price_cents) : ''}/mês</span>
            </div>
          </div>

          <div className="mt-6 text-xs text-muted-foreground">
            Ao confirmar, você concorda com a cobrança recorrente mensal e com nossos termos de uso.
          </div>
        </aside>
      </div>
    </Layout>
  );
}
