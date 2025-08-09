import EfiPay from 'gn-api-sdk-node';
import fs from 'fs';
import path from 'path';

const DEBUG_PATH = path.join(process.cwd(), 'debugCheckout.txt');

function logDebug(msg: string, data?: unknown) {
  const line = `[${new Date().toISOString()}] ${msg}` +
    (data ? ` ${JSON.stringify(data)}` : '') + '\n';
  fs.appendFileSync(DEBUG_PATH, line);
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
  const certEnv = process.env.EFIBANK_CERTIFICATE_PATH;
  const certPath = certEnv ? path.resolve(certEnv) : '';
  if (!certPath || !fs.existsSync(certPath)) {
    const msg = `Efibank certificate not found at "${certEnv}"`;
    logDebug(msg);
    throw new Error(msg);
  }
  const efi = new EfiPay({
    client_id: process.env.EFIBANK_CLIENT_ID,
    client_secret: process.env.EFIBANK_CLIENT_SECRET,
    certificate: fs.readFileSync(certPath),
    sandbox: true
  });

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
