// types/efipay.d.ts
export {};

declare global {
  interface Window {
    EfiPay?: EfiPayGlobal;
  }
}

interface EfiPayCreditCard {
  setAccount(accountId: string): EfiPayCreditCard;
  setEnvironment(env: 'sandbox' | 'production'): EfiPayCreditCard;
  setCreditCardData(data: {
    brand: string;
    number: string;
    cvv: string;
    expirationMonth: string;
    expirationYear: string;
    holderName: string;
    holderDocument: string;
    reuse?: boolean;
  }): EfiPayCreditCard;
  getPaymentToken(): Promise<{
    payment_token?: string;
    error?: string;
    error_description?: string;
  }>;

  // método opcional (alguns builds do UMD expõem isso)
  isScriptBlocked?: () => Promise<boolean>;
}

interface EfiPayGlobal {
  CreditCard: EfiPayCreditCard;
}

// silencia tipos dos SDKs no lado do servidor
declare module 'sdk-node-apis-efi' {
  const EfiPay: any;
  export default EfiPay;
}
declare module 'sdk-typescript-apis-efi' {
  const EfiPay: any;
  export default EfiPay;
}
