// pages/api/efi/webhook.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { supabase } from '../../../lib/supabaseClient';

// Onde salvar o log
const WEBHOOK_LOG =
  process.env.NODE_ENV === 'production'
    ? '/tmp/webhook.txt'                          // Vercel: só /tmp é gravável
    : path.join(process.cwd(), 'webhook.txt');    // Dev: cria na raiz do projeto

// ----------------- utils de log em arquivo -----------------
function ensureLogFile() {
  try { if (!fs.existsSync(WEBHOOK_LOG)) fs.writeFileSync(WEBHOOK_LOG, ''); } catch {}
}
function appendLog(entry: any) {
  try { ensureLogFile(); fs.appendFileSync(WEBHOOK_LOG, JSON.stringify(entry) + '\n'); } catch {}
}
function readLog(): string {
  try { ensureLogFile(); return fs.readFileSync(WEBHOOK_LOG, 'utf8'); } catch { return ''; }
}
function clearLog() { try { fs.writeFileSync(WEBHOOK_LOG, ''); } catch {} }
const norm = (s?: string | null) => String(s ?? '').toLowerCase();

// ----------------- helpers de SDK EFI -----------------
function resolveCertPath(input?: string): string | null {
  if (!input) return null;
  let p = input.trim().replace(/\\/g, '/');
  if (!path.isAbsolute(p)) p = path.join(process.cwd(), p);
  return p;
}
async function getEfiSdk(): Promise<{ EfiPay: any; pkg: string }> {
  try {
    const mod = await import('sdk-node-apis-efi');
    return { EfiPay: (mod as any).default ?? (mod as any), pkg: 'sdk-node-apis-efi' };
  } catch {
    try {
      const modTs = await import('sdk-typescript-apis-efi');
      return { EfiPay: (modTs as any).default ?? (modTs as any), pkg: 'sdk-typescript-apis-efi' };
    } catch {
      throw new Error('SDK da Efí não encontrado. Instale: npm i sdk-node-apis-efi');
    }
  }
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

  if (!client_id || !client_secret || !certificate) {
    appendLog({ ts: new Date().toISOString(), type: 'sdk-missing-creds', client_id: !!client_id, client_secret: !!client_secret, certificate: !!certificate });
    return null; // seguimos sem resolver a notificação (mas não quebramos)
  }

  const { EfiPay } = await getEfiSdk();
  const options: any = { sandbox, client_id, client_secret, clientId: client_id, clientSecret: client_secret, certificate };
  if (process.env.EFI_CERT_PASSWORD) options.certificate_key = process.env.EFI_CERT_PASSWORD;
  return new (EfiPay as any)(options);
}

// Normaliza itens vindos do getNotification
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
    null;

  return {
    subscription_id: subId ? String(subId) : null,
    charge_id: chargeId ? String(chargeId) : null,
    status: norm(statusRaw),
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // ============ GET utilitário (com token) ============
  // Mantemos proteção por token SOMENTE para os utilitários de debug.
  if (req.method === 'GET') {
    const allowed = (process.env.EFI_WEBHOOK_TOKEN || '')
      .split(',').map(s => s.trim()).filter(Boolean);
    const q = req.query.t;
    const token = Array.isArray(q) ? q[0] : q;

    if (!token || !allowed.includes(token)) {
      appendLog({ ts: new Date().toISOString(), type: 'reject-get', reason: 'invalid-token', ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress });
      res.setHeader('Cache-Control', 'no-store');
      return res.status(401).json({ ok: false, error: 'invalid token' });
    }

    if ('clear' in req.query) {
      clearLog();
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ ok: true, cleared: true, file: WEBHOOK_LOG });
    }
    if ('dump' in req.query) {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send(readLog() || '(vazio)');
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, file: WEBHOOK_LOG, hint: 'use ?dump=1 ou ?clear=1' });
  }

  // Só aceitamos POST pros callbacks reais
  if (req.method !== 'POST') {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(405).end();
  }

  // ============ POST vindo da Efí ============
  const body: any = req.body || {};
  const entryBase = {
    ts: new Date().toISOString(),
    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    headers: { 'user-agent': req.headers['user-agent'], 'content-type': req.headers['content-type'] },
  };
  appendLog({ ...entryBase, type: 'incoming', bodyKeys: Object.keys(body || {}) });

  // 1) Guarda auditoria crua
  try {
    await supabase.from('payment_webhook').insert({
      provider: 'efi',
      received_at: new Date().toISOString(),
      event_type: 'incoming',
      body,
      headers: entryBase.headers,
      ip: String(entryBase.ip || ''),
    } as any);
  } catch (e) {
    appendLog({ ...entryBase, type: 'db-log-error', message: (e as any)?.message || String(e) });
  }

  // 2) Se veio token de notificação, resolvemos detalhes
  let resolved = [] as Array<{ subscription_id: string | null; charge_id: string | null; status: string }>;
  const notifToken: string | null =
    body?.notification || body?.token || body?.notification_token || null;

  if (notifToken) {
    try {
      const api = await makeEfiApi();
      if (api) {
        const resp = await api.getNotification({ token: notifToken });
        const arr: any[] = (resp && (resp.data ?? resp)) || [];
        const mapped = arr.map(pickEventFields).filter(x => x.subscription_id || x.charge_id || x.status);
        if (mapped.length) resolved = mapped;
        appendLog({ ...entryBase, type: 'resolved-notification', count: mapped.length });
      } else {
        appendLog({ ...entryBase, type: 'resolve-skip', reason: 'missing-sdk-or-creds' });
      }
    } catch (e: any) {
      appendLog({ ...entryBase, type: 'resolve-error', message: e?.message || String(e) });
    }
  }

  // 3) Fallback: tenta ler direto do body (alguns ambientes mandam id/status diretos)
  if (!resolved.length) {
    const fallback = pickEventFields(body);
    if (fallback.subscription_id || fallback.charge_id || fallback.status) {
      resolved.push(fallback);
      appendLog({ ...entryBase, type: 'fallback-parse', parsed: fallback });
    }
  }

  // 4) Se ainda não temos nada útil, responde 200 (Efí re-tenta depois)
  if (!resolved.length) {
    appendLog({ ...entryBase, type: 'skip', reason: 'no-ids-or-status' });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, skipped: 'no-ids-or-status' });
  }

  // 5) Processa eventos (pegamos o mais “recente”/último como decisor)
  const last = resolved[resolved.length - 1];
  const subscriptionId = last.subscription_id;
  const chargeId = last.charge_id;
  const status = last.status;

  appendLog({ ...entryBase, type: 'normalized', parsed: { subscriptionId, chargeId, status } });

  if (!subscriptionId) {
    appendLog({ ...entryBase, type: 'skip', reason: 'no-subscription-id-after-resolve' });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, skipped: 'no-subscription-id' });
  }

  // 6) Busca assinatura local
  const { data: sub, error: subErr } = await supabase
    .from('subscriptions')
    .select('id, company_id, plan_id, status')
    .eq('efi_subscription_id', String(subscriptionId))
    .single();

  if (subErr || !sub) {
    appendLog({ ...entryBase, type: 'db-miss', reason: 'subscription-not-found', efi_subscription_id: subscriptionId });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, stored: 'event-only' });
  }

  // 7) Regras por status
  const isPaid = status === 'paid' || status === 'active' || status === 'confirmed';
  const isFailed = ['unpaid', 'failed', 'charge_failed'].includes(status);
  const isCanceled = ['canceled', 'cancelled'].includes(status);

  try {
    // Atualiza transação se tivermos chargeId
    if (chargeId) {
      await supabase.from('transactions').upsert({
        efi_charge_id: chargeId,
        subscription_id: sub.id,
        status: isPaid ? 'paid' : isFailed ? 'failed' : 'waiting',
        updated_at: new Date().toISOString(),
      } as any);
      await supabase.from('subscriptions')
        .update({ last_charge_id: chargeId, updated_at: new Date().toISOString() })
        .eq('id', sub.id);
    }

    if (isPaid) {
      // ativa assinatura
      await supabase.from('subscriptions').update({
        status: 'active',
        started_at: sub.status === 'active' ? sub['started_at'] : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', sub.id);

      // promove empresa conforme o plano
      const { data: planRow } = await supabase
        .from('plans')
        .select('slug, max_employees')
        .eq('id', sub.plan_id)
        .single();

      if (sub.company_id && planRow) {
        await supabase.from('companies').update({
          plan: planRow.slug,
          maxemployees: planRow.max_employees ?? null,
        }).eq('id', sub.company_id);
      }

      appendLog({ ...entryBase, type: 'db-update', action: 'activate', company_id: sub.company_id, plan_id: sub.plan_id, chargeId, subscriptionId });
    } else if (isFailed) {
      await supabase.from('subscriptions').update({
        status: 'overdue',
        updated_at: new Date().toISOString(),
      }).eq('id', sub.id);

      appendLog({ ...entryBase, type: 'db-update', action: 'overdue', subscriptionId, chargeId });
    } else if (isCanceled) {
      await supabase.from('subscriptions').update({
        status: 'canceled',
        canceled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', sub.id);

      // política de rebaixamento (ajuste se quiser outra)
      if (sub.company_id) {
        await supabase.from('companies').update({
          plan: 'free',
          maxemployees: 3,
        }).eq('id', sub.company_id);
      }

      appendLog({ ...entryBase, type: 'db-update', action: 'canceled', subscriptionId });
    } else {
      appendLog({ ...entryBase, type: 'no-op', status });
    }
  } catch (e) {
    appendLog({ ...entryBase, type: 'db-error', message: (e as any)?.message || String(e) });
  }

  const response = { ok: true };
  appendLog({ ...entryBase, type: 'response', response });

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json(response);
}
