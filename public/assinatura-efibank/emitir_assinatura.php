<?php
/**
 * Efí (EfiPay) - Checkout Transparente - Assinatura com Cartão
 * Fluxo:
 * 1) (Opcional) Cria o plano se não vier efi_plan_id
 * 2) Cria a assinatura (createSubscription)
 * 3) Define pagamento cartão (defineSubscriptionPayMethod) com payment_token
 * 4) Redireciona para /checkout/confirmacao
 */

ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: text/html; charset=utf-8');

$autoload = realpath(__DIR__ . '/vendor/autoload.php');
if (!file_exists($autoload)) {
  http_response_code(500);
  echo "Autoload não encontrado em: {$autoload}";
  exit;
}
require_once $autoload;

use Efi\EfiPay;
use Efi\Exception\EfiException;

/* --------------------- Helpers --------------------- */

function required($value, $label) {
  if (is_null($value) || $value === '' || (is_array($value) && empty($value))) {
    throw new Exception("Parâmetro obrigatório ausente: {$label}");
  }
  return $value;
}

function post($key, $default = null) {
  return $_POST[$key] ?? $default;
}

function redirect_or_json($ok, $params = []) {
  // Ajuste a rota de confirmação conforme seu app
  $base = '/checkout/confirmacao';
  if ($ok) {
    $qs = http_build_query($params);
    header("Location: {$base}?{$qs}");
    exit;
  }
  // fallback: retorna JSON de erro
  header('Content-Type: application/json');
  echo json_encode($params, JSON_UNESCAPED_UNICODE);
  exit;
}

/* --------------------- Carrega opções Efí --------------------- */

// Você já tem esse padrão em outros arquivos: credentials.json
$credFile = __DIR__ . '/credentials.json';
if (!file_exists($credFile)) {
  http_response_code(500);
  echo "Arquivo credentials.json não encontrado em: {$credFile}";
  exit;
}
$options = json_decode(file_get_contents($credFile), true);
if (!is_array($options)) {
  http_response_code(500);
  echo "credentials.json inválido.";
  exit;
}

/* --------------------- Lê e valida o POST --------------------- */

try {
  if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    throw new Exception('Método não permitido. Use POST.');
  }

  // Dados do plano/empresa vindos do Next (sempre revalidados no servidor)
  $plan_uuid   = required(post('plan_uuid'), 'plan_uuid');
  $plan_slug   = required(post('plan_slug'), 'plan_slug');
  $company_id  = required(post('company_id'), 'company_id');
  $efi_plan_id = post('efi_plan_id'); // opcional

  // Item (assinado todo mês)
  $item_name   = required(post('item')['name']  ?? null, 'item[name]');
  $item_value  = required(post('item')['value'] ?? null, 'item[value]'); // em centavos (inteiro)
  $item_amount = (int) (post('item')['amount'] ?? 1);

  // Metadata (útil para reconciliação no webhook)
  $metadata_custom_id   = post('metadata')['custom_id']       ?? null;
  $metadata_notify_url  = post('metadata')['notification_url'] ?? null;

  // Cliente
  $customer = [
    'name'         => required(post('customer')['name']         ?? null, 'customer[name]'),
    'email'        => required(post('customer')['email']        ?? null, 'customer[email]'),
    'cpf'          => preg_replace('/\D/', '', required(post('customer')['cpf'] ?? null, 'customer[cpf]')),
    'phone_number' => preg_replace('/\D/', '', required(post('customer')['phone_number'] ?? null, 'customer[phone_number]')),
    'birth'        => required(post('customer')['birth'] ?? null, 'customer[birth]'), // YYYY-MM-DD
  ];

  // Endereço de cobrança
  $billing_address = [
    'street'       => required(post('billing_address')['street']      ?? null, 'billing_address[street]'),
    'number'       => required(post('billing_address')['number']      ?? null, 'billing_address[number]'),
    'neighborhood' => required(post('billing_address')['neighborhood']?? null, 'billing_address[neighborhood]'),
    'zipcode'      => preg_replace('/\D/', '', required(post('billing_address')['zipcode'] ?? null, 'billing_address[zipcode]')),
    'city'         => required(post('billing_address')['city']        ?? null, 'billing_address[city]'),
    'state'        => strtoupper(required(post('billing_address')['state'] ?? null, 'billing_address[state]')), // UF
  ];

  // Token do cartão (gerado no front)
  $payment_token = required(post('payment_token'), 'payment_token');

} catch (Exception $e) {
  error_log('[ASSINATURA] Falha de validação POST: ' . $e->getMessage());
  redirect_or_json(false, ['error' => $e->getMessage()]);
}

/* --------------------- Chamada Efí --------------------- */

try {
  $api = new EfiPay($options);

  // 1) Se não veio efi_plan_id, cria um plano na Efí (mensal, recorrência indefinida)
  if (empty($efi_plan_id)) {
    $planBody = [
      'name'     => $item_name, // ou "$plan_slug - $item_name"
      'interval' => 1,          // 1 = mensal
      'repeats'  => null        // null = indefinido (até cancelar)
      // se quiser trial ao nível do plano, algumas contas usam 'trial_days' aqui (verifique no seu ambiente)
    ];
    $createdPlan = $api->createPlan([], $planBody);
    // A SDK normalmente retorna em $createdPlan['data']['plan_id']
    $efi_plan_id = $createdPlan['data']['plan_id'] ?? $createdPlan['plan_id'] ?? null;
    if (!$efi_plan_id) {
      throw new Exception('Não foi possível obter plan_id ao criar plano na Efí.');
    }
  }

  // 2) Cria a assinatura
  $subsBody = [
    'plan_id' => (int)$efi_plan_id,
    'items' => [
      [
        'name'   => $item_name,
        'value'  => (int)$item_value,  // centavos
        'amount' => max(1, (int)$item_amount),
      ]
    ],
  ];
  if ($metadata_custom_id || $metadata_notify_url) {
    $subsBody['metadata'] = [];
    if ($metadata_custom_id)  $subsBody['metadata']['custom_id'] = $metadata_custom_id;
    if ($metadata_notify_url) $subsBody['metadata']['notification_url'] = $metadata_notify_url;
  }

  $createdSub = $api->createSubscription([], $subsBody);
  $subscription_id = $createdSub['data']['subscription_id'] ?? $createdSub['subscription_id'] ?? null;
  if (!$subscription_id) {
    throw new Exception('Não foi possível obter subscription_id ao criar assinatura na Efí.');
  }

  // 3) Define o método de pagamento (cartão com payment_token)
  $payBody = [
    'payment' => [
      'credit_card' => [
        'payment_token'  => $payment_token,
        'billing_address'=> $billing_address,
        'customer'       => $customer
      ]
    ]
  ];
  $params = ['id' => (int)$subscription_id];

  // Nome do método na SDK: defineSubscriptionPayMethod
  $payResp = $api->defineSubscriptionPayMethod($params, $payBody);

  // Em geral, o retorno traz status e/ou charge_id
  $charge_id = $payResp['data']['charge_id'] ?? $payResp['charge_id'] ?? null;
  $status    = $payResp['data']['status'] ?? $payResp['status'] ?? 'waiting';

  // 4) Redireciona para página de confirmação
  redirect_or_json(true, [
    'subscription_id' => $subscription_id,
    'charge_id'       => $charge_id,
    'status'          => $status,
    'plan_slug'       => $plan_slug,
    'company_id'      => $company_id
  ]);

} catch (EfiException $e) {
  // Erro de API Efí
  $err = [
    'code'        => $e->code ?? null,
    'error'       => $e->error ?? 'EfiError',
    'description' => $e->errorDescription ?? 'Erro na Efí',
  ];
  error_log('[ASSINATURA][EFI] ' . json_encode($err, JSON_UNESCAPED_UNICODE));
  redirect_or_json(false, [
    'error'   => 'Erro Efí: ' . ($err['description'] ?: $err['error']),
    'code'    => $err['code'],
    'details' => $err
  ]);

} catch (Exception $e) {
  error_log('[ASSINATURA][EXC] ' . $e->getMessage());
  redirect_or_json(false, ['error' => $e->getMessage()]);
}
