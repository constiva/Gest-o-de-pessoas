// types/efipay.d.ts
export {};

declare global {
  interface Window {
    EfiPay?: typeof EfiPay;
  }
}

declare namespace EfiPay {
  namespace CreditCard {
    function setEnvironment(env: 'production' | 'sandbox'): typeof CreditCard;
    function setCardNumber(cardNumber: string): typeof CreditCard;
    function verifyCardBrand(): Promise<string>;
    function setAccount(accountIdentifier: string): typeof CreditCard;
    function setBrand(brand: string): typeof CreditCard;
    function setTotal(total: number): typeof CreditCard;
    function getInstallments(): Promise<InstallmentsResponse | ErrorResponse>;
    function setCreditCardData(data: CreditCardData): typeof CreditCard;
    function getPaymentToken(): Promise<PaymentTokenResponse | ErrorResponse>;

    // Alguns builds têm esse método; deixe opcional
    function isScriptBlocked?(): Promise<boolean>;

    interface Installment {
      installment: number;
      has_interest: boolean;
      value: number;        // em centavos
      currency: string;     // 'BRL'
      interest_percentage: number;
    }

    interface InstallmentsResponse {
      rate: number;
      name: string;
      installments: Installment[];
    }

    interface ErrorResponse {
      code: string;
      error: string;
      error_description: string;
    }

    interface CreditCardData {
      brand: string;
      number: string;
      cvv: string;
      expirationMonth: string;
      expirationYear: string;
      holderName: string;
      holderDocument: string; // CPF
      reuse: boolean;
    }

    interface PaymentTokenResponse {
      payment_token: string;
      card_mask: string;
    }
  }
}
