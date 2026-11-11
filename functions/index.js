/* Avisos para o João quando chega um orçamento ou um pedido de suporte (Telegram).
   Configuração em functions/LEIA-ME.md */
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const nodemailer = require("nodemailer");
const { defineSecret } = require("firebase-functions/params");
const TG_TOKEN = defineSecret("TELEGRAM_TOKEN");
const TG_CHAT = defineSecret("TELEGRAM_CHAT");
const MAIL_USER = defineSecret("MAIL_USER");
const MAIL_PASS = defineSecret("MAIL_PASS");

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


/* ---- Emails para o cliente quando respondes ---- */
const SITE = "https://joaoantunesss.github.io/aw/";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const mailOpts = { secrets: [MAIL_USER, MAIL_PASS], region: "europe-west1" };

async function enviarEmail(para, assunto, linhas, botao) {
  if (!para || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(para)) return;
  const user = MAIL_USER.value();
  const t = nodemailer.createTransport({ service: "gmail", auth: { user, pass: MAIL_PASS.value() } });
  const texto = linhas.join("\n\n") + `\n\n${botao}: ${SITE}#conta\n\nJoão Antunes, AW`;
  const html = `<div style="font:16px/1.5 system-ui,Arial,sans-serif;color:#0B1220;max-width:34rem">${linhas.map((l) => `<p>${esc(l).replace(/\n/g, "<br>")}</p>`).join("")}<p><a href="${SITE}#conta" style="display:inline-block;background:#2547F5;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">${esc(botao)}</a></p><p style="color:#4A5568">João Antunes, AW</p></div>`;
  try { await t.sendMail({ from: `"AW, João Antunes" <${user}>`, to: para, replyTo: user, subject: assunto, text: texto, html }); }
  catch (e) { console.error("Email falhou", e.message); }
}

exports.respostaSuporte = onDocumentUpdated({ ...mailOpts, document: "suporte/{id}" }, async (ev) => {
  const a = ev.data?.before?.data() || {}, d = ev.data?.after?.data() || {};
  const respostaNova = d.resposta && d.resposta !== a.resposta, resolvido = d.estado === "resolvido" && a.estado !== "resolvido";
  if (!respostaNova && !resolvido) return;
  const ola = `Olá ${cortar(d.nome, 40) || ""}`.trim() + ",";
  const linhas = [ola, respostaNova ? `Respondi ao teu pedido de suporte (${cortar(d.site, 60)}: ${cortar(d.tipo, 60)}).` : `O teu pedido de suporte (${cortar(d.site, 60)}: ${cortar(d.tipo, 60)}) ficou resolvido.`];
  if (respostaNova) linhas.push(`A minha resposta:\n${cortar(d.resposta, 1500)}`);
  await enviarEmail(d.email, "AW: respondi ao teu pedido de suporte", linhas, "Ver na minha conta");
});

exports.respostaOrcamento = onDocumentUpdated({ ...mailOpts, document: "pedidos/{id}" }, async (ev) => {
  const a = ev.data?.before?.data() || {}, d = ev.data?.after?.data() || {};
  if (d.estado === a.estado) return;
  const r = d.respostas || {}, o = d.orcamento || {}, ola = `Olá ${cortar(d.nome, 40) || ""}`.trim() + ",", nome = cortar(r.negocio, 60);
  if (d.estado === "orcamento-enviado") {
    const l = [ola, `Analisei a tua proposta para ${nome} e enviei-te uma contraproposta.`, `Montagem: ${o.valor ?? "a definir"} €${o.mensal != null ? `\nManutenção: ${o.mensal} € por mês` : ""}${o.prazo ? `\nPrazo: ${cortar(o.prazo, 80)}` : ""}`];
    if (o.mensagem) l.push(`Nota minha:\n${cortar(o.mensagem, 1000)}`);
    l.push("Podes aceitar ou recusar na tua conta.");
    return enviarEmail(d.email, "AW: tens uma contraproposta", l, "Ver a contraproposta");
  }
  // aceite ou recusado por mim (se vinha de uma contraproposta, foi o cliente que decidiu e não envio nada)
  if (a.estado === "orcamento-enviado") return;
  if (d.estado === "aceite") return enviarEmail(d.email, "AW: aceitei a tua proposta", [ola, `Aceitei a tua proposta para ${nome}. Entro em contacto contigo para combinarmos os próximos passos.`], "Ver na minha conta");
  if (d.estado === "recusado") return enviarEmail(d.email, "AW: sobre a tua proposta", [ola, `Obrigado pelo interesse. Desta vez não consegui avançar com a proposta para ${nome}. Se quiseres, podes enviar outra com valores diferentes.`], "Ver na minha conta");
});


/* ---- Pagamentos dentro do site (Stripe Embedded Checkout) ----
   O valor vem sempre do pedido guardado no Firestore (o cliente não o consegue mudar).
   Configuração em functions/LEIA-ME.md, secção "Pagamentos". */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
if (!admin.apps.length) admin.initializeApp();
const STRIPE_SECRET = defineSecret("STRIPE_SECRET");
const payOpts = { secrets: [STRIPE_SECRET], region: "europe-west1", maxInstances: 5 };
const confOpts = { secrets: [STRIPE_SECRET, TG_TOKEN, TG_CHAT], region: "europe-west1", maxInstances: 5 };
const stripeDe = () => require("stripe")(STRIPE_SECRET.value());

async function pedidoDoCliente(req, pedidoId) {
  if (!req.auth) throw new HttpsError("unauthenticated", "Entra na tua conta para pagar.");
  if (typeof pedidoId !== "string" || !pedidoId || pedidoId.length > 200) throw new HttpsError("invalid-argument", "Pedido inválido.");
  const ref = admin.firestore().collection("pedidos").doc(pedidoId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Pedido não encontrado.");
  const p = snap.data();
  if (p.uid !== req.auth.uid) throw new HttpsError("permission-denied", "Este pedido não é teu.");
  return { ref, p };
}
const valorDe = (p, tipo) => {
  const o = p.orcamento || {}, r = p.respostas || {};
  return Number(tipo === "mensal" ? (o.mensal ?? r.budgetMensal) : (o.valor ?? r.budgetMontagem)) || 0;
};

exports.pagamentoIniciar = onCall(payOpts, async (req) => {
  const { pedidoId, tipo } = req.data || {};
  if (tipo !== "montagem" && tipo !== "mensal") throw new HttpsError("invalid-argument", "Tipo de pagamento inválido.");
  const { p } = await pedidoDoCliente(req, pedidoId);
  if (p.estado !== "aceite") throw new HttpsError("failed-precondition", "O orçamento ainda não foi aceite.");
  const g = p.pagamento || {};
  if (tipo === "montagem" && g.montagemPaga) throw new HttpsError("failed-precondition", "A montagem já está paga.");
  if (tipo === "mensal" && g.mensalAtiva) throw new HttpsError("failed-precondition", "A mensalidade já está ativa.");
  const valor = valorDe(p, tipo);
  if (!(valor >= 1 && valor <= 20000)) throw new HttpsError("failed-precondition", "Este pedido ainda não tem valor definido.");
  const negocio = cortar((p.respostas || {}).negocio, 60);
  const mensal = tipo === "mensal";
  const ses = await stripeDe().checkout.sessions.create({
    ui_mode: "embedded",
    redirect_on_completion: "never",
    mode: mensal ? "subscription" : "payment",
    locale: "pt",
    customer_email: p.email || undefined,
    client_reference_id: pedidoId,
    metadata: { pedidoId, tipo },
    ...(mensal ? { subscription_data: { metadata: { pedidoId } } } : { payment_intent_data: { metadata: { pedidoId, tipo } } }),
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "eur",
        unit_amount: Math.round(valor * 100),
        ...(mensal ? { recurring: { interval: "month" } } : {}),
        product_data: { name: mensal ? `Manutenção do site${negocio ? ": " + negocio : ""}` : `Montagem do site${negocio ? ": " + negocio : ""}` }
      }
    }]
  });
  return { clientSecret: ses.client_secret, sessionId: ses.id };
});

exports.pagamentoConfirmar = onCall(confOpts, async (req) => {
  const { sessionId } = req.data || {};
  if (typeof sessionId !== "string" || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) throw new HttpsError("invalid-argument", "Sessão inválida.");
  const ses = await stripeDe().checkout.sessions.retrieve(sessionId);
  const { pedidoId, tipo } = ses.metadata || {};
  const { ref, p } = await pedidoDoCliente(req, pedidoId);
  const pago = ses.status === "complete" && (ses.payment_status === "paid" || ses.payment_status === "no_payment_required");
  if (!pago) return { ok: false };
  const patch = { atualizadoEm: admin.firestore.FieldValue.serverTimestamp() };
  if (tipo === "mensal") { patch["pagamento.mensalAtiva"] = true; patch["pagamento.stripeSubscricao"] = String(ses.subscription || ""); }
  else { patch["pagamento.montagemPaga"] = true; patch["pagamento.stripePagamento"] = String(ses.payment_intent || ""); }
  const g = p.pagamento || {}, jaEstava = tipo === "mensal" ? g.mensalAtiva : g.montagemPaga;
  await ref.update(patch);
  if (!jaEstava) {
    const valor = (ses.amount_total || 0) / 100;
    try { await avisar(`AW: pagamento recebido 💶\n${cortar((p.respostas || {}).negocio, 60)} (${cortar(p.nome, 40)})\n${tipo === "mensal" ? "Mensalidade ativada" : "Montagem paga"}: ${valor.toFixed(2)} €${tipo === "mensal" ? "/mês" : ""}\nhttps://joaoantunesss.github.io/aw/#gestao`); }
    catch (e) { console.error("aviso de pagamento falhou", e); }
  }
  return { ok: true };
});
