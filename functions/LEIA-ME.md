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
