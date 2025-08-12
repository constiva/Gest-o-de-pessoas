// pages/api/efi/webhook.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { supabase } from '../../../lib/supabaseClient';

const WEBHOOK_LOG =
  process.env.NODE_ENV === 'production'
    ? '/tmp/webhook.txt'
    : path.join(process.cwd(), 'webhook.txt');

function ensureLogFile() {
  try { if (!fs.existsSync(WEBHOOK_LOG)) fs.writeFileSync(WEBHOOK_LOG, ''); } catch {}
}
function appendFile(entry: any) {
  try {
    ensureLogFile();
    fs.appendFileSync(WEBHOOK_LOG, JSON.stringify(entry) + '\n');
  } catch {}
}
function readFileLog(): string {
  try { ensureLogFile(); return fs.readFileSync(WEBHOOK_LOG, 'utf8'); } catch { return ''; }
}
function clearFile() { try { fs.writeFileSync(WEBHOOK_LOG, ''); } catch {} }

function norm(s?: string | null) { return String(s || '').toLowerCase(); }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // token simples via query
  const allowed = (process.env.EFI_WEBHOOK_TOKEN || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  const q = req.query.t;
  const token = Array.isArray(q) ? q[0] : q;

  if (!token || !allowed.includes(token)) {
    appendFile({ ts: new Date().toISOString(), type: 'reject', reason: 'invalid-token',
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress });
    return res.status(401).json({ ok: false, error: 'invalid token' });
  }

  // utilitários GET
  if (req.method === 'GET') {
    if ('clear' in req.query) { clearFile(); return res.status(200).json({ ok: true, cleared: true, file: WEBHOOK_LOG }); }
    if ('dump' in req.query) { res.setHeader('Content-Type', 'text/plain; charset=utf-8'); return res.status(200).send(readFileLog() || '(vazio)'); }
    return res.status(200).json({ ok: true, file: WEBHOOK_LOG, hint: 'use ?dump=1 ou ?clear=1' });
  }

  if (req.method !== 'POST') return res.status(405).end();

  // corpo
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
    headers: { 'user-agent': req.headers['user-agent'], 'content-type': req.headers['content-type'] },
  };

  // log em arquivo
  appendFile({ ...entryBase, type: 'incoming', parsed: { subscriptionId, chargeId, status }, bodyKeys: Object.keys(body || {}) });

  // log em tabela payment_webhook (auditoria)
  try {
    await supabase.from('payment_webhook').insert({
      provider: 'efi',
      received_at: new Date().toISOString(),
      event_type: status || 'unknown',
      body,
      headers: entryBase.headers,
      ip: String(entryBase.ip || ''),
    } as any);
  } catch (e) {
    appendFile({ ...entryBase, type: 'db-log-error', message: (e as any)?.message || String(e) });
  }

  // precisamos da assinatura
  if (!subscriptionId) {
    appendFile({ ...entryBase, type: 'skip', reason: 'no-subscription-id' });
    return res.status(200).json({ ok: true, skipped: 'no-subscription-id' });
  }

  // busca assinatura local
  const { data: sub, error: subErr } = await supabase
    .from('subscriptions')
    .select('id, company_id, plan_id, status')
    .eq('efi_subscription_id', String(subscriptionId))
    .single();

  if (subErr || !sub) {
    appendFile({ ...entryBase, type: 'db-miss', reason: 'subscription-not-found', efi_subscription_id: subscriptionId });
    return res.status(200).json({ ok: true, stored: 'event-only' });
  }

  // regras por status
  const isPaid = status === 'paid' || status === 'active';
  const isFailed = ['unpaid', 'failed', 'charge_failed'].includes(status);
  const isCanceled = ['canceled', 'cancelled'].includes(status);

  try {
    // atualiza transação se veio chargeId
    if (chargeId) {
      await supabase.from('transactions').upsert({
        efi_charge_id: chargeId,
        subscription_id: sub.id,
        status: isPaid ? 'paid' : isFailed ? 'failed' : 'waiting',
        updated_at: new Date().toISOString(),
      } as any);
      await supabase.from('subscriptions').update({ last_charge_id: chargeId }).eq('id', sub.id);
    }

    // atualiza status da subscription
    if (isPaid) {
      await supabase.from('subscriptions').update({
        status: 'active',
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', sub.id);

      // promove empresa: pega plano para limites/slug
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

      appendFile({ ...entryBase, type: 'db-update', action: 'activate', company_id: sub.company_id, plan_id: sub.plan_id, chargeId, subscriptionId });
    }
    else if (isFailed) {
      await supabase.from('subscriptions').update({
        status: 'overdue',
        updated_at: new Date().toISOString(),
      }).eq('id', sub.id);

      appendFile({ ...entryBase, type: 'db-update', action: 'overdue', subscriptionId, chargeId });
    }
    else if (isCanceled) {
      await supabase.from('subscriptions').update({
        status: 'canceled',
        canceled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', sub.id);

      // rebaixa empresa (ex.: free) — ajuste o slug/limite se quiser outro
      if (sub.company_id) {
        await supabase.from('companies').update({
          plan: 'free',
          maxemployees: 3, // exemplo
        }).eq('id', sub.company_id);
      }

      appendFile({ ...entryBase, type: 'db-update', action: 'canceled', subscriptionId });
    }
    else {
      // estados neutros
      appendFile({ ...entryBase, type: 'no-op', status });
    }
  } catch (e) {
    appendFile({ ...entryBase, type: 'db-error', message: (e as any)?.message || String(e) });
  }

  const response = { ok: true };
  appendFile({ ...entryBase, type: 'response', response });

  res.status(200).json(response);
}
