# Avisos no Telegram quando chega um orçamento ou pedido de suporte
Precisa do plano Blaze do Firebase (para este volume fica a 0 €). Sem Blaze, usa o aviso por email (EMAILJS em index.html).

1. No Telegram, procura @BotFather, envia /newbot, escolhe um nome e um utilizador terminado em "bot". Ele devolve um token (guarda-o).
2. Abre o teu novo bot e envia-lhe "olá".
3. No browser abre https://api.telegram.org/bot<TOKEN>/getUpdates (troca <TOKEN>). Procura "chat":{"id": NÚMERO. Esse é o teu chat id.
4. No VS Code, na pasta aw: `firebase use aw-sites-e31c3`
5. `firebase functions:secrets:set TELEGRAM_TOKEN` (cola o token) e `firebase functions:secrets:set TELEGRAM_CHAT` (cola o chat id).
6. `cd functions && npm install && cd .. && firebase deploy --only functions`
7. Abre um pedido de suporte no site e vê se chega a mensagem.
