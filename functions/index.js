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
  await avisar(`AW: novo orçamento\n${cortar(r.negocio, 60)} (${cortar(p.template, 20)})\n${cortar(p.nome, 40)} · ${cortar(p.telefone || p.email, 40)}\nProposta: ${r.budgetMontagem ?? "?"} € + ${r.budgetMensal ?? "?"} €/mês\nhttps://awdigital.pt/#gestao`);
});
exports.novoSuporte = onDocumentCreated({ ...opts, document: "suporte/{id}" }, async (ev) => {
  const p = ev.data?.data() || {};
  await avisar(`AW: novo pedido de suporte\n${cortar(p.site, 60)}: ${cortar(p.tipo, 60)}\n${cortar(p.nome, 40)} · ${cortar(p.telefone || p.email, 40)}\n${cortar(p.descricao, 200)}\nhttps://awdigital.pt/#gestao`);
});


/* ---- Emails para o cliente quando respondes ---- */
const SITE = "https://awdigital.pt/";
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
  if (d.estado === "aceite") {
    const mont = o.valor ?? r.budgetMontagem, mens = o.mensal ?? r.budgetMensal;
    const valores = `Montagem: ${mont ?? "a definir"} €${mens && Number(mens) > 0 ? `\nManutenção: ${mens} € por mês` : ""}`;
    return enviarEmail(d.email, "AW: aceitei a tua proposta", [ola, `Aceitei a tua proposta para ${nome}.`, valores, "Na tua conta já tens o botão para pagar, de forma segura (cartão ou MB WAY). Assim que pagares, começo o teu site e entro em contacto contigo."], "Pagar na minha conta");
  }
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

/* Movimentos que aparecem no painel ("Últimos movimentos"). */
async function evento(tipo, texto, pedidoId) {
  try { await admin.firestore().collection("eventos").add({ tipo, texto: cortar(texto, 300), pedidoId: pedidoId || "", criadoEm: admin.firestore.FieldValue.serverTimestamp() }); }
  catch (e) { console.error("evento", e); }
}
/* Ficha de cliente ligada ao pedido: criada quando paga a montagem, atualizada pela mensalidade. */
async function fichaCliente(pedidoId, p, extra) {
  const col = admin.firestore().collection("clientes");
  const q = await col.where("pedidoId", "==", pedidoId).limit(1).get();
  const now = admin.firestore.FieldValue.serverTimestamp();
  if (q.empty) {
    const o = p.orcamento || {}, r = p.respostas || {};
    await col.add({ nome: cortar(r.negocio || p.nome, 120), contacto: cortar(p.nome, 120), email: cortar(p.email, 200), telefone: cortar(p.telefone, 40),
      site: cortar(r.negocio, 120), url: p.siteUrl || "", template: p.template || "", plano: "", montagem: Number(o.valor ?? r.budgetMontagem) || 0,
      mensal: 0, inicio: new Date().toISOString().slice(0, 10), renovacao: "", estado: "ativo", notas: "Criada automaticamente quando pagou.", montagemPaga: false,
      pedidoId, criadoEm: now, atualizadoEm: now, ...extra });
  } else await q.docs[0].ref.update({ ...extra, atualizadoEm: now });
}
const fimPeriodo = (sub) => sub?.current_period_end || sub?.items?.data?.[0]?.current_period_end || null;

/* Marca o pedido como pago (uma só vez) e avisa-me. Usado pelo site e pelo webhook. */
async function marcarPago(pedidoId, tipo, ses) {
  const ref = admin.firestore().collection("pedidos").doc(pedidoId);
  const mudou = await admin.firestore().runTransaction(async (t) => {
    const snap = await t.get(ref); if (!snap.exists) return null;
    const p = snap.data(), g = p.pagamento || {};
    if (tipo === "mensal" ? g.mensalAtiva : g.montagemPaga) return null;
    const patch = { atualizadoEm: admin.firestore.FieldValue.serverTimestamp() };
    if (tipo === "mensal") Object.assign(patch, { "pagamento.mensalAtiva": true, "pagamento.mensalCancelada": false, "pagamento.mensalFalhou": false, "pagamento.mensalFim": null, "pagamento.stripeSubscricao": String(ses.subscription || ""), "pagamento.stripeCliente": String(ses.customer || "") });
    else Object.assign(patch, { "pagamento.montagemPaga": true, "pagamento.stripePagamento": String(ses.payment_intent || "") });
    t.update(ref, patch); return p;
  });
  if (mudou) {
    const valor = (ses.amount_total || 0) / 100;
    const negocio = cortar((mudou.respostas || {}).negocio || mudou.nome, 60);
    await evento(tipo, `${negocio}: ${tipo === "mensal" ? "mensalidade ativada" : "montagem paga"}, ${valor.toFixed(2)} €${tipo === "mensal" ? "/mês" : ""}`, pedidoId);
    try {
      if (tipo === "mensal") {
        let prox = null; try { const sub = await stripeDe().subscriptions.retrieve(String(ses.subscription)); prox = fimPeriodo(sub); } catch (e) { console.error(e); }
        if (prox) await ref.update({ "pagamento.mensalProxima": prox * 1000 });
        await fichaCliente(pedidoId, mudou, { mensal: valor, estado: "ativo" });
      } else await fichaCliente(pedidoId, mudou, { montagemPaga: true });
    } catch (e) { console.error("ficha de cliente", e); }
    try { await avisar(`AW: pagamento recebido 💶\n${cortar((mudou.respostas || {}).negocio, 60)} (${cortar(mudou.nome, 40)})\n${tipo === "mensal" ? "Mensalidade ativada" : "Montagem paga"}: ${valor.toFixed(2)} €${tipo === "mensal" ? "/mês" : ""}\nhttps://awdigital.pt/#gestao`); }
    catch (e) { console.error("aviso de pagamento falhou", e); }
  }
}
const pago = (ses) => ses.status === "complete" && (ses.payment_status === "paid" || ses.payment_status === "no_payment_required");
const dataPT = (unix) => new Date(unix * 1000).toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Lisbon" });

exports.pagamentoConfirmar = onCall(confOpts, async (req) => {
  const { sessionId } = req.data || {};
  if (typeof sessionId !== "string" || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) throw new HttpsError("invalid-argument", "Sessão inválida.");
  const ses = await stripeDe().checkout.sessions.retrieve(sessionId);
  const { pedidoId, tipo } = ses.metadata || {};
  await pedidoDoCliente(req, pedidoId);
  if (!pago(ses)) return { ok: false };
  await marcarPago(pedidoId, tipo === "mensal" ? "mensal" : "montagem", ses);
  return { ok: true };
});

/* O cliente cancela a manutenção na conta dele. Fica ativa até ao fim do mês já pago e não volta a ser cobrada. */
exports.cancelarManutencao = onCall(confOpts, async (req) => {
  const { pedidoId } = req.data || {};
  const { ref, p } = await pedidoDoCliente(req, pedidoId);
  const g = p.pagamento || {};
  if (!g.mensalAtiva || !g.stripeSubscricao) throw new HttpsError("failed-precondition", "Não há nenhuma manutenção ativa neste pedido.");
  if (g.mensalCancelada) return { ok: true, fim: g.mensalFim || null };
  const sub = await stripeDe().subscriptions.update(g.stripeSubscricao, { cancel_at_period_end: true });
  const fim = sub.cancel_at || sub.current_period_end || (sub.items?.data?.[0]?.current_period_end) || null;
  await ref.update({ "pagamento.mensalCancelada": true, "pagamento.mensalFim": fim ? fim * 1000 : null, atualizadoEm: admin.firestore.FieldValue.serverTimestamp() });
  await evento("cancelada", `${cortar((p.respostas || {}).negocio || p.nome, 60)}: manutenção cancelada, ativa até ${fim ? dataPT(fim) : "ao fim do período pago"}`, pedidoId);
  try { await avisar(`AW: manutenção cancelada ⚠️\n${cortar((p.respostas || {}).negocio, 60)} (${cortar(p.nome, 40)})\nFica ativa até ${fim ? dataPT(fim) : "ao fim do período pago"} e não volta a ser cobrada.\nhttps://awdigital.pt/#gestao`); } catch (e) { console.error(e); }
  return { ok: true, fim: fim ? fim * 1000 : null };
});

/* Webhook do Stripe: garante que tudo fica certo mesmo que o cliente feche a janela,
   e avisa-me quando uma mensalidade acaba ou falha. */
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");
const { onRequest } = require("firebase-functions/v2/https");
async function pedidoDaSubscricao(sub) {
  const id = sub.metadata?.pedidoId;
  if (id) { const r = admin.firestore().collection("pedidos").doc(id); const s = await r.get(); if (s.exists) return { ref: r, p: s.data() }; }
  const q = await admin.firestore().collection("pedidos").where("pagamento.stripeSubscricao", "==", sub.id).limit(1).get();
  return q.empty ? null : { ref: q.docs[0].ref, p: q.docs[0].data() };
}
exports.stripeWebhook = onRequest({ secrets: [STRIPE_SECRET, STRIPE_WEBHOOK_SECRET, TG_TOKEN, TG_CHAT, MAIL_USER, MAIL_PASS], region: "europe-west1", maxInstances: 5 }, async (req, res) => {
  let ev;
  try { ev = stripeDe().webhooks.constructEvent(req.rawBody, req.headers["stripe-signature"], STRIPE_WEBHOOK_SECRET.value()); }
  catch (e) { console.error("assinatura inválida", e.message); res.status(400).send("assinatura inválida"); return; }
  try {
    const o = ev.data.object;
    if (ev.type === "checkout.session.completed" || ev.type === "checkout.session.async_payment_succeeded") {
      const { pedidoId, tipo } = o.metadata || {};
      if (pedidoId && pago(o)) await marcarPago(pedidoId, tipo === "mensal" ? "mensal" : "montagem", o);
    } else if (ev.type === "customer.subscription.updated") {
      const f = await pedidoDaSubscricao(o); if (f) {
        const g = f.p.pagamento || {}, cancelada = !!(o.cancel_at_period_end || o.cancel_at);
        if (cancelada && !g.mensalCancelada) {
          const fim = o.cancel_at || o.current_period_end || o.items?.data?.[0]?.current_period_end;
          await f.ref.update({ "pagamento.mensalCancelada": true, "pagamento.mensalFim": fim ? fim * 1000 : null });
          await evento("cancelada", `${cortar((f.p.respostas || {}).negocio || f.p.nome, 60)}: manutenção cancelada, ativa até ${fim ? dataPT(fim) : "ao fim do período pago"}`, f.ref.id);
          await avisar(`AW: manutenção cancelada ⚠️\n${cortar((f.p.respostas || {}).negocio, 60)} (${cortar(f.p.nome, 40)})\nFica ativa até ${fim ? dataPT(fim) : "ao fim do período pago"}.`);
        } else if (!cancelada && g.mensalCancelada) {
          await f.ref.update({ "pagamento.mensalCancelada": false, "pagamento.mensalFim": null });
          await evento("retomada", `${cortar((f.p.respostas || {}).negocio || f.p.nome, 60)}: manutenção retomada`, f.ref.id);
          await avisar(`AW: manutenção retomada ✅\n${cortar((f.p.respostas || {}).negocio, 60)} (${cortar(f.p.nome, 40)})`);
        }
      }
    } else if (ev.type === "customer.subscription.deleted") {
      const f = await pedidoDaSubscricao(o); if (f) {
        await f.ref.update({ "pagamento.mensalAtiva": false, "pagamento.mensalCancelada": true, "pagamento.mensalFim": Date.now(), atualizadoEm: admin.firestore.FieldValue.serverTimestamp() });
        await evento("terminou", `${cortar((f.p.respostas || {}).negocio || f.p.nome, 60)}: manutenção terminou`, f.ref.id);
        try { await fichaCliente(f.ref.id, f.p, { estado: "terminado" }); } catch (e) { console.error(e); }
        await avisar(`AW: manutenção terminou ❌\n${cortar((f.p.respostas || {}).negocio, 60)} (${cortar(f.p.nome, 40)})\nJá não é cobrada. Decide se desligas o site ou falas com o cliente.`);
        await enviarEmail(f.p.email, "AW: a tua manutenção terminou", [`Olá ${cortar(f.p.nome, 40)},`, `A manutenção do site ${cortar((f.p.respostas || {}).negocio, 60)} terminou e já não vais ser cobrado.`, "Se quiseres voltar a ativá-la, fala comigo."], "Ver na minha conta");
      }
    } else if (ev.type === "invoice.payment_failed") {
      const subId = typeof o.subscription === "string" ? o.subscription : o.parent?.subscription_details?.subscription;
      const f = subId ? await pedidoDaSubscricao({ id: subId, metadata: o.subscription_details?.metadata || o.parent?.subscription_details?.metadata || {} }) : null;
      if (f) await f.ref.update({ "pagamento.mensalFalhou": true });
      await evento("falhou", `${f ? cortar((f.p.respostas || {}).negocio || f.p.nome, 60) : (o.customer_email || "cliente")}: mensalidade de ${((o.amount_due || 0) / 100).toFixed(2)} € falhou`, f?.ref.id);
      await avisar(`AW: mensalidade falhou ⚠️\n${f ? cortar((f.p.respostas || {}).negocio, 60) + " (" + cortar(f.p.nome, 40) + ")" : (o.customer_email || "cliente")}\n${((o.amount_due || 0) / 100).toFixed(2)} € não foram cobrados. O Stripe volta a tentar nos próximos dias.`);
    } else if (ev.type === "invoice.paid") {
      const subId = typeof o.subscription === "string" ? o.subscription : o.parent?.subscription_details?.subscription;
      const f = subId ? await pedidoDaSubscricao({ id: subId, metadata: o.subscription_details?.metadata || o.parent?.subscription_details?.metadata || {} }) : null;
      const fim = o.lines?.data?.[0]?.period?.end;
      if (f) await f.ref.update({ "pagamento.mensalFalhou": false, ...(fim ? { "pagamento.mensalProxima": fim * 1000 } : {}) });
    }
  } catch (e) { console.error("webhook", ev.type, e); res.status(500).send("erro"); return; }
  res.json({ recebido: true });
});


/* Todos os dias de manhã: avisa-me dos domínios que renovam nos próximos 30 dias (uma vez por data). */
const { onSchedule } = require("firebase-functions/v2/scheduler");
exports.avisoDominios = onSchedule({ schedule: "every day 09:00", timeZone: "Europe/Lisbon", region: "europe-west1", secrets: [TG_TOKEN, TG_CHAT] }, async () => {
  const q = await admin.firestore().collection("pedidos").where("estado", "==", "aceite").get();
  const hoje = Date.now();
  for (const d of q.docs) {
    const p = d.data(), dm = p.dominio || {};
    if (!dm.renovacao || dm.avisado === dm.renovacao) continue;
    const dias = Math.ceil((new Date(dm.renovacao).getTime() - hoje) / 864e5);
    if (dias > 30) continue;
    const nome = dm.nome || (p.dominioCliente || {}).nome || "domínio";
    await avisar(`AW: domínio a renovar 🌐\n${nome} (${cortar((p.respostas || {}).negocio || p.nome, 60)})\n${dias < 0 ? `Já passou a data (${dm.renovacao})!` : `Renova em ${dias} dia(s), a ${dm.renovacao}.`} Confirma com o cliente que está pago, senão o site deixa de abrir.`);
    await evento("dominio", `${nome}: renovação ${dias < 0 ? "atrasada" : `em ${dias} dia(s)`}`, d.id);
    await d.ref.update({ "dominio.avisado": dm.renovacao });
  }
});

/* lerLink: para o construtor do primeiro ecrã do site. Recebe o link do negócio do visitante (site, Facebook, Google
   Maps…) e devolve o nome, uma imagem e a cor da marca que a própria página anuncia (Open Graph e theme-color).
   Só aceita endereços públicos (nada da rede interna), segue no máximo 4 redireções, desiste ao fim de 7 s e lê no
   máximo 1,5 MB. Não guarda nada. */
const dnsP = require("node:dns").promises;
const net = require("node:net");
function ipPrivado(ip) {
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return ipPrivado(v.slice(7));
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}
async function urlPublico(u) {
  let x;
  try { x = new URL(u); } catch (e) { return null; }
  if (!/^https?:$/.test(x.protocol) || (x.port && !["80", "443"].includes(x.port)) || x.username || x.password) return null;
  const host = x.hostname.replace(/^\[|\]$/g, "");
  const ips = net.isIP(host) ? [host] : (await dnsP.lookup(host, { all: true }).catch(() => [])).map(r => r.address);
  if (!ips.length || ips.some(ipPrivado)) return null;
  return x;
}
const ORIGENS = ["https://awdigital.pt", "https://www.awdigital.pt", "https://joaoantunesss.github.io", "http://localhost:8912", "http://localhost:8080"];
exports.lerLink = onRequest({ region: "europe-west1", maxInstances: 3, memory: "256MiB", timeoutSeconds: 15 }, async (req, res) => {
  const o = req.get("origin") || "";
  res.set("Access-Control-Allow-Origin", ORIGENS.includes(o) ? o : ORIGENS[0]);
  res.set("Vary", "Origin");
  if (req.method === "OPTIONS") { res.set("Access-Control-Allow-Methods", "GET"); return res.status(204).send(""); }
  const pedido = String(req.query.url || "").slice(0, 600);
  let alvo = await urlPublico(pedido);
  if (!alvo) return res.status(400).json({ erro: "link inválido" });
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 7000);
  try {
    let r;
    for (let i = 0; i < 5; i++) {
      r = await fetch(alvo, { redirect: "manual", signal: ctl.signal, headers: {
        "User-Agent": "Mozilla/5.0 (compatible; facebookexternalhit/1.1; +https://awdigital.pt/)",
        "Accept": "text/html,application/xhtml+xml", "Accept-Language": "pt-PT,pt;q=0.9,en;q=0.6" } });
      if (r.status < 300 || r.status >= 400) break;
      const prox = r.headers.get("location");
      alvo = prox ? await urlPublico(new URL(prox, alvo).href) : null;
      if (!alvo || i === 4) return res.status(400).json({ erro: "redireções a mais" });
    }
    if (!r.ok || !/html/i.test(r.headers.get("content-type") || "")) return res.status(422).json({ erro: "não é uma página" });
    let html = "", lido = 0;
    const leitor = r.body.getReader(), dec = new TextDecoder();
    while (lido < 1.5e6) { const { done, value } = await leitor.read(); if (done) break; lido += value.length; html += dec.decode(value, { stream: true }); if (/<\/head>/i.test(html)) break; }
    leitor.cancel().catch(() => {});
    const ent = s => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16)));
    const meta = k => { for (const m of html.matchAll(/<meta\b[^>]*>/gi)) { const tag = m[0];
      const nome = (/(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag) || [])[1];
      if (nome && nome.toLowerCase() === k) { const c = (/content\s*=\s*["']([^"']*)["']/i.exec(tag) || [])[1]; if (c) return ent(c.trim()); } } return ""; };
    const titulo = meta("og:title") || ent(((/<title[^>]*>([^<]*)/i.exec(html) || [])[1] || "").trim());
    let nome = meta("og:site_name");
    if (nome.length < 4) nome = titulo || nome;
    const inteiro = nome;
    nome = nome.split(/\s+[|–—-]\s+|\s+\(@/)[0].replace(/\s+(on|no) Instagram.*$/i, "").trim();
    if (nome.length < 4) { const p = inteiro.split(/\s+[|–—-]\s+/); nome = (p[1] ? p[0] + " " + p[1] : p[0]).trim(); }
    nome = nome.slice(0, 60);
    if (/^(instagram|facebook|google maps|google|log ?in|entrar|iniciar sessão)$/i.test(nome)) nome = "";
    /* sem nome, é uma página de entrada ou genérica (Instagram, Maps sem sessão): não serve para nada */
    if (!nome) { res.set("Cache-Control", "public, max-age=600"); return res.json({ nome: "", imagem: "", cor: "", site: alvo.hostname.replace(/^www\./, "") }); }
    let imagem = meta("og:image:secure_url") || meta("og:image") || meta("twitter:image");
    try { imagem = imagem ? new URL(imagem, alvo).href : ""; } catch (e) { imagem = ""; }
    if (!/^https:/.test(imagem)) imagem = "";
    /* a imagem vai embutida na resposta (data:), para o site não ter de aceitar imagens de qualquer domínio */
    if (imagem) {
      try {
        const iu = await urlPublico(imagem);
        const ir = iu ? await fetch(iu, { signal: ctl.signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; facebookexternalhit/1.1)" } }) : null;
        const tipo = ir && (ir.headers.get("content-type") || "").split(";")[0];
        const tam = ir ? +(ir.headers.get("content-length") || 0) : 0;
        if (ir && ir.ok && /^image\/(jpeg|png|webp|gif)$/.test(tipo) && tam < 1.2e6) {
          const buf = Buffer.from(await ir.arrayBuffer());
          imagem = buf.length < 1.2e6 ? `data:${tipo};base64,${buf.toString("base64")}` : "";
        } else imagem = "";
      } catch (e) { imagem = ""; }
    }
    let cor = meta("theme-color");
    if (!/^#[0-9a-f]{6}$/i.test(cor)) cor = /^#[0-9a-f]{3}$/i.test(cor) ? "#" + cor.slice(1).split("").map(c => c + c).join("") : "";
    /* só uma cor com cor: branco, preto e cinzentos não dizem nada da marca */
    if (cor) {
      const n = parseInt(cor.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, s = mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1));
      if (s < 0.25 || l > 0.9 || l < 0.1) cor = "";
    }
    res.set("Cache-Control", "public, max-age=3600");
    return res.json({ nome, imagem, cor, site: alvo.hostname.replace(/^www\./, "") });
  } catch (e) {
    return res.status(502).json({ erro: "não consegui abrir" });
  } finally { clearTimeout(t); }
});
