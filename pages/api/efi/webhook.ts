// pages/api/efi/webhook.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// ---------- Supabase (admin, só server) ----------
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ---------- Log em arquivo (útil só em dev) ----------
const WEBHOOK_LOG =
  process.env.NODE_ENV === 'production'
    ? '/tmp/webhook.txt'
    : path.join(process.cwd(), 'webhook.txt');

function ensureLogFile() { try { if (!fs.existsSync(WEBHOOK_LOG)) fs.writeFileSync(WEBHOOK_LOG, ''); } catch {} }
function appendFile(entry: any) { try { ensureLogFile(); fs.appendFileSync(WEBHOOK_LOG, JSON.stringify(entry) + '\n'); } catch {} }
function readFileLog(): string { try { ensureLogFile(); return fs.readFileSync(WEBHOOK_LOG, 'utf8'); } catch { return ''; } }
function clearFile() { try { fs.writeFileSync(WEBHOOK_LOG, ''); } catch {} }

const norm = (s?: string | null) => String(s ?? '').toLowerCase();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- SDK Efí helpers ----------
function resolveCertPath(input?: string): string | null {
  if (!input) return null;
  let p = input.trim().replace(/\\/g, '/');
  if (!path.isAbsolute(p)) p = path.join(process.cwd(), p);
  return p;
}
async function getEfiSdk(): Promise<{ EfiPay: any }> {
  try { const mod = await import('sdk-node-apis-efi'); return { EfiPay: (mod as any).default ?? (mod as any) }; }
  catch { const mod = await import('sdk-typescript-apis-efi'); return { EfiPay: (mod as any).default ?? (mod as any) }; }
}
async function makeEfiApi() {
  const sandbox = String(process.env.EFI_SANDBOX).toLowerCase() === 'true';
  const clean = (v?: string) => (v ?? '').replace(/[\r\n]/g, '').trim();
  const client_id = clean(process.env.EFI_CLIENT_ID);
  const client_secret = clean(process.env.EFI_CLIENT_SECRET);

  let certificate = resolveCertPath(process.env.EFI_CERT_PATH || '');
  if (!certificate && process.env.EFI_CERT_PEM_BASE64) {
    const tmp = '/tmp/efi-cert.pem';
    fs.writeFileSync(tmp, Buffer.from(process.env.EFI_CERT_PEM_BASE64, 'base64'));
    certificate = tmp;
  }
  if (!client_id || !client_secret || !certificate) return null;

  const { EfiPay } = await getEfiSdk();
  const opts: any = { sandbox, client_id, client_secret, clientId: client_id, clientSecret: client_secret, certificate };
  if (process.env.EFI_CERT_PASSWORD) opts.certificate_key = process.env.EFI_CERT_PASSWORD;
  return new (EfiPay as any)(opts);
}

// ---------- Normalização de status ----------
function extractStatus(input: any): string {
  if (!input) return '';
  if (typeof input === 'string') return norm(input);
  if (Array.isArray(input) && input.length) return extractStatus(input[input.length - 1]);
  if (typeof input === 'object') {
    const candidate =
      input.current ?? input.status ?? input.situation ?? input.value ??
      input.label ?? input.descricao ?? input.event ?? input.name ?? null;
    if (typeof candidate === 'string') return norm(candidate);
  }
  return '';
}
function pickEventFields(obj: any) {
  const subId =
    obj?.subscription_id ??
    obj?.subscription?.id ??
    obj?.identifiers?.subscription_id ??
    obj?.data?.subscription_id ??
    null;

  const chargeId =
    obj?.charge_id ??
    obj?.charge?.id ??
    obj?.identifiers?.charge_id ??
    obj?.data?.charge_id ??
    null;

  const statusRaw =
    obj?.status ??
    obj?.situation ??
    obj?.event ??
    obj?.data?.status ??
    obj?.charge?.status ??
    obj?.subscription?.status ??
    null;

  const status = extractStatus(statusRaw);
  return { subscription_id: subId ? String(subId) : null, charge_id: chargeId ? String(chargeId) : null, status };
}

// ---------- Retry para evitar corrida com insert local ----------
async function findSubscriptionWithRetry(efiSubscriptionId: string, maxAttempts = 8) {
  let attempt = 0;
  while (attempt < maxAttempts) {
    attempt += 1;

    let subRes = await supabaseAdmin
      .from('subscriptions')
      .select('id, company_id, plan_id, status, started_at')
      .eq('efi_subscription_id', efiSubscriptionId)
      .single();

    if ((subRes.error || !subRes.data) && /^\d+$/.test(efiSubscriptionId)) {
      subRes = await supabaseAdmin
        .from('subscriptions')
        .select('id, company_id, plan_id, status, started_at')
        .eq('efi_subscription_id', Number(efiSubscriptionId))
        .single();
    }

    if (subRes.data) {
      try {
        await supabaseAdmin.from('payment_webhook_log').insert({
          provider: 'efi',
          received_at: new Date().toISOString(),
          event_type: 'retry-found',
          body: { attempt, efi_subscription_id: efiSubscriptionId },
          headers: {}, ip: '',
        } as any);
      } catch {}
      return subRes.data as {
        id: string;
        company_id: string | null;
        plan_id: string | null;
        status: string | null;
        started_at: string | null;
      };
    }

    const delay = Math.min(500 * Math.pow(1.3, attempt - 1), 1000);
    try {
      await supabaseAdmin.from('payment_webhook_log').insert({
        provider: 'efi',
        received_at: new Date().toISOString(),
        event_type: 'retry-search',
        body: { attempt, delay, efi_subscription_id: efiSubscriptionId },
        headers: {}, ip: '',
      } as any);
    } catch {}

    await sleep(delay);
  }

  try {
    await supabaseAdmin.from('payment_webhook_log').insert({
      provider: 'efi',
      received_at: new Date().toISOString(),
      event_type: 'retry-giveup',
      body: { efi_subscription_id: efiSubscriptionId, attempts: maxAttempts },
      headers: {}, ip: '',
    } as any);
  } catch {}
  return null;
}

// ---------- Helpers de plano/valor ----------
async function getPlanInfo(planId: string | null) {
  if (!planId) return { slug: null as string | null, max_employees: null as number | null, price_cents: 0, currency: 'BRL' as string };
  // tenta pegar preço + currency; se a coluna não existir, tenta versão reduzida
  let slug: string | null = null;
  let max_employees: number | null = null;
  let price_cents = 0;
  let currency = 'BRL';

  try {
    const { data, error } = await supabaseAdmin
      .from('plans')
      .select('slug, max_employees, price_cents, currency')
      .eq('id', planId)
      .single();
    if (!error && data) {
      slug = (data as any).slug ?? null;
      max_employees = (data as any).max_employees ?? null;
      price_cents = Number((data as any).price_cents ?? 0) || 0;
      currency = (data as any).currency || 'BRL';
      return { slug, max_employees, price_cents, currency };
    }
  } catch {}
  try {
    const { data } = await supabaseAdmin
      .from('plans')
      .select('slug, max_employees')
      .eq('id', planId)
      .single();
    if (data) {
      slug = (data as any).slug ?? null;
      max_employees = (data as any).max_employees ?? null;
    }
  } catch {}
  return { slug, max_employees, price_cents, currency };
}

// ---------- Transações ----------
type TxStatus = 'new' | 'waiting' | 'paid' | 'failed' | 'canceled';

async function upsertTransactionForEvent(opts: {
  company_id: string | null;
  subscription_id: string;
  plan_id: string | null;
  efi_subscription_id: string;
  efi_charge_id: string | null;
  tx_status: TxStatus;
  amount_cents: number;
  currency: string;
  response_json?: any;
  method?: 'card' | 'pix' | 'billet';
}) {
  const method = opts.method || 'card';

  // Se temos charge_id, tenta achar por charge_id; senão, usa “waiting sem charge” mais recente
  if (opts.efi_charge_id) {
    const { data: existing } = await supabaseAdmin
      .from('transactions')
      .select('id')
      .eq('efi_charge_id', Number(opts.efi_charge_id))
      .limit(1)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin.from('transactions')
        .update({
          status: opts.tx_status,
          amount_cents: opts.amount_cents,
          currency: opts.currency,
          response_json: opts.response_json ?? null,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', (existing as any).id);
      return (existing as any).id as string;
    }
  } else {
    // Dedup bem simples de “waiting sem charge”: reaproveita a última em até 10min
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: existingWait } = await supabaseAdmin
      .from('transactions')
      .select('id, created_at, status')
      .is('efi_charge_id', null)
      .eq('subscription_id', opts.subscription_id)
      .gte('created_at', tenMinAgo)
      .order('created_at', { ascending: false })
      .limit(1);

    if (existingWait && existingWait.length) {
      await supabaseAdmin.from('transactions')
        .update({
          status: opts.tx_status, // pode permanecer waiting
          amount_cents: opts.amount_cents,
          currency: opts.currency,
          response_json: opts.response_json ?? null,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', existingWait[0].id);
      return existingWait[0].id as string;
    }
  }

  // Insert
  const insertRow: any = {
    company_id: opts.company_id,
    subscription_id: opts.subscription_id,
    plan_id: opts.plan_id,
    efi_subscription_id: Number(opts.efi_subscription_id),
    efi_charge_id: opts.efi_charge_id ? Number(opts.efi_charge_id) : null,
    cycle_number: null,
    method: method,
    status: opts.tx_status,
    amount_cents: opts.amount_cents,
    currency: opts.currency,
    response_json: opts.response_json ?? null,
    metadata_json: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: inserted, error } = await supabaseAdmin
    .from('transactions')
    .insert(insertRow)
    .select('id')
    .single();

  if (error) {
    await supabaseAdmin.from('payment_webhook_log').insert({
      provider: 'efi',
      received_at: new Date().toISOString(),
      event_type: 'tx-insert-error',
      body: { message: error.message, row: insertRow },
      headers: {}, ip: '',
    } as any);
    throw error;
  }
  return inserted?.id as string;
}

// ---------- Enforce 1 ativa por empresa (cancela outras) ----------
async function cancelOtherActives(companyId: string | null, keepSubId: string, keepEfiSubId: string | null) {
  if (!companyId) return;
  const { data: others } = await supabaseAdmin
    .from('subscriptions')
    .select('id, efi_subscription_id')
    .eq('company_id', companyId)
    .eq('status', 'active');

  if (!others || !others.length) return;

  const api = await makeEfiApi().catch(() => null);

  for (const row of others) {
    if (row.id === keepSubId) continue; // não cancelar a atual
    try {
      if (api && row.efi_subscription_id && String(row.efi_subscription_id) !== String(keepEfiSubId ?? '')) {
        try { await (api as any).cancelSubscription({ id: Number(row.efi_subscription_id) }); } catch {}
      }
      await supabaseAdmin
        .from('subscriptions')
        .update({ status: 'canceled', canceled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', row.id);

      await supabaseAdmin.from('payment_webhook_log').insert({
        provider: 'efi',
        received_at: new Date().toISOString(),
        event_type: 'auto-cancel-old-active',
        body: { canceled_subscription_id: row.id, reason: 'new-active' },
        headers: {}, ip: '',
      } as any);
    } catch {}
  }
}

// ================== HANDLER ==================
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('x-instance', `${process.env.VERCEL_REGION || 'local'}`);

  // -------- GET utilitário (dump/clear) protegido por token --------
  if (req.method === 'GET') {
    const allowed = (process.env.EFI_WEBHOOK_TOKEN || '').split(',').map(s => s.trim()).filter(Boolean);
    const q = req.query.t; const token = Array.isArray(q) ? q[0] : q;
    if (!token || !allowed.includes(token)) return res.status(401).json({ ok: false, error: 'invalid token' });

    if ('clear' in req.query) { clearFile(); return res.status(200).json({ ok: true, cleared: true, file: WEBHOOK_LOG }); }

    if (String(req.query.dump || '') === 'db') {
      const { data, error } = await supabaseAdmin
        .from('payment_webhook_log')
        .select('id, received_at, event_type, ip, body, headers')
        .order('received_at', { ascending: false })
        .limit(100);
      if (error) return res.status(500).json({ ok: false, error: error.message });
      return res.status(200).json({ ok: true, from: 'db', rows: data?.length || 0, data });
    }

    if ('dump' in req.query) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send(readFileLog() || '(vazio)');
    }
    return res.status(200).json({ ok: true, file: WEBHOOK_LOG, hint: 'use ?dump=db ou ?dump=1' });
  }

  // -------- POST real (callback da Efí) --------
  if (req.method !== 'POST') return res.status(405).end();

  const body: any = req.body || {};
  const base = {
    ts: new Date().toISOString(),
    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    headers: { 'user-agent': req.headers['user-agent'], 'content-type': req.headers['content-type'] },
  };
  appendFile({ ...base, type: 'incoming', bodyKeys: Object.keys(body || {}) });

  // 0) log de ambiente
  try {
    const envHave = {
      sandbox: String(process.env.EFI_SANDBOX || '').length > 0,
      clientId: !!process.env.EFI_CLIENT_ID,
      clientSecret: !!process.env.EFI_CLIENT_SECRET,
      certPath: !!process.env.EFI_CERT_PATH,
      certB64: !!process.env.EFI_CERT_PEM_BASE64,
    };
    await supabaseAdmin.from('payment_webhook_log').insert({
      provider: 'efi',
      received_at: new Date().toISOString(),
      event_type: 'env-check',
      body: envHave,
      headers: base.headers,
      ip: String(base.ip || ''),
    } as any);
  } catch {}

  // 1) auditoria bruta
  try {
    await supabaseAdmin.from('payment_webhook_log').insert({
      provider: 'efi',
      received_at: new Date().toISOString(),
      event_type: 'incoming',
      body,
      headers: base.headers,
      ip: String(base.ip || ''),
    } as any);
  } catch (e) {
    appendFile({ ...base, type: 'db-log-error', message: (e as any)?.message || String(e) });
  }

  // 2) resolve via token de notificação (quando vier)
  const tokenNotif: string | null = body?.notification || body?.token || body?.notification_token || null;
  let resolved: Array<{ subscription_id: string | null; charge_id: string | null; status: string }> = [];

  if (tokenNotif) {
    try {
      const api = await makeEfiApi();
      if (api) {
        const resp = await (api as any).getNotification({ token: tokenNotif });
        const arr: any[] = (resp && (resp.data ?? resp)) || [];
        resolved = arr.map(pickEventFields).filter(x => x.subscription_id || x.charge_id || x.status);

        await supabaseAdmin.from('payment_webhook_log').insert({
          provider: 'efi',
          received_at: new Date().toISOString(),
          event_type: 'resolved',
          body: { token: tokenNotif, count: resolved.length, raw_len: Array.isArray(arr) ? arr.length : 0 },
          headers: base.headers,
          ip: String(base.ip || ''),
        } as any);

        appendFile({ ...base, type: 'resolved-notification', count: resolved.length });
      } else {
        appendFile({ ...base, type: 'resolve-skip', reason: 'missing-sdk-or-creds' });
        await supabaseAdmin.from('payment_webhook_log').insert({
          provider: 'efi',
          received_at: new Date().toISOString(),
          event_type: 'resolve-skip',
          body: { reason: 'missing-sdk-or-creds' },
          headers: base.headers,
          ip: String(base.ip || ''),
        } as any);
      }
    } catch (e: any) {
      appendFile({ ...base, type: 'resolve-error', message: e?.message || String(e) });
      await supabaseAdmin.from('payment_webhook_log').insert({
        provider: 'efi',
        received_at: new Date().toISOString(),
        event_type: 'resolve-error',
        body: { message: e?.message || String(e) },
        headers: base.headers,
        ip: String(base.ip || ''),
      } as any);
    }
  }

  // 3) fallback direto do body
  if (!resolved.length) {
    const fallback = pickEventFields(body);
    if (fallback.subscription_id || fallback.charge_id || fallback.status) {
      resolved.push(fallback);
      appendFile({ ...base, type: 'fallback-parse', parsed: fallback });
      await supabaseAdmin.from('payment_webhook_log').insert({
        provider: 'efi',
        received_at: new Date().toISOString(),
        event_type: 'fallback-parse',
        body: fallback,
        headers: base.headers,
        ip: String(base.ip || ''),
      } as any);
    }
  }

  if (!resolved.length) {
    appendFile({ ...base, type: 'skip', reason: 'no-ids-or-status' });
    return res.status(200).json({ ok: true, skipped: 'no-ids-or-status' });
  }

  // 4) aplica o último evento
  const last = resolved[resolved.length - 1];
  const subscriptionId = last.subscription_id!;
  const chargeId = last.charge_id;
  const status = last.status;

  appendFile({ ...base, type: 'normalized', parsed: { subscriptionId, chargeId, status } });
  try {
    await supabaseAdmin.from('payment_webhook_log').insert({
      provider: 'efi',
      received_at: new Date().toISOString(),
      event_type: 'normalized',
      body: { subscription_id: subscriptionId, charge_id: chargeId, status },
      headers: base.headers,
      ip: String(base.ip || ''),
    } as any);
  } catch {}

  // 5) carrega subscription local — com RETRY
  const sub = await findSubscriptionWithRetry(String(subscriptionId), 8);
  if (!sub) {
    appendFile({ ...base, type: 'db-miss', reason: 'subscription-not-found-after-retry', efi_subscription_id: subscriptionId });
    await supabaseAdmin.from('payment_webhook_log').insert({
      provider: 'efi',
      received_at: new Date().toISOString(),
      event_type: 'db-miss',
      body: { reason: 'subscription-not-found-after-retry', efi_subscription_id: subscriptionId },
      headers: base.headers,
      ip: String(base.ip || ''),
    } as any);
    return res.status(200).json({ ok: true, stored: 'event-only' });
  }

  // 6) info do plano (valor/moeda/limites)
  const planInfo = await getPlanInfo(sub.plan_id);
  const amount_cents = planInfo.price_cents ?? 0;
  const currency = planInfo.currency || 'BRL';

  const isPaid = status === 'paid' || status === 'active' || status === 'confirmed';
  const isFailed = ['unpaid', 'failed', 'charge_failed'].includes(status);
  const isCanceled = ['canceled', 'cancelled'].includes(status);
  const isWaiting = ['waiting', 'new', 'pending'].includes(status);

  try {
    // 6.a) transação (registrar waiting e paid)
    if (isWaiting || isPaid || isFailed) {
      await upsertTransactionForEvent({
        company_id: sub.company_id,
        subscription_id: sub.id,
        plan_id: sub.plan_id,
        efi_subscription_id: String(subscriptionId),
        efi_charge_id: chargeId || null,
        tx_status: isPaid ? 'paid' : isFailed ? 'failed' : 'waiting',
        amount_cents,
        currency,
        response_json: { subscription_id: subscriptionId, charge_id: chargeId, status },
        method: 'card',
      });
    }

    // 6.b) estados da assinatura/empresa
    if (isPaid) {
      // cancela outras ativas antes de ativar esta (respeita índice único)
      await cancelOtherActives(sub.company_id, sub.id, String(subscriptionId));

      await supabaseAdmin.from('subscriptions').update({
        status: 'active',
        started_at: sub.started_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_charge_id: chargeId ? Number(chargeId) : null,
      }).eq('id', sub.id);

      if (sub.company_id) {
        await supabaseAdmin.from('companies').update({
          plan: planInfo.slug,
          maxemployees: planInfo.max_employees ?? null,
        }).eq('id', sub.company_id);
      }

      await supabaseAdmin.from('payment_webhook_log').insert({
        provider: 'efi',
        received_at: new Date().toISOString(),
        event_type: 'db-update',
        body: { action: 'activate', subscription_id: subscriptionId, charge_id: chargeId, company_id: sub.company_id, plan_id: sub.plan_id },
        headers: base.headers, ip: String(base.ip || ''),
      } as any);
    } else if (isFailed) {
      await supabaseAdmin.from('subscriptions').update({
        status: 'overdue',
        updated_at: new Date().toISOString(),
        last_charge_id: chargeId ? Number(chargeId) : null,
      }).eq('id', sub.id);

      await supabaseAdmin.from('payment_webhook_log').insert({
        provider: 'efi',
        received_at: new Date().toISOString(),
        event_type: 'db-update',
        body: { action: 'overdue', subscription_id: subscriptionId, charge_id: chargeId },
        headers: base.headers, ip: String(base.ip || ''),
      } as any);
    } else if (isCanceled) {
      await supabaseAdmin.from('subscriptions').update({
        status: 'canceled',
        canceled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', sub.id);

      if (sub.company_id) {
        await supabaseAdmin.from('companies').update({
          plan: 'free',
          maxemployees: 3,
        }).eq('id', sub.company_id);
      }

      await supabaseAdmin.from('payment_webhook_log').insert({
        provider: 'efi',
        received_at: new Date().toISOString(),
        event_type: 'db-update',
        body: { action: 'canceled', subscription_id: subscriptionId },
        headers: base.headers, ip: String(base.ip || ''),
      } as any);
    } else {
      await supabaseAdmin.from('payment_webhook_log').insert({
        provider: 'efi',
        received_at: new Date().toISOString(),
        event_type: 'no-op',
        body: { status },
        headers: base.headers, ip: String(base.ip || ''),
      } as any);
    }
  } catch (e) {
    appendFile({ ...base, type: 'db-error', message: (e as any)?.message || String(e) });
    await supabaseAdmin.from('payment_webhook_log').insert({
      provider: 'efi',
      received_at: new Date().toISOString(),
      event_type: 'db-error',
      body: { message: (e as any)?.message || String(e) },
      headers: base.headers, ip: String(base.ip || ''),
    } as any);
  }

  return res.status(200).json({ ok: true });
}
