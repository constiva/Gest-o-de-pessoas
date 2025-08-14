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
const nowIso = () => new Date().toISOString();

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
    obj?.data?.custom_id ??
    obj?.custom_id ?? null;

  const status = extractStatus(statusRaw);
  return { subscription_id: subId ? String(subId) : null, charge_id: chargeId ? String(chargeId) : null, status, custom_id: customId ?? null };
}

// custom_id parser robusto (mantido)
function parseCustomId(raw?: string | null): { companyId?: string; planSlug?: string } {
  if (!raw) return {};
  const s = String(raw).trim();

  const isUuid = (x?: string) => !!x?.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/);

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

  if (s.includes('|')) {
    const [maybeUuid, maybeSlug] = s.split('|');
    if (isUuid(maybeUuid) && maybeSlug?.trim()) {
      return { companyId: maybeUuid, planSlug: maybeSlug.trim() };
    }
  }

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
      .select('id, company_id, plan_id, status, started_at, actual_plan')
      .eq('efi_subscription_id', efiSubscriptionId)
      .maybeSingle();

    if ((!subRes.data) && /^\d+$/.test(efiSubscriptionId)) {
      subRes = await supabaseAdmin
        .from('subscriptions')
        .select('id, company_id, plan_id, status, started_at, actual_plan')
        .eq('efi_subscription_id', Number(efiSubscriptionId))
        .maybeSingle();
    }

    if (subRes.data) return subRes.data as {
      id: string; company_id: string | null; plan_id: string | null; status: string | null; started_at: string | null; actual_plan?: string | null;
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

// ---------- Atualização de 'actual_plan' e companies ----------
async function switchActualPlanForCompany(opts: {
  company_id: string;
  new_subscription_id: string;
  new_plan_id: string | null;
  headers: any;
}) {
  const { company_id, new_subscription_id, new_plan_id, headers } = opts;

  await supabaseAdmin
    .from('subscriptions')
    .update({ actual_plan: 'no', updated_at: nowIso() })
    .eq('company_id', company_id)
    .eq('actual_plan', 'yes')
    .neq('id', new_subscription_id);

  await supabaseAdmin
    .from('subscriptions')
    .update({ actual_plan: 'yes', updated_at: nowIso() })
    .eq('id', new_subscription_id);

  await supabaseAdmin.from('payment_webhook_log').insert({
    provider: 'efi',
    received_at: nowIso(),
    event_type: 'flag-switch',
    body: { company_id, new_subscription_id },
    headers, ip: ''
  } as any);

  if (new_plan_id) {
    const { data: planRow } = await supabaseAdmin
      .from('plans')
      .select('slug, max_employees')
      .eq('id', new_plan_id)
      .maybeSingle();

    if (planRow) {
      await supabaseAdmin.from('companies').update({
        plan: planRow.slug, maxemployees: planRow.max_employees ?? null
      }).eq('id', company_id);

      await supabaseAdmin.from('payment_webhook_log').insert({
        provider: 'efi',
        received_at: nowIso(),
        event_type: 'company-plan-updated',
        body: { company_id, via: 'actual_plan=yes', plan: planRow.slug },
        headers, ip: ''
      } as any);
    }
  } else {
    await supabaseAdmin.from('payment_webhook_log').insert({
      provider: 'efi',
      received_at: nowIso(),
      event_type: 'company-plan-pending',
      body: { company_id, reason: 'missing-plan-id-on-subscription' },
      headers, ip: ''
    } as any);
  }
}

async function unsetCurrentIfMatchesAndFallback(opts: {
  company_id: string;
  subscription_id: string;
  headers: any;
}) {
  const { company_id, subscription_id, headers } = opts;

  const { data: subRow } = await supabaseAdmin
    .from('subscriptions')
    .select('id, actual_plan')
    .eq('id', subscription_id)
    .maybeSingle();

  if (subRow?.actual_plan === 'yes') {
    await supabaseAdmin
      .from('subscriptions')
      .update({ actual_plan: 'no', updated_at: nowIso() })
      .eq('id', subscription_id);

    const { data: replacement } = await supabaseAdmin
      .from('subscriptions')
      .select('id, plan_id')
      .eq('company_id', company_id)
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (replacement) {
      await switchActualPlanForCompany({
        company_id,
        new_subscription_id: replacement.id,
        new_plan_id: replacement.plan_id,
        headers
      });
    } else {
      await supabaseAdmin.from('companies').update({
        plan: 'free', maxemployees: 3
      }).eq('id', company_id);

      await supabaseAdmin.from('payment_webhook_log').insert({
        provider: 'efi',
        received_at: nowIso(),
        event_type: 'company-fallback-free',
        body: { company_id, reason: 'no-active-subscriptions' },
        headers, ip: ''
      } as any);
    }
  }
}

// ---------- Upsert de transaction ----------
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
    updated_at: nowIso(),
  };

  if (payload.efi_charge_id) {
    await supabaseAdmin.from('transactions').upsert(payload, { onConflict: 'efi_charge_id' });
  } else {
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

// ---------- Auto-create (mantido) ----------
async function ensureLocalSubscription(opts: {
  subscriptionId: string;
  customFromEvent?: string | null;
  baseHeaders: any;
}) {
  const { subscriptionId, customFromEvent, baseHeaders } = opts;

  const api = await makeEfiApi();
  if (!api) {
    await supabaseAdmin.from('payment_webhook_log').insert({
      provider: 'efi', received_at: nowIso(), event_type: 'autocreate-error',
      body: { subscription_id: subscriptionId, reason: 'missing-sdk-or-creds' },
      headers: baseHeaders, ip: '',
    } as any);
    return null;
  }

  let custom: string | null = null;
  try {
    const detail = await detailSubscription(api, subscriptionId);
    custom = (detail?.metadata?.custom_id ?? customFromEvent) || null;
  } catch {
    custom = customFromEvent || null;
  }

  if (!custom) {
    await supabaseAdmin.from('payment_webhook_log').insert({
      provider: 'efi', received_at: nowIso(), event_type: 'custom-missing',
      body: { subscription_id: subscriptionId },
      headers: baseHeaders, ip: '',
    } as any);
    return null;
  }

  const parsed = parseCustomId(custom);
  const companyId = parsed.companyId;
  let planId: string | null = null;

  if (!companyId) {
    await supabaseAdmin.from('payment_webhook_log').insert({
      provider: 'efi', received_at: nowIso(), event_type: 'custom-parse-miss',
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

  const row = {
    company_id: companyId,
    plan_id: planId,
    efi_subscription_id: Number(subscriptionId),
    status: 'waiting' as const,
    started_at: null,
    actual_plan: 'no' as const,
    updated_at: nowIso(),
  };

  const ins = await supabaseAdmin
    .from('subscriptions')
    .insert(row)
    .select('id, company_id, plan_id, status, started_at')
    .maybeSingle();

  if (ins.data) {
    await supabaseAdmin.from('payment_webhook_log').insert({
      provider: 'efi', received_at: nowIso(), event_type: 'autocreate-sub',
      body: { mode: 'insert', subscription_id: subscriptionId, company_id: companyId, plan_id: planId },
      headers: baseHeaders, ip: '',
    } as any);
    return ins.data as { id: string; company_id: string | null; plan_id: string | null; status: string | null; started_at: string | null };
  }

  if (ins.error) {
    if (ins.error.code === '23505') {
      const sel = await supabaseAdmin
        .from('subscriptions')
        .select('id, company_id, plan_id, status, started_at')
        .eq('efi_subscription_id', Number(subscriptionId))
        .maybeSingle();

      await supabaseAdmin.from('payment_webhook_log').insert({
        provider: 'efi', received_at: nowIso(), event_type: 'autocreate-exists',
        body: { subscription_id: subscriptionId, company_id: companyId, plan_id: planId, found: !!sel.data },
        headers: baseHeaders, ip: '',
      } as any);

      if (sel.data) return sel.data as { id: string; company_id: string | null; plan_id: string | null; status: string | null; started_at: string | null };
    }

    await supabaseAdmin.from('payment_webhook_log').insert({
      provider: 'efi', received_at: nowIso(), event_type: 'autocreate-error',
      body: { subscription_id: subscriptionId, message: ins.error.message, code: ins.error.code, details: ins.error.details ?? null },
      headers: baseHeaders, ip: '',
    } as any);
    return null;
  }

  await supabaseAdmin.from('payment_webhook_log').insert({
    provider: 'efi', received_at: nowIso(), event_type: 'autocreate-null',
    body: { subscription_id: subscriptionId, note: 'insert retornou sem data nem erro' },
    headers: baseHeaders, ip: '',
  } as any);
  return null;
}

// ======================= HANDLER =======================
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
    ts: nowIso(),
    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    headers: { 'user-agent': req.headers['user-agent'], 'content-type': req.headers['content-type'] },
  };
  appendFile({ ...base, type: 'incoming', bodyKeys: Object.keys(body || {}) });

  // 0) log de ambiente
  try {
    const envHave = {
      sandboxValue: String(process.env.EFI_SANDBOX || '').toLowerCase(), // 'true' | 'false' | ''
      clientId: !!process.env.EFI_CLIENT_ID,
      clientSecret: !!process.env.EFI_CLIENT_SECRET,
      certPath: !!process.env.EFI_CERT_PATH,
      certB64: !!process.env.EFI_CERT_PEM_BASE64,
    };
    await supabaseAdmin.from('payment_webhook_log').insert({
      provider: 'efi', received_at: nowIso(), event_type: 'env-check',
      body: envHave, headers: base.headers, ip: String(base.ip || ''),
    } as any);
  } catch {}

  // 1) auditoria bruta
  try {
    await supabaseAdmin.from('payment_webhook_log').insert({
      provider: 'efi', received_at: nowIso(), event_type: 'incoming',
      body, headers: base.headers, ip: String(base.ip || ''),
    } as any);
  } catch {}

  // 2) resolve via token de notificação (quando vier)
  const tokenNotif: string | null = body?.notification || body?.token || body?.notification_token || null;
  let resolved: ParsedEvent[] = [];
  let rawEvents: any[] = [];

  if (tokenNotif) {
    try {
      const api = await makeEfiApi();
      if (api) {
        const resp = await api.getNotification({ token: tokenNotif });
        rawEvents = (resp && (resp.data ?? resp)) || [];
        resolved = rawEvents.map(pickEventFields).filter(x => x.subscription_id || x.charge_id || x.status);
        await supabaseAdmin.from('payment_webhook_log').insert({
          provider: 'efi', received_at: nowIso(), event_type: 'resolved',
          body: { token: tokenNotif, count: resolved.length, raw_len: Array.isArray(rawEvents) ? rawEvents.length : 0 },
          headers: base.headers, ip: String(base.ip || ''),
        } as any);
      } else {
        await supabaseAdmin.from('payment_webhook_log').insert({
          provider: 'efi', received_at: nowIso(), event_type: 'resolve-skip',
          body: { reason: 'missing-sdk-or-creds' }, headers: base.headers, ip: String(base.ip || ''),
        } as any);
      }
    } catch (e: any) {
      await supabaseAdmin.from('payment_webhook_log').insert({
        provider: 'efi', received_at: nowIso(), event_type: 'resolve-error',
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
        provider: 'efi', received_at: nowIso(), event_type: 'fallback-parse',
        body: fb, headers: base.headers, ip: String(base.ip || ''),
      } as any);
    }
  }

  if (!resolved.length) return res.status(200).json({ ok: true, skipped: 'no-ids-or-status' });

  // 4) escolha do evento a aplicar:
  //    - prioriza o ÚLTIMO com charge_id (subscription_charge)
  //    - senão usa o último da lista
  const lastWithCharge = [...resolved].reverse().find(e => !!e.charge_id) || null;
  const lastAny = resolved[resolved.length - 1];
  const chosen = lastWithCharge ?? lastAny;

  let subscriptionId = chosen.subscription_id!;
  let chargeId = chosen.charge_id;
  let chargeStatus = chosen.status;
  const customFromEvent = chosen.custom_id || null;

  await supabaseAdmin.from('payment_webhook_log').insert({
    provider: 'efi', received_at: nowIso(), event_type: 'normalized',
    body: { subscription_id: subscriptionId, charge_id: chargeId, status: chargeStatus, custom_id: customFromEvent, picked: lastWithCharge ? 'charge' : 'any' },
    headers: base.headers, ip: String(base.ip || ''),
  } as any);

  if (!subscriptionId) return res.status(200).json({ ok: true, skipped: 'no-subscription-id' });

  // 5) carrega subscription local — com RETRY
  let sub = await findSubscriptionWithRetry(String(subscriptionId), 10);

  // 5.1 Auto-healing
  if (!sub) {
    sub = await ensureLocalSubscription({
      subscriptionId: String(subscriptionId),
      customFromEvent,
      baseHeaders: base.headers,
    });
  }

  if (!sub) {
    await supabaseAdmin.from('payment_webhook_log').insert({
      provider: 'efi', received_at: nowIso(), event_type: 'db-miss',
      body: { reason: 'subscription-not-found-after-retry', efi_subscription_id: subscriptionId },
      headers: base.headers, ip: String(base.ip || ''),
    } as any);
    return res.status(200).json({ ok: true, stored: 'event-only' });
  }

  // ---------- buscar detalhes para complementar CHARGE (via history) ----------
  let lastChargeIdFromDetail: number | null = null;
  let statusFromHistory: string | null = null;

  try {
    const api = await makeEfiApi();
    if (api) {
      const det = await detailSubscription(api, subscriptionId);

      // status da assinatura (não usamos mais para promover plano)
      // mantemos a coleta por compatibilidade/depuração
      const detHistory = Array.isArray(det?.history) ? det.history : [];

      if (detHistory.length) {
        const h = detHistory[detHistory.length - 1];
        const hId = Number(h?.charge_id ?? h?.id ?? null) || null;
        const hStatus = extractStatus(h?.status ?? h?.situation ?? h?.event ?? null) || null;

        if (hId) lastChargeIdFromDetail = hId;
        if (hStatus) statusFromHistory = hStatus;
      }

      // se o evento não trouxe charge_id, preenche a partir do history
      if (!chargeId && lastChargeIdFromDetail) {
        chargeId = String(lastChargeIdFromDetail);
      }
      // se o evento não trouxe status de charge útil, usa o do history
      if (!chargeStatus && statusFromHistory) {
        chargeStatus = statusFromHistory;
      }
    }
  } catch {}

  // ======== Mapeamento de status baseado na CHARGE ========
  const paidSet = new Set(['paid', 'confirmed', 'active', 'authorized', 'captured', 'settled', 'approved']);
  const waitingSet = new Set([
    'waiting', 'pending', 'pending_payment', 'processing', 'new', 'created', 'waiting_payment',
    'unpaid'
  ]);
  const failedSet = new Set(['failed', 'charge_failed', 'refused', 'refused_payment', 'declined']);
  const canceledSet = new Set(['canceled', 'cancelled']);

  const chargeStatusLc = String(chargeStatus || '').toLowerCase();
  let txStatus: 'waiting' | 'paid' | 'failed';
  if (paidSet.has(chargeStatusLc)) txStatus = 'paid';
  else if (failedSet.has(chargeStatusLc)) txStatus = 'failed';
  else if (canceledSet.has(chargeStatusLc)) txStatus = 'failed';
  else txStatus = 'waiting';

  const isFailed = txStatus === 'failed';
  const isCanceled = canceledSet.has(chargeStatusLc);

  // Agora: só marcamos actual_plan=YES quando a CHARGE está paga
  const shouldMarkCurrent = (txStatus === 'paid');
  // ========================================================

  try {
    // 6) Transação (registrar waiting/paid/failed)
    let amountCents = 0;

    let effectiveChargeId: number | null = chargeId ? Number(chargeId) : (lastChargeIdFromDetail ?? null);

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
        .update({ last_charge_id: Number(effectiveChargeId), updated_at: nowIso() })
        .eq('id', sub.id);

    } else {
      amountCents = await getPlanPriceCents(sub.plan_id);
      await upsertTransaction({
        company_id: sub.company_id!, subscription_id: sub.id, plan_id: sub.plan_id ?? null,
        efi_subscription_id: subscriptionId, efi_charge_id: null,
        status: txStatus === 'paid' ? 'paid' : (txStatus === 'failed' ? 'failed' : 'waiting'),
        amount_cents: amountCents,
      });
    }

    // 7) Atualiza status da assinatura conforme PAYMENT STATUS (apenas)
    if (txStatus === 'paid') {
      await supabaseAdmin.from('subscriptions').update({
        status: 'active',
        started_at: sub.started_at ?? nowIso(),
        updated_at: nowIso(),
      }).eq('id', sub.id);
    } else if (isCanceled) {
      await supabaseAdmin.from('subscriptions').update({
        status: 'canceled', canceled_at: nowIso(), updated_at: nowIso(),
      }).eq('id', sub.id);
    } else if (isFailed) {
      await supabaseAdmin.from('subscriptions').update({
        status: 'overdue', updated_at: nowIso(),
      }).eq('id', sub.id);
    } else {
      // waiting (inclui unpaid) → pending_payment
      await supabaseAdmin.from('subscriptions').update({
        status: 'pending_payment', updated_at: nowIso(),
      }).eq('id', sub.id);
    }

    // 8) alternância do actual_plan (SOMENTE quando pago)
    if (shouldMarkCurrent) {
      await switchActualPlanForCompany({
        company_id: sub.company_id!,
        new_subscription_id: sub.id,
        new_plan_id: sub.plan_id ?? null,
        headers: base.headers
      });
    } else if (isFailed || isCanceled) {
      await unsetCurrentIfMatchesAndFallback({
        company_id: sub.company_id!,
        subscription_id: sub.id,
        headers: base.headers
      });
    } else {
      // waiting/pending_payment: não marca YES e não remove o atual
    }

  } catch (e: any) {
    await supabaseAdmin.from('payment_webhook_log').insert({
      provider: 'efi', received_at: nowIso(), event_type: 'db-error',
      body: { message: e?.message || String(e) }, headers: base.headers, ip: String(base.ip || ''),
    } as any);
  }

  return res.status(200).json({ ok: true });
}
