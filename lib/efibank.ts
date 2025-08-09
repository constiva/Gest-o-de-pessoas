interface Customer {
  name: string;
  email: string;
}

export async function createEfibankSubscription(plan: string, customer: Customer) {
  // This function simulates interaction with the Efibank API.
  // Replace with real SDK calls in production.
  console.log('Efibank subscription request', { plan, customer });
  return { id: 'mock-subscription', plan };
}
