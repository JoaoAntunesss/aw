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
      // AntunesPlayer: liga a subscrição à conta da app e avisa-me
      else if (PLAYER_PLINKS.includes(o.payment_link) && pago(o) && o.client_reference_id) {
        await playerLigar(o.client_reference_id, o);
        try { await avisar(`AWplayer: nova subscrição 💶\n${cortar(o.customer_details?.email || o.customer_email, 80)}\n${((o.amount_total || 0) / 100).toFixed(2)} €${o.payment_link === PLAYER_PLINK ? "/mês" : "/ano"}`); } catch (e) { console.error(e); }
      }
      // Cockpit / Freezer: o mesmo, cada um na sua coleção
      else if (appDoLink(o.payment_link) && pago(o) && o.client_reference_id && o.subscription) {
        const k = appDoLink(o.payment_link);
        await admin.firestore().collection("app_" + k).doc(o.client_reference_id).set({ sub: String(o.subscription), cliente: String(o.customer || ""), subVisto: 0 }, { merge: true });
        try { await avisar(`${APPS[k].nome}: nova subscrição 💶\n${cortar(o.customer_details?.email || o.customer_email, 80)}\n${((o.amount_total || 0) / 100).toFixed(2)} €${o.payment_link === APPS[k].mes.plink ? "/mês" : "/ano"}`); } catch (e) { console.error(e); }
      }
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

/* ---- AntunesPlayer: 24 horas grátis, depois 1 €/mês (link de pagamento do Stripe) ----
   A app (projeto Firebase iptv-364a1) manda o token da conta Google; aqui confirma-se quem é e se pagou.
   O pagamento faz-se no link do Stripe com client_reference_id = uid da conta; o webhook acima e a procura
   abaixo ligam a subscrição a essa conta (coleção "player", só as funções lhe mexem). */
const PLAYER_LINK = "https://buy.stripe.com/4gM9AL24H00n6Wo6zD93y00";
const PLAYER_PLINK = "plink_1UbTfy1B8fzyW0R2yD8oLWon";
const PLAYER_LINK_ANO = "https://buy.stripe.com/cNidR16kXdRd3Kc8HL93y01"; // 10 €/ano
const PLAYER_PLINKS = [PLAYER_PLINK, "plink_1UbUFu1B8fzyW0R28tt3Ei5C"];
const PLAYER_TESTE = 24 * 3600e3;
const PLAYER_APARELHOS = 3, PLAYER_AO_MESMO_TEMPO = 2, PLAYER_A_VER = 150e3; // aparelhos por conta; a ver em simultâneo; "a ver" = sinal há menos de 2,5 min
const devId = (x) => (/^[a-z0-9]{4,24}$/i.test(String(x || "")) ? String(x) : "");
// sempre grátis: o dono; o resto da lista fica em config/player.gratis (painel de gestão do site → AntunesPlayer)
const PLAYER_DONO = ["j.p.r.n.antunes@gmail.com", "firmino.antunes@gmail.com"];
let iptvAuth = null;
const authIptv = () => iptvAuth || (iptvAuth = admin.initializeApp({ projectId: "iptv-364a1" }, "iptv").auth());
const subAtiva = (d, now) => ["active", "trialing", "past_due"].includes(d.subEstado) && (d.ate || 0) > now - 3 * 86400e3;
async function playerConta(req) {
  const tok = String(req.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!tok) return null;
  try { return await authIptv().verifyIdToken(tok); } catch (e) { return null; }
}
async function playerGratis(email) {
  if (!email) return false;
  if (PLAYER_DONO.includes(email)) return true;
  try {
    const s = await admin.firestore().collection("config").doc("player").get();
    return ((s.exists && s.data().gratis) || []).map(x => String(x).toLowerCase().trim()).includes(email);
  } catch (e) { return false; }
}
async function playerLigar(uid, ses) {
  if (!uid || !ses || !ses.subscription) return;
  await admin.firestore().collection("player").doc(uid).set({ sub: String(ses.subscription), cliente: String(ses.customer || ""), subVisto: 0 }, { merge: true });
}
// procura no Stripe um pagamento desta conta pelo link (quando a pessoa diz que já pagou)
async function playerProcurar(uid) {
  for (const plink of PLAYER_PLINKS) {
    let ini;
    for (let p = 0; p < 5; p++) {
      const l = await stripeDe().checkout.sessions.list({ payment_link: plink, limit: 100, ...(ini ? { starting_after: ini } : {}) });
      const s = l.data.find(x => x.client_reference_id === uid && x.status === "complete" && x.subscription);
      if (s) return s;
      if (!l.has_more) break;
      ini = l.data[l.data.length - 1].id;
    }
  }
  return null;
}
/* Resposta assinada (ECDSA P-256): a app só aceita o estado com esta assinatura, ligada à conta e ao aparelho, e só até
   "x" (a data até onde pode ver sem voltar a perguntar). A chave privada está no Secret Manager (PLAYER_SIGN);
   a pública está na app (src/34-plano.js). */
const PLAYER_SIGN = defineSecret("PLAYER_SIGN");
const b64u = (b) => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
function playerAssinar(p) {
  const corpo = b64u(JSON.stringify(p));
  const sig = require("crypto").sign("sha256", Buffer.from(corpo), { key: PLAYER_SIGN.value(), dsaEncoding: "ieee-p1363" });
  return corpo + "." + b64u(sig);
}
exports.playerEstado = onRequest({ region: "europe-west1", maxInstances: 10, secrets: [STRIPE_SECRET, PLAYER_SIGN], cors: true }, async (req, res0) => {
  const u = await playerConta(req);
  if (!u) { res0.status(401).json({ erro: "Entra com a tua conta Google." }); return; }
  const email = String(u.email || "").toLowerCase(), uid = u.uid, now = Date.now();
  // cada resposta leva o token assinado: até quando este aparelho pode ver sem perguntar outra vez (no máximo 3 dias)
  const res = { json: (o) => {
    let x = 0;
    if (o.estado === "gratis") x = now + 3 * 86400e3;
    else if (o.estado === "pago") x = Math.min(now + 3 * 86400e3, (o.ate || 0) + 3 * 86400e3);
    else if (o.estado === "teste") x = o.fimTeste;
    o.token = playerAssinar({ u: uid, d: devId(req.query.dev), e: o.estado, x, t: now });
    res0.json(o);
  } };
  const ref = admin.firestore().collection("player").doc(uid);
  const snap = await ref.get();
  let d = snap.exists ? snap.data() : null;
  if (!d) {
    // o período grátis conta desde a primeira vez que a app abriu neste aparelho (nunca depois de agora)
    const ini = Math.min(now, Math.max(now - 30 * 86400e3, Number(req.query.inicio) || now));
    d = { email, inicio: ini };
    await ref.set({ ...d, criadoEm: admin.firestore.FieldValue.serverTimestamp() });
  }
  if (await playerGratis(email)) { res.json({ estado: "gratis" }); return; }
  // aparelhos da conta: no máximo PLAYER_APARELHOS (os que não abrem a app há 60 dias saem sozinhos)
  const dev = devId(req.query.dev);
  if (dev) {
    const devs = Object.fromEntries(Object.entries(d.devs || {}).filter(([, x]) => now - (x.visto || 0) < 60 * 86400e3));
    if (!devs[dev] && Object.keys(devs).length >= PLAYER_APARELHOS) {
      res.json({ estado: "limite", max: PLAYER_APARELHOS, aparelhos: Object.entries(devs).map(([id, x]) => ({ id, nome: x.nome || "Aparelho", visto: x.visto || 0 })) });
      return;
    }
    const nome = cortar(req.query.nome, 40) || "Aparelho";
    if (!devs[dev] || now - (devs[dev].visto || 0) > 3600e3 || devs[dev].nome !== nome) {
      devs[dev] = { nome, visto: now };
      await ref.set({ devs }, { mergeFields: ["devs"] });
    }
  }
  try {
    const pediu = req.query.pago === "1";
    if (!d.sub && (pediu || !d.procurado || now - d.procurado > 10 * 60e3) && now > d.inicio + PLAYER_TESTE - 3600e3) {
      const s = await playerProcurar(uid);
      d.procurado = now;
      if (s) { d.sub = String(s.subscription); d.cliente = String(s.customer || ""); d.subVisto = 0; }
      await ref.set({ procurado: now, ...(s ? { sub: d.sub, cliente: d.cliente, subVisto: 0 } : {}) }, { merge: true });
    }
    if (d.sub && (pediu || !d.subVisto || now - d.subVisto > 6 * 3600e3)) {
      const sub = await stripeDe().subscriptions.retrieve(d.sub);
      const fim = fimPeriodo(sub);
      const intervalo = (((sub.items || {}).data || [])[0] || {}).price?.recurring?.interval || "";
      Object.assign(d, { subEstado: sub.status, ate: fim ? fim * 1000 : 0, cancelada: !!sub.cancel_at_period_end, subVisto: now, intervalo });
      await ref.set({ subEstado: d.subEstado, ate: d.ate, cancelada: d.cancelada, subVisto: now, intervalo }, { merge: true });
    }
  } catch (e) { console.error("playerEstado", e); }
  if (d.sub && subAtiva(d, now)) { res.json({ estado: "pago", ate: d.ate, cancelada: !!d.cancelada }); return; }
  const fimTeste = d.inicio + PLAYER_TESTE;
  const qs = `?client_reference_id=${encodeURIComponent(uid)}${email ? "&prefilled_email=" + encodeURIComponent(email) : ""}&locale=pt`;
  const link = PLAYER_LINK + qs, linkAno = PLAYER_LINK_ANO + qs;
  if (now < fimTeste) { res.json({ estado: "teste", fimTeste, link, linkAno }); return; }
  res.json({ estado: "pagar", link, linkAno });
});
// tira um aparelho da conta (para dar lugar a outro)
exports.playerTirar = onRequest({ region: "europe-west1", maxInstances: 5, cors: true }, async (req, res) => {
  const u = await playerConta(req);
  if (!u) { res.status(401).json({ erro: "Entra com a tua conta Google." }); return; }
  const dev = devId(req.query.id);
  if (!dev) { res.status(400).json({ erro: "Aparelho inválido." }); return; }
  await admin.firestore().collection("player").doc(u.uid).update({ ["devs." + dev]: admin.firestore.FieldValue.delete(), ["aver." + dev]: admin.firestore.FieldValue.delete() }).catch(() => {});
  res.json({ ok: true });
});
// sinal enquanto um aparelho está a ver (cada minuto): no máximo PLAYER_AO_MESMO_TEMPO aparelhos ao mesmo tempo
exports.playerVer = onRequest({ region: "europe-west1", maxInstances: 20, cors: true }, async (req, res) => {
  const u = await playerConta(req);
  if (!u) { res.status(401).json({ erro: "Entra com a tua conta Google." }); return; }
  const dev = devId(req.query.dev);
  if (!dev || (await playerGratis(String(u.email || "").toLowerCase()))) { res.json({ ok: true }); return; }
  const ref = admin.firestore().collection("player").doc(u.uid), now = Date.now(), parar = req.query.parar === "1";
  const r = await admin.firestore().runTransaction(async (t) => {
    const s = await t.get(ref);
    const d = s.exists ? s.data() : {};
    const aver = Object.fromEntries(Object.entries(d.aver || {}).filter(([k, ts]) => k !== dev && now - ts < PLAYER_A_VER));
    if (!parar && Object.keys(aver).length >= PLAYER_AO_MESMO_TEMPO)
      return { ok: false, max: PLAYER_AO_MESMO_TEMPO, nomes: Object.keys(aver).map(k => (d.devs && d.devs[k] && d.devs[k].nome) || "Aparelho") };
    if (!parar) aver[dev] = now;
    t.set(ref, { aver }, { mergeFields: ["aver"] });
    return { ok: true };
  });
  res.json(r);
});
// gerir ou cancelar a subscrição (portal do cliente do Stripe)
exports.playerGerir = onRequest({ region: "europe-west1", maxInstances: 5, secrets: [STRIPE_SECRET], cors: true }, async (req, res) => {
  const u = await playerConta(req);
  if (!u) { res.status(401).json({ erro: "Entra com a tua conta Google." }); return; }
  const s = await admin.firestore().collection("player").doc(u.uid).get();
  const c = s.exists && s.data().cliente;
  if (!c) { res.status(404).json({ erro: "Ainda não tens nenhuma subscrição." }); return; }
  try {
    const p = await stripeDe().billingPortal.sessions.create({ customer: c, locale: "pt", return_url: "https://player.awdigital.pt/" });
    res.json({ url: p.url });
  } catch (e) { console.error("playerGerir", e); res.status(500).json({ erro: "Não foi possível abrir a gestão da subscrição." }); }
});

/* ---- Cockpit e Freezer: 24 horas grátis, depois 1 €/mês ou 10 €/ano (links de pagamento do Stripe) ----
   Igual ao AWplayer, mais simples (sem limite de aparelhos). Cada app manda o token da conta Google do seu projeto
   Firebase; o pagamento faz-se no link com client_reference_id = uid; a subscrição fica em app_<app>/<uid>. */
const APPS = {
  cockpit: {
    nome: "Cockpit", proj: "app-dashboardcarros", pagina: "https://awdigital.pt/cockpit/",
    mes: { url: "https://buy.stripe.com/28EaEP4cP3cz2G8aPT93y02", plink: "plink_1UcDAE1B8fzyW0R2U9IqGknB" },
    ano: { url: "https://buy.stripe.com/4gMeV5aBd9AX5Sk9LP93y03", plink: "plink_1UcDG81B8fzyW0R2udiYCvJd" }
  },
  freezer: {
    nome: "Freezer", proj: "congelador-bdba6", pagina: "https://awdigital.pt/freezer/",
    mes: { url: "https://buy.stripe.com/00wcMX9x928v3Kc4rv93y04", plink: "plink_1UcDIF1B8fzyW0R2OE8Ij42F" },
    ano: { url: "https://buy.stripe.com/14A28jfVxcN95Sk1fj93y05", plink: "plink_1UcDMk1B8fzyW0R2o3Fz5nvv" }
  }
};
const APP_TESTE = 24 * 3600e3;
const appDoLink = (plink) => Object.keys(APPS).find(k => APPS[k].mes.plink === plink || APPS[k].ano.plink === plink);
const appAuths = {};
const appAuth = (k) => appAuths[k] || (appAuths[k] = admin.initializeApp({ projectId: APPS[k].proj }, "app-" + k).auth());
async function appConta(req, k) {
  const tok = String(req.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!tok) return null;
  try { return await appAuth(k).verifyIdToken(tok); } catch (e) { return null; }
}
// sempre grátis: o dono e a família; o resto da lista fica em config/<app>.gratis
async function appGratis(k, email) {
  if (!email) return false;
  if (PLAYER_DONO.includes(email)) return true;
  try {
    const s = await admin.firestore().collection("config").doc(k).get();
    return ((s.exists && s.data().gratis) || []).map(x => String(x).toLowerCase().trim()).includes(email);
  } catch (e) { return false; }
}
async function appProcurar(k, uid) {
  for (const plink of [APPS[k].mes.plink, APPS[k].ano.plink]) {
    let ini;
    for (let p = 0; p < 5; p++) {
      const l = await stripeDe().checkout.sessions.list({ payment_link: plink, limit: 100, ...(ini ? { starting_after: ini } : {}) });
      const s = l.data.find(x => x.client_reference_id === uid && x.status === "complete" && x.subscription);
      if (s) return s;
      if (!l.has_more) break;
      ini = l.data[l.data.length - 1].id;
    }
  }
  return null;
}
// estado da conta numa app: gratis | pago | teste | pagar (com os links já ligados à conta)
exports.appEstado = onRequest({ region: "europe-west1", maxInstances: 10, secrets: [STRIPE_SECRET], cors: true }, async (req, res) => {
  const k = String(req.query.app || "");
  if (!APPS[k]) { res.status(400).json({ erro: "App desconhecida." }); return; }
  const u = await appConta(req, k);
  if (!u) { res.status(401).json({ erro: "Entra com a tua conta Google." }); return; }
  const email = String(u.email || "").toLowerCase(), uid = u.uid, now = Date.now();
  const ref = admin.firestore().collection("app_" + k).doc(uid);
  const snap = await ref.get();
  let d = snap.exists ? snap.data() : null;
  if (!d) {
    // o período grátis conta desde a primeira vez que a app abriu neste aparelho (nunca depois de agora)
    const ini = Math.min(now, Math.max(now - 30 * 86400e3, Number(req.query.inicio) || now));
    d = { email, inicio: ini };
    await ref.set({ ...d, criadoEm: admin.firestore.FieldValue.serverTimestamp() });
  }
  if (await appGratis(k, email)) { res.json({ estado: "gratis" }); return; }
  try {
    const pediu = req.query.pago === "1";
    if (!d.sub && (pediu || !d.procurado || now - d.procurado > 10 * 60e3) && now > d.inicio + APP_TESTE - 3600e3) {
      const s = await appProcurar(k, uid);
      d.procurado = now;
      if (s) { d.sub = String(s.subscription); d.cliente = String(s.customer || ""); d.subVisto = 0; }
      await ref.set({ procurado: now, ...(s ? { sub: d.sub, cliente: d.cliente, subVisto: 0 } : {}) }, { merge: true });
    }
    if (d.sub && (pediu || !d.subVisto || now - d.subVisto > 6 * 3600e3)) {
      const sub = await stripeDe().subscriptions.retrieve(d.sub);
      const fim = fimPeriodo(sub);
      const intervalo = (((sub.items || {}).data || [])[0] || {}).price?.recurring?.interval || "";
      Object.assign(d, { subEstado: sub.status, ate: fim ? fim * 1000 : 0, cancelada: !!sub.cancel_at_period_end, subVisto: now, intervalo });
      await ref.set({ subEstado: d.subEstado, ate: d.ate, cancelada: d.cancelada, subVisto: now, intervalo }, { merge: true });
    }
  } catch (e) { console.error("appEstado", k, e); }
  if (d.sub && subAtiva(d, now)) { res.json({ estado: "pago", ate: d.ate, cancelada: !!d.cancelada }); return; }
  const fimTeste = d.inicio + APP_TESTE;
  const qs = `?client_reference_id=${encodeURIComponent(uid)}${email ? "&prefilled_email=" + encodeURIComponent(email) : ""}&locale=pt`;
  const link = APPS[k].mes.url + qs, linkAno = APPS[k].ano.url + qs;
  if (now < fimTeste) { res.json({ estado: "teste", fimTeste, link, linkAno }); return; }
  res.json({ estado: "pagar", link, linkAno });
});
// gerir ou cancelar a subscrição de uma app (portal do cliente do Stripe)
exports.appGerir = onRequest({ region: "europe-west1", maxInstances: 5, secrets: [STRIPE_SECRET], cors: true }, async (req, res) => {
  const k = String(req.query.app || "");
  if (!APPS[k]) { res.status(400).json({ erro: "App desconhecida." }); return; }
  const u = await appConta(req, k);
  if (!u) { res.status(401).json({ erro: "Entra com a tua conta Google." }); return; }
  const s = await admin.firestore().collection("app_" + k).doc(u.uid).get();
  const c = s.exists && s.data().cliente;
  if (!c) { res.status(404).json({ erro: "Ainda não tens nenhuma subscrição." }); return; }
  try {
    const p = await stripeDe().billingPortal.sessions.create({ customer: c, locale: "pt", return_url: APPS[k].pagina });
    res.json({ url: p.url });
  } catch (e) { console.error("appGerir", k, e); res.status(500).json({ erro: "Não foi possível abrir a gestão da subscrição." }); }
});

/* AWplayer: "Reportar um problema" dentro da app. Guarda em suporte_player (vês no painel de gestão → AWplayer)
   e avisa-me no Telegram. Leva o que a pessoa escreveu e um diagnóstico da app (sem links nem logins das listas). */
exports.playerSuporte = onRequest({ region: "europe-west1", maxInstances: 5, secrets: [TG_TOKEN, TG_CHAT], cors: true }, async (req, res) => {
  if (req.method !== "POST") { res.status(405).json({ erro: "Usa POST." }); return; }
  const u = await playerConta(req);
  const b = typeof req.body === "object" && req.body ? req.body : {};
  const texto = cortar(b.texto, 3000).trim();
  if (texto.length < 5) { res.status(400).json({ erro: "Descreve o problema." }); return; }
  const dev = devId(b.dev) || "sem-id";
  // no máximo um relato por minuto e 20 por dia por aparelho
  const lim = admin.firestore().collection("suporte_player_lim").doc(dev), now = Date.now();
  const ok = await admin.firestore().runTransaction(async (t) => {
    const s = await t.get(lim), d = s.exists ? s.data() : { dia: 0, n: 0, ult: 0 };
    const dia = Math.floor(now / 864e5), n = d.dia === dia ? d.n : 0;
    if (now - (d.ult || 0) < 60e3 || n >= 20) return false;
    t.set(lim, { dia, n: n + 1, ult: now }); return true;
  });
  if (!ok) { res.status(429).json({ erro: "Espera um minuto antes de enviar outro." }); return; }
  const diag = {};
  for (const [k, v] of Object.entries(b.diag || {}).slice(0, 30)) diag[cortar(k, 40)] = cortar(typeof v === "string" ? v : JSON.stringify(v), 300);
  const doc = { texto, contacto: cortar(b.contacto, 120), email: u ? String(u.email || "") : "", uid: u ? u.uid : "", dev, diag, estado: "aberto", criadoEm: admin.firestore.FieldValue.serverTimestamp() };
  const r = await admin.firestore().collection("suporte_player").add(doc);
  try { await avisar(`AWplayer: problema reportado 🐞\n${cortar(doc.email || doc.contacto || "anónimo", 80)}\n${cortar(texto, 500)}\n${cortar(diag.app || "", 80)} · ${cortar(diag.aparelho || "", 80)}${diag.erro ? "\nErro: " + cortar(diag.erro, 200) : ""}`); } catch (e) { console.error(e); }
  res.json({ ok: true, id: r.id });
});

// ---------------------------------------------------------------- ReelPick: TMDB proxy (one shared key, kept server-side)
const TMDB_KEY = defineSecret("TMDB_KEY");
const TMDB_PATHS = /^\/(search\/multi|search\/movie|search\/tv|(movie|tv)\/\d{1,9}(\/(images|videos|credits|watch\/providers|recommendations))?|genre\/(movie|tv)\/list|watch\/providers\/(movie|tv)|discover\/(movie|tv)|trending\/(all|movie|tv)\/(day|week)|movie\/(now_playing|upcoming|popular)|tv\/(popular|on_the_air))$/;
const TMDB_PARAMS = /^(query|language|page|region|watch_region|include_adult|append_to_response|include_image_language|sort_by|with_genres|without_genres|with_watch_providers|with_watch_monetization_types|with_runtime\.(gte|lte)|vote_average\.(gte|lte)|vote_count\.(gte|lte)|primary_release_date\.(gte|lte)|first_air_date\.(gte|lte)|release_date\.(gte|lte)|with_original_language|primary_release_year)$/;
const TMDB_ORIGINS = /^https:\/\/(joaoantunesss\.github\.io|reelpick\.awdigital\.pt)$|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const tmdbHits = new Map();
exports.tmdb = onRequest({ region: "europe-west1", maxInstances: 5, memory: "256MiB", timeoutSeconds: 15, secrets: [TMDB_KEY] }, async (req, res) => {
  const origin = req.get("origin") || "";
  if (TMDB_ORIGINS.test(origin)) { res.set("Access-Control-Allow-Origin", origin); res.set("Vary", "Origin"); }
  if (req.method === "OPTIONS") { res.set("Access-Control-Allow-Methods", "GET"); res.status(204).send(""); return; }
  if (req.method !== "GET") { res.status(405).json({ error: "method" }); return; }
  // light per-IP limit: 300 requests per 5 minutes per instance
  const ip = String(req.get("x-forwarded-for") || req.ip || "").split(",")[0].trim(), now = Date.now(), h = tmdbHits.get(ip) || { n: 0, t: now };
  if (now - h.t > 300e3) { h.n = 0; h.t = now; } h.n++; tmdbHits.set(ip, h); if (tmdbHits.size > 5000) tmdbHits.clear();
  if (h.n > 300) { res.status(429).json({ error: "slow down" }); return; }
  const path = String(req.query.path || "");
  if (!TMDB_PATHS.test(path)) { res.status(400).json({ error: "path" }); return; }
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query)) { if (k !== "path" && TMDB_PARAMS.test(k) && typeof v === "string" && v.length <= 200) q.set(k, v); }
  const key = TMDB_KEY.value().trim(), headers = { accept: "application/json" };
  if (key.length > 40) headers.Authorization = "Bearer " + key; else q.set("api_key", key);
  try {
    const r = await fetch("https://api.themoviedb.org/3" + path + "?" + q, { headers });
    const body = await r.text();
    res.set("Cache-Control", r.ok ? "public, max-age=3600, s-maxage=21600" : "no-store");
    res.status(r.status === 401 ? 502 : r.status).type("application/json").send(body);
  } catch (e) { res.status(502).json({ error: "tmdb unreachable" }); }
});

// ---------------------------------------------------------------- ReelPick: film and TV headlines (RSS of Portuguese sites), cached 30 min
// Only headline, link, source and date are returned; the article opens on the original site.
const NEWS_FEEDS = [
  { src: "Magazine.HD", url: "https://www.magazine-hd.com/apps/wp/feed/", all: false },
  { src: "Espalha-Factos", url: "https://espalhafactos.com/feed/", all: false },
];
const NEWS_TOPIC = /cinema|\btv\b|televisão|filme|série|series|streaming|netflix|hbo|max|disney|prime video|skyshowtime|apple tv|óscar|oscar|emmy|estreia|trailer|realizador|ator|atriz|temporada/i;
let newsCache = { at: 0, items: [] };
const unent = (s) => String(s || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "").replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&apos;|&#039;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const tag = (x, t) => { const m = x.match(new RegExp("<" + t + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + t + ">", "i")); return m ? m[1] : ""; };
function parseFeed(xml, f) {
  const out = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  for (const b of blocks.slice(0, 40)) {
    const title = unent(tag(b, "title")).slice(0, 200);
    let link = unent(tag(b, "link")); if (!link) { const m = b.match(/<link[^>]+href="([^"]+)"/i); link = m ? m[1] : ""; }
    const cats = (b.match(/<category[^>]*>([\s\S]*?)<\/category>/gi) || []).map((c) => unent(c)).join(" ");
    const at = Date.parse(unent(tag(b, "pubDate") || tag(b, "published") || tag(b, "updated") || tag(b, "dc:date"))) || 0;
    if (!title || !/^https:\/\//.test(link)) continue;
    if (!f.all && !NEWS_TOPIC.test(title + " " + cats)) continue;
    out.push({ title, link: link.slice(0, 500), source: f.src, at });
  }
  return out;
}
exports.noticias = onRequest({ region: "europe-west1", maxInstances: 3, memory: "256MiB", timeoutSeconds: 20 }, async (req, res) => {
  const origin = req.get("origin") || "";
  if (TMDB_ORIGINS.test(origin)) { res.set("Access-Control-Allow-Origin", origin); res.set("Vary", "Origin"); }
  if (req.method === "OPTIONS") { res.set("Access-Control-Allow-Methods", "GET"); res.status(204).send(""); return; }
  if (req.method !== "GET") { res.status(405).json({ error: "method" }); return; }
  if (Date.now() - newsCache.at > 30 * 60e3 || !newsCache.items.length) {
    const lists = await Promise.all(NEWS_FEEDS.map(async (f) => {
      try {
        const c = new AbortController(), t = setTimeout(() => c.abort(), 8000);
        const r = await fetch(f.url, { signal: c.signal, headers: { "user-agent": "ReelPick news (+https://joaoantunesss.github.io/reelpick/)", accept: "application/rss+xml, application/xml, text/xml" } });
        clearTimeout(t); if (!r.ok) return [];
        return parseFeed((await r.text()).slice(0, 2e6), f);
      } catch (e) { console.warn("news feed", f.src, e.message); return []; }
    }));
    const seenLinks = new Set(), weekAgo = Date.now() - 7 * 864e5;
    const items = lists.flat().filter((x) => (!x.at || x.at > weekAgo) && !seenLinks.has(x.link) && seenLinks.add(x.link)).sort((a, b) => b.at - a.at).slice(0, 40);
    if (items.length) newsCache = { at: Date.now(), items };
  }
  res.set("Cache-Control", "public, max-age=900, s-maxage=1800");
  res.json({ items: newsCache.items, at: newsCache.at });
});
