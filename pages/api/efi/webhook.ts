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
  process.env.NODE_ENV === 'production' ? '/tmp/webhook.txt' : path.join(process.cwd(), 'webhook.txt');

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

// ---------- Normalização / parsing ----------
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

type ParsedEvent = {
  subscription_id: string | null;
  charge_id: string | null;
  status: string;
  custom_id?: string | null;
};
function pickEventFields(obj: any): ParsedEvent {
  const subId =
    obj?.subscription_id ??
    obj?.subscription?.id ??
    obj?.identifiers?.subscription_id ??
    obj?.data?.subscription_id ?? null;

  const chargeId =
    obj?.charge_id ??
    obj?.charge?.id ??
    obj?.identifiers?.charge_id ??
    obj?.data?.charge_id ?? null;

  const statusRaw =
    obj?.status ??
    obj?.situation ??
    obj?.event ??
    obj?.data?.status ??
    obj?.charge?.status ??
    obj?.subscription?.status ?? null;

  const customId =
    obj?.metadata?.custom_id ??
    obj?.subscription?.metadata?.custom_id ??
    obj?.data?.metadata?.custom_id ??
    obj?.data?.custom_id ?? // <— extra fallback
    obj?.custom_id ?? null;

  const status = extractStatus(statusRaw);
  return { subscription_id: subId ? String(subId) : null, charge_id: chargeId ? String(chargeId) : null, status, custom_id: customId ?? null };
}

// custom_id — versão robusta
// Aceita:
// 1) "company:<uuid>|plan:<slug>"
// 2) "uuid|slug"
// 3) "uuid-slug" (slug pode ter hífens; puxa “o resto”)
// 4) JSON string: {"company":"<uuid>","plan":"<slug>"} (ou company_id / plan_slug)
function parseCustomId(raw?: string | null): { companyId?: string; planSlug?: string } {
  if (!raw) return {};
  const s = String(raw).trim();

  const isUuid = (x?: string) => !!x?.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/);

  // 4) JSON
  if (s.startsWith('{') && s.endsWith('}')) {
    try {
      const j = JSON.parse(s);
      const company = j?.company ?? j?.company_id ?? j?.companyId;
      const plan = j?.plan ?? j?.plan_slug ?? j?.planSlug;
      const out: { companyId?: string; planSlug?: string } = {};
      if (typeof company === 'string' && isUuid(company)) out.companyId = company;
      if (typeof plan === 'string' && plan.trim()) out.planSlug = String(plan).trim();
      if (out.companyId || out.planSlug) return out;
    } catch {}
  }

  // 1) "company:<uuid>|plan:<slug>"
  if (s.includes('|') && s.includes(':')) {
    const parts = s.split('|');
    const out: { companyId?: string; planSlug?: string } = {};
    for (const p of parts) {
      const [k, v] = p.split(':', 2);
      if (!k || !v) continue;
      if (k === 'company' && isUuid(v)) out.companyId = v;
      if (k === 'plan' && v.trim()) out.planSlug = v.trim();
    }
    if (out.companyId || out.planSlug) return out;
  }

  // 2) "uuid|slug"
  if (s.includes('|')) {
    const [maybeUuid, maybeSlug] = s.split('|');
    if (isUuid(maybeUuid) && maybeSlug?.trim()) {
      return { companyId: maybeUuid, planSlug: maybeSlug.trim() };
    }
  }

  // 3) "uuid-slug"  (slug = tudo após o UUID + hífen)
  const m = s.match(/^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})-(.+)$/);
  if (m && isUuid(m[1]) && m[2]?.trim()) {
    return { companyId: m[1], planSlug: m[2].trim() };
  }

  return {};
}

// ---------- Retry para evitar corrida ----------
async function findSubscriptionWithRetry(efiSubscriptionId: string, maxAttempts = 10) {
  let attempt = 0;
  while (attempt < maxAttempts) {
    attempt += 1;

    let subRes = await supabaseAdmin
      .from('subscriptions')
      .select('id, company_id, plan_id, status, started_at')
      .eq('efi_subscription_id', efiSubscriptionId)
      .maybeSingle();

    if ((!subRes.data) && /^\d+$/.test(efiSubscriptionId)) {
      subRes = await supabaseAdmin
        .from('subscriptions')
        .select('id, company_id, plan_id, status, started_at')
        .eq('efi_subscription_id', Number(efiSubscriptionId))
        .maybeSingle();
    }

    if (subRes.data) return subRes.data as {
      id: string; company_id: string | null; plan_id: string | null; status: string | null; started_at: string | null;
    };

    const delay = Math.min(500 * Math.pow(1.35, attempt - 1), 1200);
    await sleep(delay);
  }
  return null;
}

// ---------- Helpers Efí: detailSubscription / detailCharge ----------
async function detailSubscription(api: any, id: string | number): Promise<any | null> {
  try {
    const resp = await api.detailSubscription({ id: Number(id) });
    return resp?.data ?? resp ?? null;
  } catch { return null; }
}
async function detailCharge(api: any, id: string | number): Promise<any | null> {
  try {
    const resp = await api.detailCharge({ id: Number(id) });
    return resp?.data ?? resp ?? null;
  } catch { return null; }
}
function extractAmountCentsFromCharge(obj: any): number {
  if (!obj) return 0;
  const candidates = [
    obj.total, obj.value, obj.amount, obj.amount_total,
    obj?.payment?.amount, obj?.charge?.total, obj?.charge?.amount, obj?.billing?.amount
  ];
  for (const c of candidates) { const n = Number(c); if (Number.isFinite(n) && n >= 0) return Math.round(n); }
  return 0;
}
async function getPlanPriceCents(plan_id: string | null): Promise<number> {
  if (!plan_id) return 0;
  const { data } = await supabaseAdmin.from('plans').select('price_cents').eq('id', plan_id).maybeSingle();
  return Number(data?.price_cents ?? 0) || 0;
}

// ---------- Upsert de transaction (waiting/paid) ----------
async function upsertTransaction({
  company_id, subscription_id, plan_id, efi_subscription_id, efi_charge_id, status, amount_cents, currency = 'BRL',
}: {
  company_id: string; subscription_id: string; plan_id: string | null;
  efi_subscription_id: string | number | null; efi_charge_id: string | number | null;
  status: 'waiting' | 'paid' | 'failed';
  amount_cents: number; currency?: 'BRL';
}) {
  const payload: any = {
    company_id, subscription_id, plan_id,
    efi_subscription_id: efi_subscription_id ? Number(efi_subscription_id) : null,
    efi_charge_id: efi_charge_id ? Number(efi_charge_id) : null,
    status, amount_cents, currency,
    updated_at: new Date().toISOString(),
  };

  if (payload.efi_charge_id) {
    // Conflito por efi_charge_id (único por cobrança)
    await supabaseAdmin.from('transactions').upsert(payload, { onConflict: 'efi_charge_id' });
  } else {
    // Sem charge_id: evita duplicar criando uma “sentinela” por dia
    const { data: already } = await supabaseAdmin
      .from('transactions')
      .select('id')
      .eq('subscription_id', subscription_id)
      .eq('status', status)
      .gte('created_at', new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString())
      .limit(1);

    if (!already?.length) {
      await supabaseAdmin.from('transactions').insert(payload);
    }
  }
}

// ---------- Auto-create/Auto-update de subscription ----------
async function ensureLocalSubscription(opts: {
  subscriptionId: string;
  customFromEvent?: string | null;
  baseHeaders: any;
}) {
  const { subscriptionId, customFromEvent, baseHeaders } = opts;

  const api = await makeEfiApi();
  if (!api) return null;

  const detail = await detailSubscription(api, subscriptionId);
  const custom = (detail?.metadata?.custom_id ?? customFromEvent) || null;

  if (!custom) {
    await supabaseAdmin.from('payment_webhook_log').insert({
      provider: 'efi', received_at: new Date().toISOString(), event_type: 'custom-missing',
      body: { subscription_id: subscriptionId },
      headers: baseHeaders, ip: '',
    } as any);
    return null;
  }

  const parsed = parseCustomId(custom);
  let companyId = parsed.companyId;
  let planId: string | null = null;

  if (!companyId) {
    await supabaseAdmin.from('payment_webhook_log').insert({
      provider: 'efi', received_at: new Date().toISOString(), event_type: 'custom-parse-miss',
      body: { subscription_id: subscriptionId, raw: String(custom) },
      headers: baseHeaders, ip: '',
    } as any);
    return null;
  }

  if (parsed.planSlug) {
    const { data: planRow } = await supabaseAdmin
      .from('plans')
      .select('id')
      .eq('slug', parsed.planSlug)
      .maybeSingle();
    planId = planRow?.id ?? null;
  }

  // 1) tenta inserir (status waiting não conflita com unique em status=active)
  const ins = await supabaseAdmin
    .from('subscriptions')
    .insert({
      company_id: companyId,
      plan_id: planId,
      efi_subscription_id: Number(subscriptionId),
      status: 'waiting',
      started_at: null,
      updated_at: new Date().toISOString(),
    } as any)
    .select('id, company_id, plan_id, status, started_at')
    .maybeSingle();

  if (ins.data) {
    await supabaseAdmin.from('payment_webhook_log').insert({
      provider: 'efi', received_at: new Date().toISOString(), event_type: 'autocreate-sub',
      body: { subscription_id: subscriptionId, company_id: companyId, plan_id: planId },
      headers: baseHeaders, ip: '',
    } as any);
    return ins.data;
  }

  // 2) se falhou (ex.: outra linha existente), reaproveita a mais recente da empresa
  const { data: anySubOfCompany } = await supabaseAdmin
    .from('subscriptions')
    .select('id, company_id, plan_id, status, started_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (anySubOfCompany && anySubOfCompany.length) {
    const chosen = anySubOfCompany[0];
    const upd = await supabaseAdmin
      .from('subscriptions')
      .update({
        plan_id: planId ?? chosen.plan_id,
        efi_subscription_id: Number(subscriptionId),
        status: 'waiting',
        started_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', chosen.id)
      .select('id, company_id, plan_id, status, started_at')
      .maybeSingle();

    if (upd.data) {
      await supabaseAdmin.from('payment_webhook_log').insert({
        provider: 'efi', received_at: new Date().toISOString(), event_type: 'autoupdate-sub',
        body: { subscription_id: subscriptionId, reused_id: chosen.id, company_id: companyId, plan_id: planId ?? chosen.plan_id },
        headers: baseHeaders, ip: '',
      } as any);
      return upd.data;
    }

    await supabaseAdmin.from('payment_webhook_log').insert({
      provider: 'efi', received_at: new Date().toISOString(), event_type: 'autoupdate-error',
      body: { subscription_id: subscriptionId, error: ins.error?.message },
      headers: baseHeaders, ip: '',
    } as any);
  } else {
    await supabaseAdmin.from('payment_webhook_log').insert({
      provider: 'efi', received_at: new Date().toISOString(), event_type: 'autocreate-error',
      body: { subscription_id: subscriptionId, error: ins.error?.message },
      headers: baseHeaders, ip: '',
    } as any);
  }

  return null;
}

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
      provider: 'efi', received_at: new Date().toISOString(), event_type: 'env-check',
      body: envHave, headers: base.headers, ip: String(base.ip || ''),
    } as any);
  } catch {}

  // 1) auditoria bruta
  try {
    await supabaseAdmin.from('payment_webhook_log').insert({
      provider: 'efi', received_at: new Date().toISOString(), event_type: 'incoming',
      body, headers: base.headers, ip: String(base.ip || ''),
    } as any);
  } catch {}

  // 2) resolve via token de notificação (quando vier)
  const tokenNotif: string | null = body?.notification || body?.token || body?.notification_token || null;
  let resolved: ParsedEvent[] = [];

  if (tokenNotif) {
    try {
      const api = await makeEfiApi();
      if (api) {
        const resp = await api.getNotification({ token: tokenNotif });
        const arr: any[] = (resp && (resp.data ?? resp)) || [];
        resolved = arr.map(pickEventFields).filter(x => x.subscription_id || x.charge_id || x.status);
        await supabaseAdmin.from('payment_webhook_log').insert({
          provider: 'efi', received_at: new Date().toISOString(), event_type: 'resolved',
          body: { token: tokenNotif, count: resolved.length, raw_len: Array.isArray(arr) ? arr.length : 0 },
          headers: base.headers, ip: String(base.ip || ''),
        } as any);
      } else {
        await supabaseAdmin.from('payment_webhook_log').insert({
          provider: 'efi', received_at: new Date().toISOString(), event_type: 'resolve-skip',
          body: { reason: 'missing-sdk-or-creds' }, headers: base.headers, ip: String(base.ip || ''),
        } as any);
      }
    } catch (e: any) {
      await supabaseAdmin.from('payment_webhook_log').insert({
        provider: 'efi', received_at: new Date().toISOString(), event_type: 'resolve-error',
        body: { message: e?.message || String(e) }, headers: base.headers, ip: String(base.ip || ''),
      } as any);
    }
  }

  // 3) fallback direto do body
  if (!resolved.length) {
    const fb = pickEventFields(body);
    if (fb.subscription_id || fb.charge_id || fb.status) {
      resolved.push(fb);
      await supabaseAdmin.from('payment_webhook_log').insert({
        provider: 'efi', received_at: new Date().toISOString(), event_type: 'fallback-parse',
        body: fb, headers: base.headers, ip: String(base.ip || ''),
      } as any);
    }
  }

  if (!resolved.length) return res.status(200).json({ ok: true, skipped: 'no-ids-or-status' });

  // 4) aplica o último evento
  const last = resolved[resolved.length - 1];
  const subscriptionId = last.subscription_id!;
  const chargeId = last.charge_id;
  const status = last.status;
  const customFromEvent = last.custom_id || null;

  await supabaseAdmin.from('payment_webhook_log').insert({
    provider: 'efi', received_at: new Date().toISOString(), event_type: 'normalized',
    body: { subscription_id: subscriptionId, charge_id: chargeId, status, custom_id: customFromEvent },
    headers: base.headers, ip: String(base.ip || ''),
  } as any);

  if (!subscriptionId) return res.status(200).json({ ok: true, skipped: 'no-subscription-id' });

  // 5) carrega subscription local — com RETRY
  let sub = await findSubscriptionWithRetry(String(subscriptionId), 10);

  // 5.1 Auto-healing: se não achou, tenta criar/atualizar por company via custom_id
  if (!sub) {
    sub = await ensureLocalSubscription({
      subscriptionId: String(subscriptionId),
      customFromEvent,
      baseHeaders: base.headers,
    });
  }

  if (!sub) {
    await supabaseAdmin.from('payment_webhook_log').insert({
      provider: 'efi', received_at: new Date().toISOString(), event_type: 'db-miss',
      body: { reason: 'subscription-not-found-after-retry', efi_subscription_id: subscriptionId },
      headers: base.headers, ip: String(base.ip || ''),
    } as any);
    return res.status(200).json({ ok: true, stored: 'event-only' });
  }

  // ---------- separar status de charge e estado real da subscription ----------
  let chargeStatus = status; // status do evento/charge
  let subIsActiveFromDetail = false;
  let lastChargeIdFromDetail: number | null = null;

  if (chargeStatus === 'waiting' && subscriptionId) {
    try {
      const api = await makeEfiApi();
      if (api) {
        const det = await detailSubscription(api, subscriptionId);
        const detStatus = extractStatus(det?.status);
        subIsActiveFromDetail = detStatus === 'active' || detStatus === 'confirmed' || detStatus === 'paid';
        const detCharges = det?.charges;
        if (Array.isArray(detCharges) && detCharges.length) {
          const lc = detCharges[detCharges.length - 1];
          lastChargeIdFromDetail = Number(lc?.charge_id ?? lc?.id ?? null) || null;
        }
      }
    } catch {}
  }

  const txStatus: 'waiting' | 'paid' | 'failed' =
    (chargeStatus === 'paid' || chargeStatus === 'confirmed' || chargeStatus === 'active') ? 'paid' :
    (['unpaid', 'failed', 'charge_failed'].includes(chargeStatus)) ? 'failed' : 'waiting';

  const shouldActivateSubscription =
    chargeStatus === 'active' || chargeStatus === 'paid' || chargeStatus === 'confirmed' || subIsActiveFromDetail;

  const isFailed = txStatus === 'failed';
  const isCanceled = ['canceled', 'cancelled'].includes(chargeStatus);

  try {
    // 6) Transação (registrar waiting/paid)
    let amountCents = 0;

    // preferir o charge do evento; senão, o descoberto no detail
    let effectiveChargeId: number | null = chargeId ? Number(chargeId) : (lastChargeIdFromDetail ?? null);

    // Se ainda não temos chargeId e o evento não era "waiting", tenta descobrir via detailSubscription
    if (!effectiveChargeId) {
      const api = await makeEfiApi();
      if (api) {
        const det = await detailSubscription(api, subscriptionId);
        const lastCharge = Array.isArray(det?.charges) && det.charges.length ? det.charges[det.charges.length - 1] : null;
        effectiveChargeId = Number(lastCharge?.charge_id ?? lastCharge?.id ?? null) || null;
      }
    }

    if (effectiveChargeId) {
      const api = await makeEfiApi();
      if (api) {
        const ch = await detailCharge(api, effectiveChargeId);
        amountCents = extractAmountCentsFromCharge(ch);
      }
      if (!amountCents) amountCents = await getPlanPriceCents(sub.plan_id);

      await upsertTransaction({
        company_id: sub.company_id!, subscription_id: sub.id, plan_id: sub.plan_id ?? null,
        efi_subscription_id: subscriptionId, efi_charge_id: effectiveChargeId,
        status: txStatus,
        amount_cents: amountCents,
      });

      await supabaseAdmin.from('subscriptions')
        .update({ last_charge_id: Number(effectiveChargeId), updated_at: new Date().toISOString() })
        .eq('id', sub.id);

    } else {
      // Sem charge_id conhecido: cria registro “sentinela”, mantendo o status coerente
      amountCents = await getPlanPriceCents(sub.plan_id);
      await upsertTransaction({
        company_id: sub.company_id!, subscription_id: sub.id, plan_id: sub.plan_id ?? null,
        efi_subscription_id: subscriptionId, efi_charge_id: null,
        status: txStatus === 'paid' ? 'paid' : 'waiting',
        amount_cents: amountCents,
      });
    }

    // 7) Atualiza status da assinatura e empresa
    if (shouldActivateSubscription) {
      await supabaseAdmin.from('subscriptions').update({
        status: 'active',
        started_at: sub.started_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', sub.id);

      if (sub.plan_id) {
        const { data: planRow } = await supabaseAdmin
          .from('plans')
          .select('slug, max_employees')
          .eq('id', sub.plan_id)
          .maybeSingle();

        if (sub.company_id && planRow) {
          await supabaseAdmin.from('companies').update({
            plan: planRow.slug, maxemployees: planRow.max_employees ?? null,
          }).eq('id', sub.company_id);
        }
      }

      await supabaseAdmin.from('payment_webhook_log').insert({
        provider: 'efi', received_at: new Date().toISOString(), event_type: 'db-update',
        body: { action: 'activate', subscription_id: subscriptionId, charge_id: effectiveChargeId, company_id: sub.company_id, plan_id: sub.plan_id },
        headers: base.headers, ip: String(base.ip || ''),
      } as any);
    } else if (isFailed) {
      await supabaseAdmin.from('subscriptions').update({
        status: 'overdue', updated_at: new Date().toISOString(),
      }).eq('id', sub.id);

      await supabaseAdmin.from('payment_webhook_log').insert({
        provider: 'efi', received_at: new Date().toISOString(), event_type: 'db-update',
        body: { action: 'overdue', subscription_id: subscriptionId, charge_id: effectiveChargeId },
        headers: base.headers, ip: String(base.ip || ''),
      } as any);
    } else if (isCanceled) {
      await supabaseAdmin.from('subscriptions').update({
        status: 'canceled', canceled_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', sub.id);

      if (sub.company_id) {
        await supabaseAdmin.from('companies').update({
          plan: 'free', maxemployees: 3,
        }).eq('id', sub.company_id);
      }

      await supabaseAdmin.from('payment_webhook_log').insert({
        provider: 'efi', received_at: new Date().toISOString(), event_type: 'db-update',
        body: { action: 'canceled', subscription_id: subscriptionId },
        headers: base.headers, ip: String(base.ip || ''),
      } as any);
    } else {
      await supabaseAdmin.from('payment_webhook_log').insert({
        provider: 'efi', received_at: new Date().toISOString(), event_type: 'no-op',
        body: { status: chargeStatus }, headers: base.headers, ip: String(base.ip || ''),
      } as any);
    }
  } catch (e: any) {
    await supabaseAdmin.from('payment_webhook_log').insert({
      provider: 'efi', received_at: new Date().toISOString(), event_type: 'db-error',
      body: { message: e?.message || String(e) }, headers: base.headers, ip: String(base.ip || ''),
    } as any);
  }

  return res.status(200).json({ ok: true });
}
