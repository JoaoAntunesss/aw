# Avisos no Telegram quando chega um orçamento ou pedido de suporte
Precisa do plano Blaze do Firebase (para este volume fica a 0 €). Sem Blaze, usa o aviso por email (EMAILJS em index.html).

1. No Telegram, procura @BotFather, envia /newbot, escolhe um nome e um utilizador terminado em "bot". Ele devolve um token (guarda-o).
2. Abre o teu novo bot e envia-lhe "olá".
3. No browser abre https://api.telegram.org/bot<TOKEN>/getUpdates (troca <TOKEN>). Procura "chat":{"id": NÚMERO. Esse é o teu chat id.
4. No VS Code, na pasta aw: `firebase use aw-sites-e31c3`
5. `firebase functions:secrets:set TELEGRAM_TOKEN` (cola o token) e `firebase functions:secrets:set TELEGRAM_CHAT` (cola o chat id).
6. `cd functions && npm install && cd .. && firebase deploy --only functions`
7. Abre um pedido de suporte no site e vê se chega a mensagem.

## Emails automáticos para o cliente
Quando respondes a um pedido de suporte, envias uma contraproposta, ou aceitas/recusas um orçamento, o cliente recebe um email. Usa o teu Gmail.

1. Na tua conta Google ativa a verificação em dois passos (myaccount.google.com/security).
2. Em myaccount.google.com/apppasswords cria uma palavra-passe de aplicação com o nome "AW" (16 letras). Não é a tua palavra-passe normal.
3. `firebase functions:secrets:set MAIL_USER` (o teu email Gmail) e `firebase functions:secrets:set MAIL_PASS` (as 16 letras, sem espaços).
4. `cd functions && npm install && cd .. && firebase deploy --only functions`
5. Responde a um pedido de suporte de teste feito com um email teu e vê se chega.
Se um dia tiveres domínio próprio, troca para um email com esse domínio (muda MAIL_USER e usa o serviço SMTP desse email).

## Pagamentos dentro do site (Stripe)
O cliente paga a montagem e a mensalidade numa janela do próprio site, com o valor exato que puseste no orçamento.

1. No Stripe: Programadores → Chaves de API. Copia a "Chave secreta" (começa por `sk_test_` em teste, `sk_live_` a sério).
2. `firebase functions:secrets:set STRIPE_SECRET` e cola a chave secreta. Nunca a ponhas no site nem no GitHub.
3. `cd functions && npm install && cd .. && firebase deploy --only functions`
4. A chave pública (`pk_test_…` / `pk_live_…`) vai em `STRIPE_PK` no index.html (essa pode estar no site).
5. Para passar de teste para real: troca as duas chaves (secreta e pública) pelas `live` e volta a fazer o deploy.

### Webhook do Stripe (confirmações automáticas e cancelamentos)
Garante que o pedido fica pago mesmo que o cliente feche a janela, e avisa-te no Telegram quando uma manutenção é cancelada, termina ou falha.
1. No Stripe: Programadores → Webhooks → Adicionar destino. URL: `https://europe-west1-aw-sites-e31c3.cloudfunctions.net/stripeWebhook`
   Eventos: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.paid`.
2. Abre o destino criado e copia o "Segredo de assinatura" (começa por `whsec_`).
3. `firebase functions:secrets:set STRIPE_WEBHOOK_SECRET` e cola-o.
4. `firebase deploy --only functions`
Em modo real repete os passos 1 a 4 no modo real (o webhook e o segredo são diferentes).
