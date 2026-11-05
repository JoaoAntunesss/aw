/* Avisos para o João quando chega um orçamento ou um pedido de suporte (Telegram).
   Configuração em functions/LEIA-ME.md */
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const TG_TOKEN = defineSecret("TELEGRAM_TOKEN");
const TG_CHAT = defineSecret("TELEGRAM_CHAT");

async function avisar(texto) {
  const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN.value()}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TG_CHAT.value(), text: texto, disable_web_page_preview: true })
  });
  if (!r.ok) console.error("Telegram falhou", r.status, await r.text());
}
const cortar = (s, n) => String(s || "").slice(0, n);
const opts = { secrets: [TG_TOKEN, TG_CHAT], region: "europe-west1" };

exports.novoPedido = onDocumentCreated({ ...opts, document: "pedidos/{id}" }, async (ev) => {
  const p = ev.data?.data() || {}, r = p.respostas || {};
  await avisar(`AW: novo orçamento\n${cortar(r.negocio, 60)} (${cortar(p.template, 20)})\n${cortar(p.nome, 40)} · ${cortar(p.telefone || p.email, 40)}\nProposta: ${r.budgetMontagem ?? "?"} € + ${r.budgetMensal ?? "?"} €/mês\nhttps://joaoantunesss.github.io/aw/#gestao`);
});
exports.novoSuporte = onDocumentCreated({ ...opts, document: "suporte/{id}" }, async (ev) => {
  const p = ev.data?.data() || {};
  await avisar(`AW: novo pedido de suporte\n${cortar(p.site, 60)}: ${cortar(p.tipo, 60)}\n${cortar(p.nome, 40)} · ${cortar(p.telefone || p.email, 40)}\n${cortar(p.descricao, 200)}\nhttps://joaoantunesss.github.io/aw/#gestao`);
});
