// pages/api/efi/change-plan.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

type Ok = {
  stage: string;
  new_subscription_id: number;
  new_charge_id?: number | null;
  new_status?: string;
  canceled_old?: { efi_subscription_id?: number | null; ok: boolean };
};
type Fail = { stage: string; error: string; hint?: string; details?: any };

// ---------- Supabase (admin-only, server) ----------
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ---------- helpers ----------
const norm = (s?: string | null) => String(s ?? '').toLowerCase();
const isHttps = (u?: string) => {
  if (!u) return false;
  try { return new URL(u).protocol === 'https:'; } catch { return false; }
};
const mask = (str?: string, keep = 3) => {
  if (!str) return '(vazio)';
  const s = String(str);
  if (s.length <= keep * 2) return s;
  return `${s.slice(0, keep)}…${s.slice(-keep)}`;
};
// Permite [A-Za-z0-9 _-]; troca demais por "-"; colapsa; trim; corta em 64
function sanitizeCustomId(input: string, maxLen = 64) {
  return input
    .normalize('NFKD')
    .replace(/[^\w\- ]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, maxLen);
}
const required = <T,>(v: T, label: string): T => {
  if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
    throw new Error(`Parâmetro obrigatório ausente: ${label}`);
  }
  return v;
};

// ---------- Efí SDK ----------
function resolveCertPath(input?: string): string | null {
  if (!input) return null;
  let p = input.trim().replace(/\\/g, '/');
  if (!path.isAbsolute(p)) p = path.join(process.cwd(), p);
  return p;
}
async function getEfiSdk(): Promise<{ EfiPay: any }> {
  try {
    const mod = await import('sdk-node-apis-efi');
    return { EfiPay: (mod as any).default ?? (mod as any) };
  } catch {
    const mod = await import('sdk-typescript-apis-efi');
    return { EfiPay: (mod as any).default ?? (mod as any) };
  }
}
async function makeEfiApi() {
  const sandbox = norm(process.env.EFI_SANDBOX) === 'true';
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
    throw new Error('Credenciais/certificado da Efí ausentes (EFI_CLIENT_ID, EFI_CLIENT_SECRET e CERT).');
  }

  const { EfiPay } = await getEfiSdk();
  const opts: any = { sandbox, client_id, client_secret, clientId: client_id, clientSecret: client_secret, certificate };
  if (process.env.EFI_CERT_PASSWORD) opts.certificate_key = process.env.EFI_CERT_PASSWORD;
  return new (EfiPay as any)(opts);
}

// ---------- Cancel helpers (NOVO) ----------

// Cancela 1 assinatura na Efí (ignora erros "benignos")
async function cancelOnEfi(api: any, efiId: number) {
  try {
    await api.cancelSubscription({ id: Number(efiId) }); // Efí: PUT /v1/subscription/:id/cancel
    return { ok: true };
  } catch (e: any) {
    const status = e?.response?.status ?? 0;
    const benign = [400, 404, 409]; // já cancelada/não encontrada/conflito, etc.
    return { ok: benign.includes(status), error: e?.message, status, data: e?.response?.data };
  }
}

/**
 * Cancela TODAS as assinaturas antigas da empresa (actual_plan='no' e status != 'canceled'),
 * exceto a recém-criada (keepEfiId).
 */
async function cleanupOldEfiSubscriptions(opts: {
  api: any;
  company_id: string;
  keepEfiId: number;
}) {
  const { api, company_id, keepEfiId } = opts;

  const { data: oldSubs } = await supabaseAdmin
    .from('subscriptions')
    .select('id, efi_subscription_id, status, actual_plan')
    .eq('company_id', company_id)
    .neq('status', 'canceled')
    .eq('actual_plan', 'no')
    .not('efi_subscription_id', 'is', null);

  if (!oldSubs?.length) return;

  for (const row of oldSubs) {
    const efiId = Number(row.efi_subscription_id);
    if (!efiId || efiId === Number(keepEfiId)) continue;

    const res = await cancelOnEfi(api, efiId);

    // marca como cancelada localmente se OK/benigno
    if (res.ok) {
      await supabaseAdmin
        .from('subscriptions')
        .update({
          status: 'canceled',
          canceled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);
    }

    // auditoria
    await supabaseAdmin.from('payment_webhook_log').insert({
      provider: 'efi',
      received_at: new Date().toISOString(),
      event_type: 'cleanup-cancel-old',
      body: {
        company_id,
        efi_subscription_id: efiId,
        ok: res.ok,
        error: res.error,
        status: res.status,
        data: res.data,
      },
      headers: {},
      ip: '',
    } as any);
  }
}

// ---------- Handler ----------
const STAGES = {
  INIT: 'init',
  LOAD_PLAN: 'load-plan',
  ENSURE_EFI_PLAN: 'ensure-efi-plan',
  CANCEL_OLD: 'cancel-old',
  CREATE_SUB: 'create-subscription',
  INSERT_LOCAL: 'insert-local',
  DEFINE_PAY: 'define-payment',
} as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse<Ok | Fail>) {
  if (req.method !== 'POST') return res.status(405).json({ stage: STAGES.INIT, error: 'Method Not Allowed' });

  let stage: Ok['stage'] = STAGES.INIT;

  try {
    // Body esperado (mesma estrutura do subscribe para reuso)
    const {
      company_id,                // uuid da empresa (do usuário autenticado)
      plan_id,                   // uuid do novo plano
      payment_token,             // token do cartão da Efí
      customer,                  // { name, email, cpf, phone_number, birth }
      billing_address,           // { street, number, neighborhood, zipcode, city, state }
      metadata,                  // opcional { custom_id, notification_url }
      item,                      // opcional override: { name, value, amount }
    } = req.body || {};

    // Campos obrigatórios
    required(company_id, 'company_id');
    required(plan_id, 'plan_id');
    required(payment_token, 'payment_token');
    required(customer?.name, 'customer[name]');
    required(customer?.email, 'customer[email]');
    required(customer?.cpf, 'customer[cpf]');
    required(customer?.phone_number, 'customer[phone_number]');
    required(customer?.birth, 'customer[birth]');
    required(billing_address?.street, 'billing_address[street]');
    required(billing_address?.number, 'billing_address[number]');
    required(billing_address?.neighborhood, 'billing_address[neighborhood]');
    required(billing_address?.zipcode, 'billing_address[zipcode]');
    required(billing_address?.city, 'billing_address[city]');
    required(billing_address?.state, 'billing_address[state]');

    const api = await makeEfiApi();

    // 1) Carrega o plano interno (pega efi_plan_id e preço)
    stage = STAGES.LOAD_PLAN;
    const { data: planRow, error: planErr } = await supabaseAdmin
      .from('plans')
      .select('id, slug, name, efi_plan_id, price_cents, currency')
      .eq('id', plan_id)
      .single();

    if (planErr || !planRow) {
      return res.status(400).json({ stage, error: 'Plano não encontrado na base.' });
    }
    const planName = (planRow as any).name || (planRow as any).slug || 'Plano';
    const planSlug = (planRow as any).slug as string;
    const planCurrency = (planRow as any).currency || 'BRL';
    const planPriceCents = Number((planRow as any).price_cents ?? 0) || 0;

    // 2) Garante o plan_id na Efí (se não houver, cria e grava)
    stage = STAGES.ENSURE_EFI_PLAN;
    let efiPlanId: number | null = (planRow as any).efi_plan_id ? Number((planRow as any).efi_plan_id) : null;
    if (!efiPlanId) {
      const created = await (api as any).createPlan({}, { name: planName, interval: 1, repeats: null });
      efiPlanId = created?.data?.plan_id ?? created?.plan_id;
      if (!efiPlanId) return res.status(500).json({ stage, error: 'Falha ao criar plano na Efí.' });

      // salva no plano
      await supabaseAdmin.from('plans').update({ efi_plan_id: efiPlanId }).eq('id', plan_id);
    }

    // 3) Cancela assinatura atual (se existir)
    stage = STAGES.CANCEL_OLD;
    let canceledOld: Ok['canceled_old'] | undefined;
    const { data: oldSub } = await supabaseAdmin
      .from('subscriptions')
      .select('id, efi_subscription_id, status')
      .eq('company_id', company_id)
      .eq('status', 'active')
      .maybeSingle();

    if (oldSub && oldSub.efi_subscription_id) {
      try {
        await (api as any).cancelSubscription({ id: Number(oldSub.efi_subscription_id) });
      } catch { /* se falhar aqui, o webhook também tenta mais tarde */ }
      await supabaseAdmin
        .from('subscriptions')
        .update({ status: 'canceled', canceled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', oldSub.id);

      canceledOld = { ok: true, efi_subscription_id: Number(oldSub.efi_subscription_id) };
    }

    // 4) Cria a nova assinatura na Efí (rota usa o id do plano na URL)
    stage = STAGES.CREATE_SUB;
    const valueCents = Number(item?.value ?? planPriceCents);
    const amount = Number(item?.amount ?? 1);
    if (!Number.isFinite(valueCents) || valueCents <= 0) {
      return res.status(400).json({ stage, error: 'Valor do plano inválido (price_cents).' });
    }

    // Sempre envie custom_id e notification_url (fallback pelo .env)
    const customId = sanitizeCustomId(`company:${company_id}|plan:${planSlug}`);
    const webhookUrlFromEnv = process.env.EFI_WEBHOOK_URL && isHttps(process.env.EFI_WEBHOOK_URL)
      ? String(process.env.EFI_WEBHOOK_URL)
      : undefined;

    const subParams = { id: Number(efiPlanId) };
    const subBody: any = {
      items: [{ name: item?.name || planName, value: valueCents, amount }],
      metadata: {
        custom_id: customId,
        ...(metadata?.custom_id ? { custom_id: sanitizeCustomId(String(metadata.custom_id)) } : {}),
        ...(metadata?.notification_url && isHttps(metadata.notification_url)
          ? { notification_url: String(metadata.notification_url) }
          : webhookUrlFromEnv ? { notification_url: webhookUrlFromEnv } : {}),
      },
    };

    const createdSub = await (api as any).createSubscription(subParams, subBody);
    const newSubscriptionId: number = createdSub?.data?.subscription_id ?? createdSub?.subscription_id;
    if (!newSubscriptionId) {
      return res.status(500).json({ stage, error: 'Assinatura não retornou subscription_id.' });
    }

    // 5) Insere localmente a row de subscriptions (status 'waiting') ANTES de definir o pagamento
    stage = STAGES.INSERT_LOCAL;
    const insertLocal = await supabaseAdmin
      .from('subscriptions')
      .insert({
        company_id,
        plan_id,
        status: 'waiting',
        efi_subscription_id: newSubscriptionId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any)
      .select('id')
      .single();

    if (insertLocal.error) {
      // Se der conflito, tenta localizar a row (pode ter sido criada por corrida do webhook)
      const { data: maybeRow } = await supabaseAdmin
        .from('subscriptions')
        .select('id')
        .eq('efi_subscription_id', newSubscriptionId)
        .maybeSingle();

      if (!maybeRow) {
        // Logar o erro para diagnóstico
        try {
          await supabaseAdmin.from('payment_webhook_log').insert({
            provider: 'efi',
            received_at: new Date().toISOString(),
            event_type: 'insert-local-sub-error',
            body: { message: insertLocal.error.message, company_id, plan_id, newSubscriptionId },
            headers: {}, ip: '',
          } as any);
        } catch {}
      }
    }

    // 6) Define método de pagamento (cobrança agora)
    stage = STAGES.DEFINE_PAY;
    const payBody = {
      payment: {
        credit_card: {
          payment_token,
          billing_address: {
            street: String(billing_address.street),
            number: String(billing_address.number),
            neighborhood: String(billing_address.neighborhood),
            zipcode: String(billing_address.zipcode).replace(/\D/g, ''),
            city: String(billing_address.city),
            state: String(billing_address.state).toUpperCase(),
          },
          customer: {
            name: String(customer.name),
            email: String(customer.email),
            cpf: String(customer.cpf).replace(/\D/g, ''),
            phone_number: String(customer.phone_number).replace(/\D/g, ''),
            birth: String(customer.birth),
          },
        },
      },
    };
    const payResp = await (api as any).defineSubscriptionPayMethod({ id: Number(newSubscriptionId) }, payBody);
    const newChargeId: number | null = payResp?.data?.charge_id ?? payResp?.charge_id ?? null;
    const newStatus: string | undefined = payResp?.data?.status ?? payResp?.status ?? undefined;

    // 7) (NOVO) Cancela todas as antigas com actual_plan='no'
    try {
      await cleanupOldEfiSubscriptions({
        api,
        company_id,
        keepEfiId: newSubscriptionId,
      });
    } catch {}

    return res.status(200).json({
      stage,
      new_subscription_id: newSubscriptionId,
      new_charge_id: newChargeId,
      new_status: newStatus,
      canceled_old: canceledOld,
    });
  } catch (e: any) {
    return res.status(500).json({
      stage,
      error: e?.errorDescription || e?.error || e?.message || 'Falha em change-plan',
      hint:
        stage === STAGES.ENSURE_EFI_PLAN || stage === STAGES.CREATE_SUB || stage === STAGES.DEFINE_PAY
          ? 'Verifique credenciais/certificado Efí e se o price_cents do plano está correto (em centavos).'
          : undefined,
      details: {
        stage,
        code: e?.code,
        status: e?.response?.status,
        data: e?.response?.data,
        message: e?.message,
        stack: e?.stack,
      },
    });
  }
}
