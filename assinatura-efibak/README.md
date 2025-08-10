# Fluxo de Assinatura Efibank

Este diretório contém um exemplo simples de como criar planos e assinaturas usando a API da Efibank. O processo geral segue três etapas:

1. **Criar o plano** (`POST /v1/plan`) definindo `name`, `interval` (em meses) e opcionalmente `repeats`.
2. **Criar a assinatura** vinculada ao plano (`POST /v1/plan/:id/subscription`), informando os itens que serão cobrados.
3. **Definir a forma de pagamento** da assinatura (`POST /v1/subscription/:id/pay`) com dados do cliente e cartão ou boleto.

Consulte `checkout.txt` na raiz do projeto para instruções de uso no código.
