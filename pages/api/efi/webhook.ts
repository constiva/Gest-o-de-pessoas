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
    const candidate = input.current ?? input.status ?? input.situation ?? input.value ?? input.label ?? input.descricao ?? input.event ?? input.name ?? null;
    if (typeof candidate === 'string') return norm(candidate);
  }
  return '';
}
function pickEventFields(obj: any) {
  const subId = obj?.subscription_id ?? obj?.subscription?.id ?? obj?.identifiers?.subscription_id ?? obj?.data?.subscription_id ?? null;
  const chargeId = obj?.charge_id ?? obj?.charge?.id ?? obj?.identifiers?.charge_id ?? obj?.data?.charge_id ?? null;
  const statusRaw = obj?.status ?? obj?.situation ?? obj?.event ?? obj?.data?.status ?? obj?.charge?.status ?? obj?.subscription?.status ?? null;
  const status = extractStatus(statusRaw);
  return { subscription_id: subId ? String(subId) : null, charge_id: chargeId ? String(chargeId) : null, status };
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

    // dump pela base (preferível em produção)
    if (String(req.query.dump || '') === 'db') {
      const { data, error } = await supabaseAdmin
        .from('payment_webhook')
        .select('id, received_at, event_type, ip, body, headers')
        .order('received_at', { ascending: false })
        .limit(100);
      if (error) return res.status(500).json({ ok: false, error: error.message });
      return res.status(200).json({ ok: true, from: 'db', rows: data?.length || 0, data });
    }

    // dump por arquivo (útil em dev)
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

  // 1) auditoria bruta
  try {
    await supabaseAdmin.from('payment_webhook').insert({
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
        const resp = await api.getNotification({ token: tokenNotif });
        const arr: any[] = (resp && (resp.data ?? resp)) || [];
        resolved = arr.map(pickEventFields).filter(x => x.subscription_id || x.charge_id || x.status);
        appendFile({ ...base, type: 'resolved-notification', count: resolved.length });
      } else {
        appendFile({ ...base, type: 'resolve-skip', reason: 'missing-sdk-or-creds' });
      }
    } catch (e: any) {
      appendFile({ ...base, type: 'resolve-error', message: e?.message || String(e) });
    }
  }

  // 3) fallback direto do body
  if (!resolved.length) {
    const fallback = pickEventFields(body);
    if (fallback.subscription_id || fallback.charge_id || fallback.status) {
      resolved.push(fallback);
      appendFile({ ...base, type: 'fallback-parse', parsed: fallback });
    }
  }

  if (!resolved.length) {
    appendFile({ ...base, type: 'skip', reason: 'no-ids-or-status' });
    return res.status(200).json({ ok: true, skipped: 'no-ids-or-status' });
  }

  // 4) aplica o último evento
  const last = resolved[resolved.length - 1];
  const subscriptionId = last.subscription_id;
  const chargeId = last.charge_id;
  const status = last.status;
  appendFile({ ...base, type: 'normalized', parsed: { subscriptionId, chargeId, status } });

  if (!subscriptionId) {
    appendFile({ ...base, type: 'skip', reason: 'no-subscription-id-after-resolve' });
    return res.status(200).json({ ok: true, skipped: 'no-subscription-id' });
  }

  // 5) carrega subscription local e aplica regras
  const { data: sub, error: subErr } = await supabaseAdmin
    .from('subscriptions')
    .select('id, company_id, plan_id, status, started_at')
    .eq('efi_subscription_id', String(subscriptionId))
    .single();

  if (subErr || !sub) {
    appendFile({ ...base, type: 'db-miss', reason: 'subscription-not-found', efi_subscription_id: subscriptionId });
    return res.status(200).json({ ok: true, stored: 'event-only' });
  }

  const isPaid = status === 'paid' || status === 'active' || status === 'confirmed';
  const isFailed = ['unpaid', 'failed', 'charge_failed'].includes(status);
  const isCanceled = ['canceled', 'cancelled'].includes(status);

  try {
    // transação
    if (chargeId) {
      await supabaseAdmin.from('transactions').upsert({
        efi_charge_id: chargeId,
        subscription_id: sub.id,
        status: isPaid ? 'paid' : isFailed ? 'failed' : 'waiting',
        updated_at: new Date().toISOString(),
      } as any);
      await supabaseAdmin.from('subscriptions')
        .update({ last_charge_id: chargeId, updated_at: new Date().toISOString() })
        .eq('id', sub.id);
    }

    if (isPaid) {
      await supabaseAdmin.from('subscriptions').update({
        status: 'active',
        started_at: sub.started_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', sub.id);

      const { data: planRow } = await supabaseAdmin
        .from('plans')
        .select('slug, max_employees')
        .eq('id', sub.plan_id)
        .single();

      if (sub.company_id && planRow) {
        await supabaseAdmin.from('companies').update({
          plan: planRow.slug,
          maxemployees: planRow.max_employees ?? null,
        }).eq('id', sub.company_id);
      }

      appendFile({ ...base, type: 'db-update', action: 'activate', company_id: sub.company_id, plan_id: sub.plan_id, chargeId, subscriptionId });
    } else if (isFailed) {
      await supabaseAdmin.from('subscriptions').update({
        status: 'overdue',
        updated_at: new Date().toISOString(),
      }).eq('id', sub.id);
      appendFile({ ...base, type: 'db-update', action: 'overdue', subscriptionId, chargeId });
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
      appendFile({ ...base, type: 'db-update', action: 'canceled', subscriptionId });
    } else {
      appendFile({ ...base, type: 'no-op', status });
    }
  } catch (e) {
    appendFile({ ...base, type: 'db-error', message: (e as any)?.message || String(e) });
  }

  return res.status(200).json({ ok: true });
}
