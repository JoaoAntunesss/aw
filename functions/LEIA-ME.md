# Avisos no WhatsApp quando chega um orçamento ou pedido de suporte

Precisa do plano Blaze do Firebase (pagas só o que usares; para este volume fica em 0 €).

1. No WhatsApp, segue as instruções de callmebot.com (WhatsApp) para o ativar: guarda o contacto que o site indica e envia-lhe: `I allow callmebot to send me messages`. Recebes uma chave (apikey).
2. No VS Code, na pasta do projeto `aw` (onde está o firebase.json), liga o projeto: `firebase use aw-sites-e31c3`.
3. Guarda os segredos (o terminal pergunta o valor):
   - `firebase functions:secrets:set CALLMEBOT_PHONE`  (o teu número com indicativo, sem +, ex.: 351912345678)
   - `firebase functions:secrets:set CALLMEBOT_KEY`  (a apikey)
4. Instala e publica: `cd functions && npm install && cd .. && firebase deploy --only functions`.
5. Testa: abre um pedido de suporte no site e vê se chega a mensagem.
