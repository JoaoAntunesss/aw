/* core.js — partilhado pelo site, pela área de cliente e pelo painel. Não precisa de ser alterado por cliente. */
(function () {
  const M = window.MARCA;
  const DEMO = !(M.firebase && M.firebase.apiKey);

  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // *texto* -> <em>texto</em> (o resto é escapado)
  const enfase = s => esc(s).replace(/\*([^*]+)\*/g, '<em>$1</em>');
  const tpl = (t, o) => String(t || '').replace(/\{(\w+)\}/g, (_, k) => (o[k] != null ? o[k] : ''));
  const telInt = t => { let n = String(t || '').replace(/\D/g, ''); if (n.length === 9) n = M.indicativo + n; return n; };
  const telFmt = t => String(t || '').replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3');
  const dataLonga = iso => { if (!iso) return ''; const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : '')); return isNaN(d) ? iso : d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' }); };
  const dataCurta = ms => new Date(ms).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' }).replace('.', '');
  const hora = ms => new Date(ms).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  const ha = ms => { const m = Math.max(0, Math.round((Date.now() - ms) / 60000)); if (m < 1) return 'agora'; if (m < 60) return `há ${m} min`; const h = Math.floor(m / 60); if (h < 24) return `há ${h} h`; return dataCurta(ms); };
  const diasAte = iso => { if (!iso) return null; const d = new Date(iso + 'T12:00:00'); const h = new Date(); h.setHours(12, 0, 0, 0); return Math.round((d - h) / 864e5); };
  const tamanho = b => b > 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
  // Código do projeto (vai no link da área de cliente). Sem letras que se confundem (0/O, 1/l).
  const ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const gerarCodigo = () => { const r = new Uint8Array(10); crypto.getRandomValues(r); return Array.from(r, x => ABC[x % ABC.length]).join(''); };
  const limparCodigo = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
  const linkCliente = c => (DEMO ? new URL('cliente.html', location.href).href.split('?')[0] : (M.site || location.origin).replace(/\/$/, '') + '/cliente.html') + '?c=' + c;

  // ---------- Aspeto (cores e fontes a partir de marca.js) ----------
  function aplicarTema() {
    const c = M.cores, s = document.documentElement.style;
    s.setProperty('--fundo', c.fundo); s.setProperty('--fundo2', c.fundo2 || c.fundo); s.setProperty('--texto', c.texto);
    s.setProperty('--suave', c.suave || c.texto); s.setProperty('--destaque', c.destaque); s.setProperty('--destaque-escuro', c.destaqueEscuro || c.destaque);
    s.setProperty('--linha', c.linha || 'rgba(0,0,0,.12)');
    s.setProperty('--f-titulo', `'${M.fontes.titulo}', Georgia, serif`); s.setProperty('--f-texto', `'${M.fontes.texto}', system-ui, sans-serif`);
    const loc = M.fontesLocais || [], f = document.createElement('link'); f.rel = 'stylesheet';
    f.href = loc.includes(M.fontes.titulo) && loc.includes(M.fontes.texto) ? 'fonts/fonts.css'
      : 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(M.fontes.titulo) + ':ital,wght@0,300;0,400;0,500;1,300;1,400&family=' + encodeURIComponent(M.fontes.texto) + ':wght@400;500;600&display=swap';
    document.head.appendChild(f);
    const tc = document.querySelector('meta[name=theme-color]'); if (tc) tc.content = c.fundo;
  }
  const logoHtml = () => M.logo ? `<img src="${esc(M.logo)}" alt="${esc(M.nome)}">` : `<span class="marca-nome">${esc(M.nome)}</span>`;

  // =================================================================
  // Base de dados: Firebase a sério, ou uma imitação local (modo demonstração)
  // =================================================================
  const carregar = src => new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = ko; document.head.appendChild(s); });
  let _db = null, _auth = null;
  async function iniciar(comAuth) {
    if (_db) return;
    if (!DEMO) {
      const v = '10.12.5', b = `https://www.gstatic.com/firebasejs/${v}/`;
      await carregar(b + 'firebase-app-compat.js'); await carregar(b + 'firebase-database-compat.js');
      if (comAuth) await carregar(b + 'firebase-auth-compat.js');
      firebase.initializeApp(M.firebase); _db = firebase.database(); if (comAuth) _auth = firebase.auth();
      return;
    }
    _db = demoDB(); _auth = demoAuth();
  }
  const agora = () => (DEMO ? Date.now() : firebase.database.ServerValue.TIMESTAMP);

  function demoDB() {
    const KEY = 'demo-momento-' + M.id;
    let tree = null; try { tree = JSON.parse(localStorage.getItem(KEY)); } catch (e) { }
    if (!tree) tree = semente();
    const ouvintes = [], partes = p => (p || '').split('/').filter(Boolean);
    const ler = p => partes(p).reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), tree);
    function escrever(p, v) {
      const ks = partes(p); if (!ks.length) { tree = v || {}; return; }
      let o = tree; for (let i = 0; i < ks.length - 1; i++) { if (typeof o[ks[i]] !== 'object' || o[ks[i]] === null) o[ks[i]] = {}; o = o[ks[i]]; }
      const last = ks[ks.length - 1]; if (v === null || v === undefined) delete o[last]; else o[last] = JSON.parse(JSON.stringify(v));
    }
    function guardar() { try { localStorage.setItem(KEY, JSON.stringify(tree)); } catch (e) { } ouvintes.forEach(l => l.cb(snap(l.p))); }
    // outras abas do mesmo navegador (ex.: área de cliente e painel abertos ao mesmo tempo) veem as alterações
    addEventListener('storage', e => { if (e.key !== KEY) return; try { tree = JSON.parse(e.newValue) || semente(); } catch (x) { } ouvintes.forEach(l => l.cb(snap(l.p))); });
    const snap = p => { const v = ler(p); return { key: partes(p).pop(), exists: () => v !== undefined && v !== null, val: () => (v === undefined ? null : JSON.parse(JSON.stringify(v))) }; };
    let cont = 0; const novaChave = () => '-D' + Date.now().toString(36) + (cont++).toString(36) + Math.random().toString(36).slice(2, 6);
    function ref(p = '') {
      return {
        key: partes(p).pop() || null,
        on(_, cb) { const l = { p, cb }; ouvintes.push(l); setTimeout(() => cb(snap(p)), 0); return cb; },
        off() { for (let i = ouvintes.length - 1; i >= 0; i--) if (ouvintes[i].p === p) ouvintes.splice(i, 1); },
        once() { return Promise.resolve(snap(p)); },
        set(v) { escrever(p, v); guardar(); return Promise.resolve(); },
        update(o) { Object.keys(o).forEach(k => escrever(p ? p + '/' + k : k, o[k])); guardar(); return Promise.resolve(); },
        remove() { escrever(p, null); guardar(); return Promise.resolve(); },
        push(v) { const r = ref((p ? p + '/' : '') + novaChave()); const pr = v === undefined ? Promise.resolve() : r.set(v); r.then = pr.then.bind(pr); r.catch = pr.catch.bind(pr); return r; }
      };
    }
    return { ref, reset() { try { localStorage.removeItem(KEY); } catch (e) { } tree = semente(); guardar(); } };
  }
  function demoAuth() {
    let user = null; const cbs = [];
    const set = u => { user = u; cbs.forEach(c => c(u)); return Promise.resolve({ user: u }); };
    return { onAuthStateChanged(cb) { cbs.push(cb); setTimeout(() => cb(user), 0); }, signInWithEmailAndPassword: () => set({ uid: 'demo', email: 'demo@exemplo.pt' }), signInWithPopup: () => set({ uid: 'demo', email: 'demo@exemplo.pt' }), signOut: () => set(null), sendPasswordResetEmail: () => Promise.resolve() };
  }

  // Dados fictícios da demonstração (nomes inventados)
  function semente() {
    const h = Date.now(), min = m => h - m * 60000, dia = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
    const pedidos = {
      '-Dp1': { nome: 'Rita Fonseca', email: 'rita@exemplo.pt', telemovel: '912000001', tipo: 'Batizado', data: dia(48), local: 'Igreja de Leça e quinta em Matosinhos', convidados: 60, mensagem: 'Batizado da Leonor. Gostávamos de fotografias da cerimónia e da festa, sem poses.', criadoEm: min(35), estado: 'novo' },
      '-Dp2': { nome: 'Café Aurora', email: 'ola@cafeaurora.pt', telemovel: '912000002', tipo: 'Conteúdo para marca', data: '', local: 'Porto', convidados: 0, mensagem: 'Procuramos fotografias do espaço e dos pratos novos, e ajuda com o Instagram.', criadoEm: min(60 * 26), estado: 'respondido' }
    };
    const projetos = {
      DEMOANAPEDRO: {
        info: { nome: 'Ana & Pedro', tipo: 'Casamento', data: dia(146), local: 'Quinta em Amarante', email: 'ana@exemplo.pt', telemovel: '912000003', criadoEm: min(60 * 24 * 9) },
        etapa: 1,
        mensagens: {
          '-Dm1': { de: 'marca', t: tpl(M.boasVindas, { nome: 'Ana e Pedro' }), em: min(60 * 24 * 9) },
          '-Dm2': { de: 'cliente', t: 'Olá! Que bom. Já deixámos o convite e o moodboard nos ficheiros.', em: min(60 * 24 * 8) },
          '-Dm3': { de: 'marca', t: 'Já vi o vosso moodboard. Adorei os tons! Quando puderem, preencham as notas para o dia, sobretudo as fotos de grupo.', em: min(60 * 5) }
        },
        notas: { horarios: { cerimonia: '16:00', cocktail: '17:30', jantar: '20:00', bolo: '23:00' }, grupos: ['Noivos com os pais da Ana', 'Noivos com os pais do Pedro', 'Noivos com os padrinhos', 'Foto com a avó Rosa'], pessoas: ['Marta, irmã da Ana e madrinha', 'Rui, padrinho do Pedro', 'Sofia, wedding planner'], pedidos: 'Gostávamos muito de uma foto do momento em que o Pedro vê a Ana pela primeira vez.', em: min(60 * 30) },
        ficheiros: { '-Df1': { nome: 'Moodboard.jpg', tipo: 'image/jpeg', tam: 184000, url: 'img/convite.jpg', de: 'cliente', em: min(60 * 24 * 8) } },
        links: { '-Dl1': { url: 'https://we.tl/t-exemplo', desc: 'Referências de poses que gostamos', de: 'cliente', em: min(60 * 24 * 6) } },
        entregas: { '-De1': { titulo: 'Sessão de noivado', url: 'https://we.tl/t-exemplo-noivado', nota: '45 fotografias editadas', validade: dia(5), em: min(60 * 24 * 2) } },
        visto: { marca: min(60 * 5), cliente: min(60 * 24 * 8) }
      }
    };
    return { admins: { demo: true }, pedidos, projetos };
  }

  window.APP = { M, DEMO, esc, enfase, tpl, telInt, telFmt, dataLonga, dataCurta, hora, ha, diasAte, tamanho, gerarCodigo, limparCodigo, linkCliente, aplicarTema, logoHtml, iniciar, agora, get db() { return _db; }, get auth() { return _auth; } };
})();
