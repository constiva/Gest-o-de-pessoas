import EfiPay from 'gn-api-sdk-node';
import fs from 'fs';
import path from 'path';

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

interface Customer {
  name: string;
  email: string;
}

interface Card {
  number: string;
  holder: string;
  expMonth: string;
  expYear: string;
  cvv: string;
}

export async function createEfibankSubscription(
  plan: string,
  customer: Customer,
  card: Card
) {
  logDebug('Starting subscription flow', { plan, customer });
  const efi = getClient();

  const createdPlan = await efi.createPlan({}, {
    name: plan,
    interval: 1,
    repeats: 0
  });
  logDebug('Plan created', createdPlan.data);

  const subscription = await efi.createSubscriptionOneStep(
    { id: createdPlan.data.plan_id },
    {
      customer: { name: customer.name, email: customer.email },
      items: [{ name: 'Assinatura', value: 1000, amount: 1 }],
      payment: {
        credit_card: {
          customer: {
            name: customer.name,
            email: customer.email
          },
          installments: 1,
          card_number: card.number,
          cardholder_name: card.holder,
          exp_month: card.expMonth,
          exp_year: card.expYear,
          security_code: card.cvv
        }
      }
    }
  );
  logDebug('Subscription created', subscription.data);

  return subscription.data;
}

// ---- Admin helpers ----
export async function createPlan(name: string, interval: number, repeats?: number) {
  logDebug('createPlan', { name, interval, repeats });
  const efi = getClient();
  const resp = await efi.createPlan({}, { name, interval, repeats });
  logDebug('createPlan result', resp.data);
  return resp.data;
}

export async function listPlans(params: any = {}) {
  logDebug('listPlans', params);
  const efi = getClient();
  const resp = await efi.listPlans({}, params);
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

export async function cancelSubscription(id: number) {
  logDebug('cancelSubscription', { id });
  const efi = getClient();
  const resp = await efi.cancelSubscription({ id });
  logDebug('cancelSubscription result', resp.data);
  return resp.data;
}
