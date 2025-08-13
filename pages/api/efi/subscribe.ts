// pages/api/efi/subscribe.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import util from 'util';
import { supabase } from '../../../lib/supabaseClient';

type Ok = { subscription_id: number; charge_id?: number; status?: string; stage: string };
type Fail = { error: string; stage: string; hint?: string; details?: any };

const STAGES = {
  INIT: 'init',
  CREATE_PLAN: 'create-plan',
  CREATE_SUB: 'create-subscription',
  DEFINE_PAY: 'define-payment',
} as const;
type Stage = typeof STAGES[keyof typeof STAGES];

const mask = (str?: string, keep = 3) => {
  if (!str) return '(vazio)';
  const s = String(str);
  if (s.length <= keep * 2) return s;
  return `${s.slice(0, keep)}…${s.slice(-keep)}`;
};
const log = (...args: any[]) => console.log('[EFI][API]', ...args);

// ----------------- DEBUG CORE HTTP/HTTPS -----------------
let coreHttpPatched = false;
function installCoreHttpDebug() {
  if (coreHttpPatched || process.env.EFI_DEBUG_HTTP !== '1') return;
  coreHttpPatched = true;
  const http = require('http');
  const https = require('https');
  const wrap = (mod: any, label: string) => {
    const origReq = mod.request;
    mod.request = function wrappedRequest(options: any, cb: any) {
      try {
        const opts = typeof options === 'string' ? new URL(options) : options || {};
        const method = (opts.method || 'GET').toUpperCase();
        const host = opts.hostname || opts.host || opts?.headers?.host || 'unknown-host';
        const path = opts.path || opts.pathname || '/';
        const headers = { ...(opts.headers || {}) };
        delete (headers as any).authorization;
        delete (headers as any).Authorization;
        console.log('[EFI][HTTP][REQ]', label, method, `${host}${path}`);
        console.log('[EFI][HTTP][REQ HEADERS]', headers);
      } catch (e) {
        console.log('[EFI][HTTP][WRAP ERR]', label, String(e));
      }
      const req = origReq.call(mod, options, (res: any) => {
        try {
          const status = res.statusCode;
          const host = res.req?.getHeader?.('host') || res.req?.host || 'unknown-host';
          console.log('[EFI][HTTP][RES]', label, status, host);
        } catch {}
        if (cb) cb(res);
      });
      req.on('error', (err: any) => {
        console.error('[EFI][HTTP][ERR]', label, err?.code || err?.message || err);
      });
      return req;
    };
  };
  wrap(http, 'http');
  wrap(https, 'https');
}
// ---------------------------------------------------------

// ----------------- AXIOS DEBUG ---------------------------
let axiosDebugInstalled = false;
async function installAxiosDebug() {
  if (axiosDebugInstalled || process.env.EFI_DEBUG_AXIOS !== '1') return;
  try {
    const axios = (await import('axios')).default;
    axios.interceptors.request.use((config) => {
      const full = (config.baseURL || '') + (config.url || '');
      if (/efipay\.com\.br/i.test(full)) {
        const safeHeaders = { ...(config.headers as any) };
        delete (safeHeaders as any)['Authorization'];
        delete (safeHeaders as any)['authorization'];
        console.log('[EFI][AXIOS][REQ]', (config.method || 'get').toUpperCase(), full);
        if (safeHeaders) console.log('[EFI][AXIOS][REQ HEADERS]', safeHeaders);
        if (config.data) console.log('[EFI][AXIOS][REQ DATA]', config.data);
      }
      return config;
    }, (err) => {
      console.error('[EFI][AXIOS][REQ ERR]', util.inspect(err, { depth: 6 }));
      return Promise.reject(err);
    });
    axios.interceptors.response.use((resp) => {
      const full = (resp.config.baseURL || '') + (resp.config.url || '');
      if (/efipay\.com\.br/i.test(full)) {
        console.log('[EFI][AXIOS][RES]', resp.status, full);
        console.log('[EFI][AXIOS][RES DATA]', util.inspect(resp.data, { depth: 6 }));
      }
      return resp;
    }, (err) => {
      if (err.response) {
        const full = (err.config?.baseURL || '') + (err.config?.url || '');
        console.error('[EFI][AXIOS][RES ERR]', err.response.status, full);
        console.error('[EFI][AXIOS][RES ERR DATA]', util.inspect(err.response.data, { depth: 8 })));
      } else {
        console.error('[EFI][AXIOS][RES ERR no-response]', util.inspect(err, { depth: 8 }));
      }
      return Promise.reject(err);
    });
    axiosDebugInstalled = true;
  } catch {}
}
// ---------------------------------------------------------

// utils
function resolveCertPath(input?: string): string | null {
  if (!input) return null;
  let p = input.trim().replace(/\\/g, '/');
  if (!path.isAbsolute(p)) p = path.join(process.cwd(), p);
  return p;
}
const isHttps = (u?: string) => {
  if (!u) return false;
  try { return new URL(u).protocol === 'https:'; } catch { return false; }
};

// Permite [A-Za-z0-9 _-]; troca o resto por "-"; colapsa; corta em 64
function sanitizeCustomId(input: string, maxLen = 64) {
  return input
    .normalize('NFKD')
    .replace(/[^\w\- ]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, maxLen);
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

// ---------- PROBES OAUTH (opcional) ----------
async function probeOAuthBoth(sandbox: boolean, clientId: string, clientSecret: string) {
  if (process.env.EFI_EXTRA_PROBE !== '1') return;
  const axios = (await import('axios')).default;
  const clean = (s: string) => s.replace(/[\r\n]/g, '').trim();
  const id = clean(clientId);
  const sec = clean(clientSecret);
  const basic = Buffer.from(`${id}:${sec}`).toString('base64');
  console.log('[EFI][PROBE][BASIC] len=', basic.length, 'peek=', mask(basic, 6));
  const targets = [
    { name: 'oauth', url: (sandbox ? 'https://oauth-h.efipay.com.br/token' : 'https://oauth.efipay.com.br/token'), body: 'grant_type=client_credentials', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    { name: 'cobrancas', url: (sandbox ? 'https://cobrancas-h.api.efipay.com.br/v1/authorize' : 'https://cobrancas.api.efipay.com.br/v1/authorize'), body: { grant_type: 'client_credentials' }, headers: { 'Content-Type': 'application/json' } },
  ];
  for (const t of targets) {
    try {
      console.log('[EFI][PROBE][OAUTH]', t.name, 'POST', t.url);
      const resp = await axios.post(t.url, t.body, {
        headers: { Authorization: `Basic ${basic}`, ...t.headers },
        timeout: 15000,
      });
      console.log('[EFI][PROBE][OAUTH]', t.name, 'status:', resp.status, 'keys:', Object.keys(resp.data || {}));
    } catch (e: any) {
      if (e.response) {
        console.error('[EFI][PROBE][OAUTH]', t.name, 'ERR', e.response.status, util.inspect(e.response.data, { depth: 6 }));
      } else {
        console.error('[EFI][PROBE][OAUTH]', t.name, 'no-response', e?.code || e?.message || e);
      }
    }
  }
}
// --------------------------------------------

/* ===================== NOVO: helpers de cancelamento ===================== */

// Cancela 1 assinatura na Efí (erros 400/404/409 são considerados “benignos”)
async function cancelOnEfi(api: any, efiId: number) {
  try {
    await api.cancelSubscription({ id: Number(efiId) }); // PUT /v1/subscription/:id/cancel
    return { ok: true };
  } catch (e: any) {
    const status = e?.response?.status ?? 0;
    const benign = [400, 404, 409];
    return { ok: benign.includes(status), error: e?.message, status, data: e?.response?.data };
  }
}

/**
 * Cancela TODAS as assinaturas ≠ 'canceled' da empresa, exceto a recém-criada (keepEfiId).
 * (Sem depender de actual_plan.)
 */
async function cleanupOldEfiSubscriptions(opts: {
  api: any;
  company_id: string;
  keepEfiId: number;
}) {
  const { api, company_id, keepEfiId } = opts;

  const { data: oldSubs, error } = await supabase
    .from('subscriptions')
    .select('id, efi_subscription_id, status')
    .eq('company_id', company_id)
    .neq('status', 'canceled')
    .not('efi_subscription_id', 'is', null);

  // auditoria do scan
  try {
    await supabase.from('payment_webhook_log').insert({
      provider: 'efi',
      received_at: new Date().toISOString(),
      event_type: 'cleanup-scan',
      body: { company_id, count: oldSubs?.length ?? 0, keepEfiId, error: error?.message },
      headers: {},
      ip: '',
    } as any);
  } catch {}

  if (error || !oldSubs?.length) return;

  for (const row of oldSubs) {
    const efiId = Number(row.efi_subscription_id);
    if (!efiId || efiId === Number(keepEfiId)) continue;

    const res = await cancelOnEfi(api, efiId);

    // marca como cancelada localmente se OK/benigno
    if (res.ok) {
      await supabase
        .from('subscriptions')
        .update({
          status: 'canceled',
          canceled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);
    }

    // auditoria por item
    try {
      await supabase.from('payment_webhook_log').insert({
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
    } catch {}
  }
}
/* ======================================================================= */

export default async function handler(req: NextApiRequest, res: NextApiResponse<Ok | Fail>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed', stage: STAGES.INIT });
  }

  let stage: Stage = STAGES.INIT;

  try {
    installCoreHttpDebug();
    await installAxiosDebug();

    const { EfiPay, pkg } = await getEfiSdk();
    const nodeVer = process.version;
    const nodeMajor = parseInt(nodeVer.replace('v', '').split('.')[0] || '0', 10);

    log('Usando SDK:', pkg);
    log('Node:', nodeVer, '| cwd:', process.cwd(), '| __dirname:', __dirname);
    if (nodeMajor >= 21) log('WARN: Node >= 21 — se rolar erro mTLS “mudo”, teste com Node 20 LTS.');

    // envs server-side (com sanitização)
    const sandbox = String(process.env.EFI_SANDBOX).toLowerCase() === 'true';
    const clean = (v?: string) => (v ?? '').replace(/[\r\n]/g, '').trim();
    const clientIdRaw = process.env.EFI_CLIENT_ID ?? '';
    const clientSecretRaw = process.env.EFI_CLIENT_SECRET ?? '';
    const clientId = clean(clientIdRaw);
    const clientSecret = clean(clientSecretRaw);
    const certPass = process.env.EFI_CERT_PASSWORD || '';
    let certificate = resolveCertPath(process.env.EFI_CERT_PATH || '');

    if (clientId !== clientIdRaw) console.warn('[EFI][ENV] WARN: clientId tinha espaços/linhas extras — normalizado.');
    if (clientSecret !== clientSecretRaw) console.warn('[EFI][ENV] WARN: clientSecret tinha espaços/linhas extras — normalizado.');

    if (!certificate && process.env.EFI_CERT_PEM_BASE64) {
      const tmp = '/tmp/efi-cert.pem';
      fs.writeFileSync(tmp, Buffer.from(process.env.EFI_CERT_PEM_BASE64, 'base64'));
      certificate = tmp;
    }

    log('ENV (mascarado):', {
      sandbox,
      clientId: mask(clientId),
      clientSecret: mask(clientSecret),
      certEnv: process.env.EFI_CERT_PATH ? '(fornecido)' : '(vazio)',
      certResolved: certificate || '(vazio)',
      certPassword: certPass ? '(sim)' : '(não)',
    });

    if (!clientId || !clientSecret) {
      return res.status(500).json({
        error: 'Credenciais da Efí incompletas no servidor.',
        stage,
        hint: 'Preencha EFI_CLIENT_ID e EFI_CLIENT_SECRET no .env e redeploy.',
      });
    }
    if (!certificate) {
      return res.status(500).json({
        error: 'Caminho do certificado (.pem) não configurado.',
        stage,
        hint: 'Use EFI_CERT_PATH (relativo/absoluto) OU EFI_CERT_PEM_BASE64.',
      });
    }

    // valida PEM
    let stat: fs.Stats | null = null;
    try { stat = fs.statSync(certificate); } catch (e) {
      return res.status(500).json({
        error: 'Arquivo .pem não encontrado no caminho informado.',
        stage,
        hint: `Verifique EFI_CERT_PATH: ${certificate}`,
        details: { fsError: String((e as any)?.message || e) },
      });
    }
    try {
      const text = fs.readFileSync(certificate, 'utf-8');
      const hasCert = /-----BEGIN CERTIFICATE-----/.test(text);
      const hasKey  = /-----BEGIN PRIVATE KEY-----/.test(text);
      log('Cert check:', { exists: true, size: stat?.size, hasCert, hasKey });
      if (!hasCert || !hasKey) {
        return res.status(500).json({
          error: 'Certificado inválido: o bundle deve conter PRIVATE KEY e CERTIFICATE.',
          stage,
          hint: 'Monte key + cert em um único .pem (PRIVATE KEY primeiro, depois CERTIFICATE).',
        });
      }
    } catch {}

    // payload do front
    const {
      plan_uuid, plan_slug, company_id, efi_plan_id,
      item, metadata, customer, billing_address, payment_token,
    } = req.body || {};

    const required = <T,>(v: T, label: string): T => {
      if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
        throw new Error(`Parâmetro obrigatório ausente: ${label}`);
      }
      return v;
    };
    required(plan_uuid, 'plan_uuid');
    required(plan_slug, 'plan_slug');
    required(company_id, 'company_id');
    required(item?.name, 'item[name]');
    required(item?.value, 'item[value]');
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

    const itemValue = Number(item.value);
    const itemAmount = Number(item?.amount ?? 1);
    if (!Number.isFinite(itemValue) || itemValue <= 0) throw new Error('item[value] inválido');
    if (!Number.isFinite(itemAmount) || itemAmount < 1) throw new Error('item[amount] inválido');

    const safeCustomId = metadata?.custom_id ? sanitizeCustomId(String(metadata.custom_id)) : undefined;

    log('Payload (resumo):', {
      plan_uuid: mask(plan_uuid),
      plan_slug,
      company_id: mask(company_id),
      efi_plan_id: efi_plan_id ?? '(novo)',
      item: { name: item.name, value: itemValue, amount: itemAmount },
      meta: {
        custom_id: safeCustomId ? mask(safeCustomId, 6) : '(vazio)',
        notify: metadata?.notification_url || '(vazio)',
      },
      customer: { name: customer.name, email: customer.email },
    });

    await probeOAuthBoth(sandbox, clientId, clientSecret);

    // instancia SDK
    const { EfiPay: EfiPayCtor } = await getEfiSdk(); // já temos acima, mas mantive a sua estrutura
    const options: any = {
      sandbox,
      client_id: clientId,
      client_secret: clientSecret,
      clientId,
      clientSecret,
      certificate,
    };
    if (certPass) options.certificate_key = certPass;
    const api = new (EfiPayCtor as any)(options);

    // 1) Plano
    stage = STAGES.CREATE_PLAN;
    let planId = efi_plan_id;
    if (!planId) {
      const planBody = { name: item.name, interval: 1, repeats: null };
      log('[PLAN] createPlan body:', planBody);
      try {
        const createdPlan = await api.createPlan({}, planBody);
        console.log('[EFI][PLAN][RAW]', util.inspect(createdPlan, { depth: 8 }));
        planId = createdPlan?.data?.plan_id ?? createdPlan?.plan_id;
        log('[PLAN] created:', { planId });

        // grava efi_plan_id no banco
        if (plan_uuid && planId) {
          await supabase.from('plans').update({ efi_plan_id: planId }).eq('id', plan_uuid);
        }
      } catch (e: any) {
        console.error('[EFI][RAW ERROR][PLAN]', util.inspect(e, { depth: 10 }));
        const details = {
          code: e?.code,
          error: e?.error,
          errorDescription: e?.errorDescription,
          status: e?.response?.status,
          data: e?.response?.data,
          message: e?.message,
          stack: e?.stack,
          cause: e?.cause,
          config: { url: e?.config?.url, baseURL: e?.config?.baseURL, method: e?.config?.method },
        };
        log('[PLAN] ERROR:', details);
        return res.status(500).json({
          error: details.errorDescription || details.error || details.message || 'Falha ao criar plano na Efí.',
          stage,
          hint:
            details.status === 401 || /unauthorized/i.test(String(details.error || details.message))
              ? '401 Unauthorized: confirme EFI_SANDBOX e se ClientId/Secret correspondem à conta do certificado.'
              : (nodeMajor >= 21 ? 'Se o erro for mTLS “mudo”, teste com Node 20 LTS.' : undefined),
          details,
        });
      }
      if (!planId) return res.status(500).json({ error: 'Plano não retornou plan_id.', stage });
    } else {
      log('[PLAN] usando efi_plan_id informado:', planId);
    }

    // 2) Assinatura
    stage = STAGES.CREATE_SUB;
    const subsParams = { id: Number(planId) };
    const subsBody: any = {
      items: [{ name: item.name, value: itemValue, amount: itemAmount }],
    };
    if (safeCustomId || metadata?.notification_url) {
      subsBody.metadata = {};
      if (safeCustomId) subsBody.metadata.custom_id = safeCustomId;
      if (isHttps(metadata?.notification_url)) subsBody.metadata.notification_url = String(metadata!.notification_url);
    }
    log('[SUB] createSubscription params/body:', subsParams, subsBody);

    let subscription_id: number;
    let first_charge_id: number | undefined;
    try {
      const createdSub = await api.createSubscription(subsParams, subsBody);
      console.log('[EFI][SUB][RAW]', util.inspect(createdSub, { depth: 8 }));
      subscription_id = createdSub?.data?.subscription_id ?? createdSub?.subscription_id;
      first_charge_id = createdSub?.data?.charges?.[0]?.charge_id ?? createdSub?.charges?.[0]?.charge_id;
      log('[SUB] created:', { subscription_id, first_charge_id });
    } catch (e: any) {
      console.error('[EFI][RAW ERROR][SUB]', util.inspect(e, { depth: 10 }));
      const details = {
        code: e?.code,
        error: e?.error,
        errorDescription: e?.errorDescription,
        status: e?.response?.status,
        data: e?.response?.data,
        message: e?.message,
        stack: e?.stack,
        cause: e?.cause,
        config: { url: e?.config?.url, baseURL: e?.config?.baseURL, method: e?.config?.method },
      };
      log('[SUB] ERROR:', details);
      return res.status(500).json({
        error: details.errorDescription || details.error || details.message || 'Falha ao criar assinatura na Efí.',
        stage,
        details,
      });
    }
    if (!subscription_id) {
      return res.status(500).json({ error: 'Assinatura não retornou subscription_id.', stage });
    }

    // 3) Definir método de pagamento
    stage = STAGES.DEFINE_PAY;
    const payBody = {
      payment: {
        credit_card: {
          payment_token,
          billing_address: {
            street:       String(billing_address.street),
            number:       String(billing_address.number),
            neighborhood: String(billing_address.neighborhood),
            zipcode:      String(billing_address.zipcode).replace(/\D/g, ''),
            city:         String(billing_address.city),
            state:        String(billing_address.state).toUpperCase(),
          },
          customer: {
            name:         String(customer.name),
            email:        String(customer.email),
            cpf:          String(customer.cpf).replace(/\D/g, ''),
            phone_number: String(customer.phone_number).replace(/\D/g, ''),
            birth:        String(customer.birth),
          },
        },
      },
    };
    log('[PAY] defineSubscriptionPayMethod body (masked token):', {
      id: subscription_id,
      billing_address: payBody.payment.credit_card.billing_address,
      customer: { ...payBody.payment.credit_card.customer, cpf: mask(payBody.payment.credit_card.customer.cpf) },
      payment_token: mask(payment_token, 6),
    });

    let subsStatus: string = 'pending_payment';
    let charge_id_from_pay: number | undefined;
    try {
      const params = { id: Number(subscription_id) };
      const payResp = await api.defineSubscriptionPayMethod(params, payBody);
      console.log('[EFI][PAY][RAW]', util.inspect(payResp, { depth: 8 }));
      charge_id_from_pay = payResp?.data?.charge_id ?? payResp?.charge_id;
      subsStatus = payResp?.data?.status ?? payResp?.status ?? 'waiting';
      log('[PAY] OK:', { charge_id_from_pay, subsStatus });
    } catch (e: any) {
      console.error('[EFI][RAW ERROR][PAY]', util.inspect(e, { depth: 10 }));
      const details = {
        code: e?.code,
        error: e?.error,
        errorDescription: e?.errorDescription,
        status: e?.response?.status,
        data: e?.response?.data,
        message: e?.message,
        stack: e?.stack,
        cause: e?.cause,
        config: { url: e?.config?.url, baseURL: e?.config?.baseURL, method: e?.config?.method },
      };
      log('[PAY] ERROR:', details);
      return res.status(500).json({
        error: details.errorDescription || details.error || details.message || 'Falha ao definir pagamento.',
        stage,
        details,
      });
    }

    // ----------- GRAVA NO BANCO -----------
    // 2.1 subscriptions (upsert por efi_subscription_id)
    const startedAt = subsStatus === 'active' ? new Date().toISOString() : null;
    await supabase.from('subscriptions').upsert(
      {
        company_id,                     // requer coluna adicionada
        plan_id: plan_uuid,
        efi_subscription_id: String(subscription_id),
        status: subsStatus === 'active' ? 'active' : 'pending_payment',
        started_at: startedAt,
        updated_at: new Date().toISOString(),
        last_charge_id: charge_id_from_pay || first_charge_id || null,
      },
      { onConflict: 'efi_subscription_id' }
    );

    // 2.2 transactions (cobrança do mês ainda "waiting")
    const chargeId = charge_id_from_pay || first_charge_id;
    if (chargeId) {
      await supabase.from('transactions').upsert(
        {
          efi_charge_id: chargeId,
          subscription_id: null,         // se você tiver FK, pode preencher depois via job/join
          status: 'waiting',
          method: 'credit_card',
          amount_cents: itemValue * itemAmount,
          currency: 'BRL',
          response_json: {},             // pode guardar retorno bruto se quiser
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any
      );
    }
    // --------------------------------------

    /* ===================== NOVO: cleanup pós-criação ===================== */
    try {
      await cleanupOldEfiSubscriptions({
        api,
        company_id,
        keepEfiId: subscription_id,
      });
    } catch (e) {
      // só audita; não falha o fluxo de checkout
      try {
        await supabase.from('payment_webhook_log').insert({
          provider: 'efi',
          received_at: new Date().toISOString(),
          event_type: 'cleanup-error',
          body: { company_id, keepEfiId: subscription_id, message: (e as any)?.message || String(e) },
          headers: {},
          ip: '',
        } as any);
      } catch {}
    }
    /* ==================================================================== */

    return res.status(200).json({ subscription_id, charge_id: chargeId, status: subsStatus, stage: STAGES.DEFINE_PAY });
  } catch (e: any) {
    const payload: Fail = {
      error: e?.errorDescription || e?.error || e?.message || 'Erro ao processar assinatura',
      stage: STAGES.INIT,
      details: {
        code: e?.code,
        error: e?.error,
        errorDescription: e?.errorDescription,
        status: e?.response?.status,
        data: e?.response?.data,
        message: e?.message,
        stack: e?.stack,
        cause: e?.cause,
      },
    };
    console.error('[EFI][subscribe] FAIL FINAL:', payload);
    return res.status(500).json(payload);
  }
}
