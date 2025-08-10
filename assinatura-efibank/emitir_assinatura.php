<?php

$autoload = realpath(__DIR__ . '/vendor/autoload.php');
if (!file_exists($autoload)) {
    die("Autoload file not found or on path <code>$autoload</code>.");
}
require_once $autoload;
 
use Efi\Exception\EfiException;
use Efi\EfiPay;

// Lê o arquivo json com suas credenciais
$file = file_get_contents(__DIR__ . '/credentials.json');
$options = json_decode($file, true);

//recebendo os parâmetros pelo POST
$plano = $_POST['plano'];
$cliente = $_POST['customer'];
$dataDeVencimento = isset($_POST['expire_at']) ? $_POST['expire_at'] : null;
$item = $_POST['item'];
$payment_token = isset($_POST['payment_token']) ? $_POST['payment_token'] : null;
$endereco = isset($_POST['billing_address']) ? $_POST['billing_address'] : null;

//corpo da requição(informações sobre o plano de assinatura)
$body_plan = [
	'name' => $plano['descricao'], // nome do plano de assinatura
	'interval' => intval($plano['interval']), // periodicidade da cobrança. Determina o intervalo, em meses, que a cobrança da assinatura deve ser gerada. Informe 1 para assinatura mensal.
];

//recebe um plano criado
$novoPlano = criarPlano($options, $body_plan);

/**
 * Método reponsável por criar um plano, caso seja bem sucedido retornará o plano criado
 * @return plan
 */
function criarPlano($options, $body_plan)
{
	try {
		$api = new EfiPay($options);
		$plan = $api->createPlan($params = [], $body_plan);
		return $plan['data'];
	} catch (EfiException $e) {
		echo "Criar Plano";
		print_r($e->code);
		print_r($e->error);
		print_r($e->errorDescription);
	} catch (Exception $e) {
		echo "Criar Plano";
		print_r($e->getMessage());
	}
}

//produto ou serviço da assinatura
$item_1 = [
	'name' => $item['name'],
	'amount' => intval($item['amount']),
	'value' => intval($item['value'])
];

// array de produtos ou seviços
$items = [
	$item_1
];

//corpo da requisição(array de produtos ou serviços)
$body_signature = [
	'items' => $items
];

//id do plano criado
$params_signature = ['id' => (int) $novoPlano['plan_id']];



$novaAssinatura = associarAssinaturaAPlano($options, $params_signature, $body_signature);

/**
 * Método responsável por criar e inscrever uma assinatura em um plano já criado, caso bem sucedido retorna a assinatura criado
 * @return subscription
 */
function associarAssinaturaAPlano($options, $params_signature, $body_signature)
{
	try {
		$api = new EfiPay($options);
		$subscription = $api->createSubscription($params_signature, $body_signature);
		return $subscription['data'];
	} catch (EfiException $e) {
		echo "Associar Assinatura";
		print_r($e->code);
		print_r($e->error);
		print_r($e->errorDescription);
	} catch (Exception $e) {
		echo "Associar Assinatura";
		print_r($e->getMessage());
	}
}

//id do assinatura criada
$params_subscription = ['id' => (int) $novaAssinatura["subscription_id"]];


// informações do cliente
$customer = [
	'name' => $cliente['name'],
	'cpf' => (string) $cliente['cpf'],
	'phone_number' => (string) $cliente['phone_number']
];

//verifica se o $payment_token existe caso verdadeiro o pagamento e para cartão se não boleto
if ($payment_token) {
	$customer['email'] = $cliente['email'];
	$customer['birth'] = $cliente['birth'];
	//Informações sobre o endereço
	$billing_address = [
		'street' => $endereco['street'],
		'number' => (string) $endereco['number'],
		'neighborhood' => $endereco['neighborhood'],
		'zipcode' => (string) $endereco['zipcode'],
		'city' => $endereco['city'],
		'state' => $endereco['state']
	];


	$creditCard = [
		'billing_address' => $billing_address,
		'payment_token' => $payment_token,
		'customer' => $customer
	];

	$payment = [
		'credit_card' => $creditCard
	];

	$body = [
		'payment' => $payment
	];

	try {

		$api = new EfiPay($options);
		$charge = $api->defineSubscriptionPayMethod($params_subscription, $body);
		echo json_encode($charge);
	} catch (EfiException $e) {
		echo "Pagamento com Cartão\n";
		print_r($e->code);
		print_r($e->error);
		print_r($e->errorDescription);
	} catch (Exception $e) {
		echo "Pagamento com Cartão\n";
		print_r($e->getMessage());
	}
} else {
	$banking_billet = [
		'expire_at' => $dataDeVencimento,
		'customer' => $customer
	];

	$payment = [
		'banking_billet' => $banking_billet
	];

	$body = [
		'payment' => $payment
	];

	try {

		$api = new EfiPay($options);
		$charge = $api->defineSubscriptionPayMethod($params_subscription, $body);
		echo json_encode($charge);
	} catch (EfiException $e) {
		echo "Pagamento com Boleto\n";
		print_r($e->code);
		print_r($e->error);
		print_r($e->errorDescription);
	} catch (Exception $e) {
		echo "Pagamento com Boleto\n";
		print_r($e->getMessage());
	}
}
