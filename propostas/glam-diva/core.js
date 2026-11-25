/* core.js — partilhado pelo site e pelo painel. Não precisa de ser alterado por loja. */
(function () {
  const L = window.LOJA;
  const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
  const DIAS_NOME = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const INT = (L.agenda && L.agenda.intervaloMin) || 30;
  const DEMO = !(L.firebase && L.firebase.apiKey);

  const hm = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
  const fmtH = t => String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');

  // ---------- Equipa (opcional) ----------
  // Sem L.equipa (ou lista vazia) = salão de uma pessoa: tudo funciona como antes.
  const EQUIPA = (L.equipa || []).filter(p => p && p.id);
  const MODO_EQUIPA = EQUIPA.length > 0;
  const prof = id => EQUIPA.find(p => p.id === id) || null;
  const horarioDe = p => (p && p.horario) || L.agenda.horario;
  const fazServico = (p, nome) => !p.servicos || p.servicos.includes('*') || p.servicos.includes(nome);

  // Todas as horas possíveis da semana (da abertura mais cedo ao fecho mais tarde, de todos)
  let mn = 24 * 60, mx = 0;
  [L.agenda.horario, ...EQUIPA.map(p => p.horario).filter(Boolean)].forEach(H => Object.values(H).forEach(r => (r || []).forEach(([a, b]) => { mn = Math.min(mn, hm(a)); mx = Math.max(mx, hm(b)); })));
  const HORAS = [];
  for (let t = mn; t + INT <= mx; t += INT) HORAS.push(fmtH(t));

  // aberto(data, hora) = horário do salão; aberto(data, hora, idProfissional) = horário dessa pessoa
  function aberto(date, hora, pid) {
    const r = horarioDe(pid ? prof(pid) : null)[DIAS[date.getDay()]];
    if (!r) return false;
    const t = hm(hora);
    return r.some(([a, b]) => t >= hm(a) && t + INT <= hm(b));
  }
  const blocosDe = s => Math.max(1, Math.ceil((s.min || INT) / INT));
  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const isoParaData = s => { const [a, m, d] = s.split('-').map(Number); return new Date(a, m - 1, d); };
  const visual = s => s.split('-').reverse().join('/');
  const segunda = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() || 7) - 1)); return x; };
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const eur = v => (Number(v) || 0).toFixed(2) + '€';
  const duracao = min => { const h = Math.floor(min / 60), m = min % 60; return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`; };
  const tpl = (t, o) => t.replace(/\{(\w+)\}/g, (_, k) => (o[k] != null ? o[k] : ''));
  const telInt = t => { let n = String(t || '').replace(/\D/g, ''); if (n.length === 9) n = L.indicativo + n; return n; };
  const telValido = t => String(t || '').replace(/\D/g, '').length >= 9;

  // Slots ocupados por uma reserva (hora inicial + blocos)
  function slotsDe(r) {
    const i = HORAS.indexOf(r.hora), out = [];
    for (let k = 0; k < (r.blocos || 1); k++) if (HORAS[i + k]) out.push(HORAS[i + k]);
    return out;
  }

  // Ocupação pública: ocupacao/dia/hora (uma pessoa) ou ocupacao/dia/idProfissional/hora (equipa)
  const ocupadoEm = (oc, di, h, pid) => { const d = oc && oc[di]; if (!d) return false; return MODO_EQUIPA ? !!(d[pid] && d[pid][h]) : !!d[h]; };
  const chaveOcup = (di, h, pid) => MODO_EQUIPA ? `ocupacao/${di}/${pid}/${h}` : `ocupacao/${di}/${h}`;
  // Bloqueios: sem "prof" = salão inteiro; com "prof" = só essa pessoa (férias, folga)
  function mapaBloqueios(lista) {
    const m = {};
    lista.forEach(b => { const k = b.hora === 'Todas' ? b.data : b.data + '-' + b.hora; m[b.prof ? k + '|' + b.prof : k] = b.motivo || 'Fechado'; });
    return m;
  }
  const bloqueado = (m, di, h, pid) => m[di] || m[di + '-' + h] || (pid && (m[di + '|' + pid] || m[di + '-' + h + '|' + pid])) || null;

  // ---------- Aspeto (cores e fontes a partir de loja.js) ----------
  function aplicarTema(painel) {
    const c = L.cores, s = document.documentElement.style;
    s.setProperty('--bg-color', painel ? (c.painelFundo || c.fundo) : c.fundo);
    s.setProperty('--text-color', c.texto);
    s.setProperty('--accent-color', c.destaque);
    s.setProperty('--accent-dark', c.destaqueEscuro);
    s.setProperty('--font-title', `'${L.fontes.titulo}', serif`);
    s.setProperty('--font-text', `'${L.fontes.texto}', sans-serif`);
    const locais = L.fontesLocais || [];
    const f = document.createElement('link');
    f.rel = 'stylesheet';
    if (locais.includes(L.fontes.titulo) && locais.includes(L.fontes.texto)) f.href = 'fonts/fonts.css';
    else f.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(L.fontes.titulo) + ':wght@400;600&family=' + encodeURIComponent(L.fontes.texto) + ':wght@300;400;700&display=swap';
    document.head.appendChild(f);
    const tc = document.querySelector('meta[name=theme-color]'); if (tc) tc.content = painel ? c.texto : c.destaque;
  }

  // =================================================================
  // Base de dados: Firebase a sério, ou uma imitação local (modo demo)
  // =================================================================
  function carregarScript(src) {
    return new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = ko; document.head.appendChild(s); });
  }
  let _db = null, _auth = null;

  async function iniciar(comAuth) {
    if (_db) return;
    if (!DEMO) {
      const v = '10.12.5', b = `https://www.gstatic.com/firebasejs/${v}/`;
      await carregarScript(b + 'firebase-app-compat.js');
      await carregarScript(b + 'firebase-database-compat.js');
      if (comAuth) await carregarScript(b + 'firebase-auth-compat.js');
      firebase.initializeApp(L.firebase);
      _db = firebase.database();
      if (comAuth) _auth = firebase.auth();
      return;
    }
    _db = demoDB();
    _auth = demoAuth();
  }

  // ---- Imitação mínima da Realtime Database (só para demonstração) ----
  function demoDB() {
    const KEY = 'demo-db-' + L.id;
    let tree = null;
    try { tree = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
    if (!tree) tree = semente();
    const ouvintes = [];
    const partes = p => (p || '').split('/').filter(Boolean);
    const ler = p => partes(p).reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), tree);
    function escrever(p, v) {
      const ks = partes(p);
      if (!ks.length) { tree = v || {}; return; }
      let o = tree;
      for (let i = 0; i < ks.length - 1; i++) { if (typeof o[ks[i]] !== 'object' || o[ks[i]] === null) o[ks[i]] = {}; o = o[ks[i]]; }
      const last = ks[ks.length - 1];
      if (v === null || v === undefined) delete o[last]; else o[last] = JSON.parse(JSON.stringify(v));
    }
    function guardar() {
      try { localStorage.setItem(KEY, JSON.stringify(tree)); } catch (e) {}
      ouvintes.forEach(l => l.cb(snap(l.p)));
    }
    const snap = p => { const v = ler(p); return { key: partes(p).pop(), val: () => (v === undefined ? null : JSON.parse(JSON.stringify(v))) }; };
    let cont = 0;
    const novaChave = () => '-D' + Date.now().toString(36) + (cont++).toString(36) + Math.random().toString(36).slice(2, 6);
    function ref(p = '') {
      return {
        key: partes(p).pop() || null,
        on(_, cb) { ouvintes.push({ p, cb }); setTimeout(() => cb(snap(p)), 0); },
        once() { return Promise.resolve(snap(p)); },
        set(v) { escrever(p, v); guardar(); return Promise.resolve(); },
        update(o) { Object.keys(o).forEach(k => escrever(p ? p + '/' + k : k, o[k])); guardar(); return Promise.resolve(); },
        remove() { escrever(p, null); guardar(); return Promise.resolve(); },
        orderByChild(k) { return { equalTo: v => { const f = sn => ({ key: sn.key, val: () => { const o = sn.val() || {}, r = {}; Object.keys(o).forEach(id => { if (o[id] && o[id][k] === v) r[id] = o[id]; }); return Object.keys(r).length ? r : null; } });
          return { on(e, cb) { ouvintes.push({ p, cb: sn => cb(f(sn)) }); setTimeout(() => cb(f(snap(p))), 0); }, once() { return Promise.resolve(f(snap(p))); } }; } }; },
        push(v) { const r = ref((p ? p + '/' : '') + novaChave()); const pr = v === undefined ? Promise.resolve() : r.set(v); r.then = pr.then.bind(pr); r.catch = pr.catch.bind(pr); return r; }
      };
    }
    return { ref, reset() { try { localStorage.removeItem(KEY); } catch (e) {} tree = semente(); guardar(); } };
  }
  function demoAuth() {
    let user = null, cbs = [];
    const set = u => { user = u; cbs.forEach(c => c(u)); return Promise.resolve({ user: u }); };
    return {
      onAuthStateChanged(cb) { cbs.push(cb); setTimeout(() => cb(user), 0); },
      // No modo demo, entrar com o email "ana@exemplo.pt" (qualquer palavra-passe) entra como a colaboradora "ana"
      signInWithEmailAndPassword: (e) => { const id = String(e || '').split('@')[0]; return set(prof(id) ? { uid: 'demo-' + id, email: id + '@exemplo.pt' } : { uid: 'demo', email: 'demo@exemplo.pt' }); },
      signInWithPopup: () => set({ uid: 'demo', email: 'demo@exemplo.pt' }),
      signOut: () => set(null)
    };
  }

  // Dados fictícios para a demonstração (nomes e números inventados)
  function semente() {
    const nomes = ['Mariana Costa', 'Inês Lopes', 'Beatriz Sousa', 'Carolina Matos', 'Sofia Ramos', 'Rita Pacheco', 'Joana Pires', 'Catarina Neves', 'Ana Ferraz', 'Leonor Brito', 'Marta Vilar', 'Teresa Gomes', 'Helena Faria', 'Patrícia Melo'];
    let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    const reservas = {}, ocupacao = {};
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    let n = 0;
    for (let dd = -100; dd <= 14; dd++) {
      const d = new Date(hoje); d.setDate(d.getDate() + dd);
      const livres = HORAS.filter(h => aberto(d, h));
      if (!livres.length) continue;
      const qtd = Math.floor(rnd() * 4);
      for (let q = 0; q < qtd; q++) {
        const s = L.servicos[Math.floor(rnd() * L.servicos.length)], bl = blocosDe(s);
        const h = livres[Math.floor(rnd() * livres.length)];
        const r = { hora: h, blocos: bl };
        const sl = slotsDe(r), di = iso(d), pid = MODO_EQUIPA ? EQUIPA[Math.floor(rnd() * EQUIPA.length)].id : null;
        if (pid && !fazServico(prof(pid), s.nome)) continue;
        if (sl.length < bl || sl.some(x => !aberto(d, x, pid) || ocupadoEm(ocupacao, di, x, pid))) continue;
        const ci = Math.floor(rnd() * nomes.length), id = 'demo' + String(n++).padStart(4, '0');
        const passado = dd < 0, vou = L.vouchers.ativo && rnd() < 0.06;
        Object.assign(r, {
          dataExata: di, diaTextoVisual: visual(di), hIndex: HORAS.indexOf(h), servicoNome: s.nome, preco: s.preco,
          clienteNome: nomes[ci], clienteTelemovel: '9100000' + String(10 + ci), clienteEmail: 'N/A', clienteNif: 'Consumidor Final',
          pagamento: L.pagamentos[Math.floor(rnd() * L.pagamentos.length)],
          estadoPagamento: vou ? (passado && rnd() < 0.6 ? 'Voucher Pago' : 'Voucher') : (passado ? 'Já Pago' : 'A Pagar no Dia'),
          status: passado && rnd() < 0.05 ? 'noshow' : 'ativo', dataRegisto: new Date().toISOString(), mensagemEnviada: passado || rnd() < 0.5
        });
        if (r.estadoPagamento === 'Voucher Pago') r.precoLimpo = Math.round(s.preco * 0.7 * 2) / 2;
        if (pid) r.prof = pid;
        reservas[id] = r;
        sl.forEach(x => { const o = (ocupacao[di] = ocupacao[di] || {}); if (pid) (o[pid] = o[pid] || {})[x] = id; else o[x] = id; });
      }
    }
    return {
      reservas, ocupacao, precos: {}, bloqueios: {},
      admins: { demo: true },
      staff: Object.fromEntries(EQUIPA.map(p => ['demo-' + p.id, { id: p.id, email: p.id + '@exemplo.pt' }])),
      convites: Object.fromEntries(EQUIPA.map(p => [(p.id + '@exemplo,pt'), p.id])),
      config: { noticiasBarra: L.noticiaInicial || '', campanha: null }
    };
  }

  window.APP = {
    L, DEMO, HORAS, INT, DIAS_NOME, MESES, EQUIPA, MODO_EQUIPA, prof, fazServico, ocupadoEm, chaveOcup, mapaBloqueios, bloqueado,
    aberto, blocosDe, iso, isoParaData, visual, segunda, esc, eur, duracao, tpl, telInt, telValido, slotsDe, aplicarTema, iniciar,
    get db() { return _db; }, get auth() { return _auth; }
  };
})();
