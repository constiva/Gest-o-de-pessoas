// pages/api/efi/webhook.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { supabase } from '../../../lib/supabaseClient';

const WEBHOOK_LOG =
  process.env.NODE_ENV === 'production'
    ? '/tmp/webhook.txt'                          // Vercel: só /tmp é gravável
    : path.join(process.cwd(), 'webhook.txt');    // Dev: cria na raiz do projeto

function ensureLogFile() {
  try {
    if (!fs.existsSync(WEBHOOK_LOG)) fs.writeFileSync(WEBHOOK_LOG, '');
  } catch {}
}
function appendLog(entry: any) {
  try {
    ensureLogFile();
    fs.appendFileSync(WEBHOOK_LOG, JSON.stringify(entry) + '\n');
  } catch {}
}
function readLog(): string {
  try {
    ensureLogFile();
    return fs.readFileSync(WEBHOOK_LOG, 'utf8');
  } catch {
    return '';
  }
}
function clearLog() {
  try { fs.writeFileSync(WEBHOOK_LOG, ''); } catch {}
}
const norm = (s?: string | null) => String(s ?? '').toLowerCase();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // ————— auth simples por token —————
  const allowed = (process.env.EFI_WEBHOOK_TOKEN || '')
    .split(',').map(s => s.trim()).filter(Boolean);

  // aceita ?t=... OU headers
  const q = req.query.t;
  const tokenQs = Array.isArray(q) ? q[0] : q;
  const headerToken =
    (req.headers['x-webhook-token'] as string) ||
    (req.headers['x-efi-token'] as string) ||
    (req.headers['authorization']?.toString().replace(/^Bearer\s+/i, '') ?? '');
  const token = tokenQs || headerToken;

  if (!token || !allowed.includes(token)) {
    appendLog({
      ts: new Date().toISOString(),
      type: 'reject',
      reason: 'invalid-token',
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(401).json({ ok: false, error: 'invalid token' });
  }

  // ————— utilitários GET (debug) —————
  if (req.method === 'GET') {
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

  if (req.method !== 'POST') {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(405).end();
  }

  // ————— parse body recebido da Efí —————
  const body: any = req.body || {};
  const subscriptionId =
    body?.subscription_id ?? body?.subscription?.id ?? body?.data?.subscription_id ?? null;
  const chargeId =
    body?.charge_id ?? body?.charge?.id ?? body?.data?.charge_id ?? null;
  const statusRaw =
    body?.status ?? body?.charge?.status ?? body?.event ?? body?.data?.status ?? null;
  const status = norm(statusRaw);

  const entryBase = {
    ts: new Date().toISOString(),
    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    headers: {
      'user-agent': req.headers['user-agent'],
      'content-type': req.headers['content-type']
    },
  };

  appendLog({
    ...entryBase,
    type: 'incoming',
    parsed: { subscriptionId, chargeId, status },
    bodyKeys: Object.keys(body || {})
  });

  // ————— auditoria em tabela payment_webhook —————
  try {
    await supabase.from('payment_webhook').insert({
      provider: 'efi',
      received_at: new Date().toISOString(),
      event_type: status || 'unknown',
      body,                    // JSONB
      headers: entryBase.headers, // JSONB
      ip: String(entryBase.ip || ''),
    } as any);
  } catch (e) {
    appendLog({ ...entryBase, type: 'db-log-error', message: (e as any)?.message || String(e) });
  }

  // ————— se não tem assinatura, só armazena o evento —————
  if (!subscriptionId) {
    appendLog({ ...entryBase, type: 'skip', reason: 'no-subscription-id' });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, skipped: 'no-subscription-id' });
  }

  // ————— busca assinatura local —————
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

  // ————— regras por status —————
  const isPaid = status === 'paid' || status === 'active';
  const isFailed = ['unpaid', 'failed', 'charge_failed'].includes(status);
  const isCanceled = ['canceled', 'cancelled'].includes(status);

  try {
    // grava/atualiza transação (se a Efí mandou chargeId)
    if (chargeId) {
      await supabase.from('transactions').upsert({
        efi_charge_id: chargeId,
        subscription_id: sub.id,
        status: isPaid ? 'paid' : isFailed ? 'failed' : 'waiting',
        updated_at: new Date().toISOString(),
      } as any);
      await supabase.from('subscriptions')
        .update({ last_charge_id: chargeId })
        .eq('id', sub.id);
    }

    if (isPaid) {
      // ativa assinatura
      await supabase.from('subscriptions').update({
        status: 'active',
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', sub.id);

      // lê plano e promove empresa
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

      // rebaixa empresa (ajuste se quiser outra política)
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
