/* Avisos para o João quando chega um orçamento ou um pedido de suporte.
   Envia WhatsApp via CallMeBot (grátis). Configuração em functions/LEIA-ME.md */
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const CALLMEBOT_PHONE = defineSecret("CALLMEBOT_PHONE");   // ex.: 351912345678
const CALLMEBOT_KEY = defineSecret("CALLMEBOT_KEY");

async function avisar(texto) {
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(CALLMEBOT_PHONE.value())}&apikey=${encodeURIComponent(CALLMEBOT_KEY.value())}&text=${encodeURIComponent(texto)}`;
  const r = await fetch(url);
  if (!r.ok) console.error("CallMeBot falhou", r.status, await r.text());
}
const cortar = (s, n) => String(s || "").slice(0, n);

exports.novoPedido = onDocumentCreated({ document: "pedidos/{id}", secrets: [CALLMEBOT_PHONE, CALLMEBOT_KEY], region: "europe-west1" }, async (ev) => {
  const p = ev.data?.data() || {}, r = p.respostas || {};
  await avisar(`AW: novo orçamento\n${cortar(r.negocio, 60)} (${cortar(p.template, 20)})\n${cortar(p.nome, 40)} · ${cortar(p.telefone || p.email, 40)}\nProposta: ${r.budgetMontagem ?? "?"} € + ${r.budgetMensal ?? "?"} €/mês\nhttps://joaoantunesss.github.io/aw/#gestao`);
});
exports.novoSuporte = onDocumentCreated({ document: "suporte/{id}", secrets: [CALLMEBOT_PHONE, CALLMEBOT_KEY], region: "europe-west1" }, async (ev) => {
  const p = ev.data?.data() || {};
  await avisar(`AW: novo pedido de suporte\n${cortar(p.site, 60)}: ${cortar(p.tipo, 60)}\n${cortar(p.nome, 40)} · ${cortar(p.telefone || p.email, 40)}\n${cortar(p.descricao, 200)}\nhttps://joaoantunesss.github.io/aw/#gestao`);
});
