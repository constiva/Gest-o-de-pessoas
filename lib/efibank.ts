import EfiPay from 'gn-api-sdk-node';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const DEBUG_PATH = path.join(process.cwd(), 'debugCheckout.txt');

export function logDebug(msg: string, data?: unknown) {
  const safe = data instanceof Error
    ? { message: data.message, stack: data.stack }
    : data;
  const line = `[${new Date().toISOString()}] ${msg}` +
    (safe ? ` ${JSON.stringify(safe)}` : '') + '\n';
  fs.appendFileSync(DEBUG_PATH, line);
}

function getClient() {
  const certEnv = process.env.EFIBANK_CERTIFICATE_PATH;
  const certPath = certEnv ? path.resolve(certEnv) : '';
  if (!certPath || !fs.existsSync(certPath)) {
    const msg = `Efibank certificate not found at "${certEnv}"`;
    logDebug(msg);
    throw new Error(msg);
  }
  return new EfiPay({
    client_id: process.env.EFIBANK_CLIENT_ID,
    client_secret: process.env.EFIBANK_CLIENT_SECRET,
    certificate: fs.readFileSync(certPath),
    sandbox: true
  });
}

const execFileAsync = promisify(execFile);

export async function createEfibankSubscription(payload: any) {
  logDebug('Starting subscription via PHP', payload);
  const { stdout } = (await execFileAsync(
    'php',
    ['assinatura-efibank/emitir_assinatura.php'],
    {
      input: JSON.stringify(payload),
      maxBuffer: 1024 * 1024,
      encoding: 'utf8'
    } as any
  )) as unknown as { stdout: string };
  logDebug('PHP subscription output', stdout);
  return JSON.parse(stdout);
}

// ---- Admin helpers ----
export async function createPlan(name: string, interval: number, repeats?: number) {
  logDebug('createPlan', { name, interval, repeats });
  const efi = getClient();
  const body: any = { name, interval };
  if (typeof repeats === 'number' && repeats >= 2) {
    body.repeats = repeats;
  }
  const resp = await efi.createPlan({}, body);
  logDebug('createPlan result', resp.data);
  return resp.data;
}

export async function listPlans(params: any = {}) {
  logDebug('listPlans', params);
  const efi = getClient();
  const resp = await efi.getPlans({}, params);
  logDebug('listPlans result', resp.data);
  return resp.data;
}

export async function updatePlan(id: number, name: string) {
  logDebug('updatePlan', { id, name });
  const efi = getClient();
  const resp = await efi.updatePlan({ id }, { name });
  logDebug('updatePlan result', resp.data);
  return resp.data;
}

export async function cancelPlan(id: number) {
  logDebug('cancelPlan', { id });
  const efi = getClient();
  const resp = await efi.deletePlan({ id });
  logDebug('cancelPlan result', resp.data);
  return resp.data;
}

export async function createSubscription(planId: number, items: any[]) {
  logDebug('createSubscription', { planId, items });
  const efi = getClient();
  const resp = await efi.createSubscription({ id: planId }, { items });
  logDebug('createSubscription result', resp.data);
  return resp.data;
}

export async function paySubscription(subId: number, payload: any) {
  logDebug('paySubscription', { subId, payload });
  const efi = getClient();
  const resp = await efi.paySubscription({ id: subId }, payload);
  logDebug('paySubscription result', resp.data);
  return resp.data;
}

export async function getSubscription(subId: number) {
  logDebug('getSubscription', { subId });
  const efi = getClient();
  const resp = await efi.detailSubscription({ id: subId });
  logDebug('getSubscription result', resp.data);
  return resp.data;
}

export async function listCharges(params: any) {
  logDebug('listCharges', params);
  const efi = getClient();
  const resp = await efi.listCharges({}, params);
  logDebug('listCharges result', resp.data);
  return resp.data;
}

export async function retryCharge(id: number, payload: any) {
  logDebug('retryCharge', { id, payload });
  const efi = getClient();
  const resp = await efi.retrySubscriptionCharge({ id }, payload);
  logDebug('retryCharge result', resp.data);
  return resp.data;
}

export async function updateSubscription(id: number, body: any) {
  logDebug('updateSubscription', { id, body });
  const efi = getClient();
  const resp = await efi.updateSubscription({ id }, body);
  logDebug('updateSubscription result', resp.data);
  return resp.data;
}

export async function updateSubscriptionMetadata(id: number, body: any) {
  logDebug('updateSubscriptionMetadata', { id, body });
  const efi = getClient();
  const resp = await efi.updateSubscriptionMetadata({ id }, body);
  logDebug('updateSubscriptionMetadata result', resp.data);
  return resp.data;
}

export async function cancelSubscription(id: number) {
  logDebug('cancelSubscription', { id });
  const efi = getClient();
  const resp = await efi.cancelSubscription({ id });
  logDebug('cancelSubscription result', resp.data);
  return resp.data;
}
