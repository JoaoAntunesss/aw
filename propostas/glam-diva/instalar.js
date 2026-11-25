/* Instalar a app (PWA): botão sempre visível no site, instruções para iPhone e
   para computador, e abertura automática quando se chega pelo QR do balcão (?instalar=1).
   Usa window.LOJA (nome, cores, ícone). Não precisa de mais nada. */
(function () {
  const L = window.LOJA || {}, iOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const instalada = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const movel = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) || iOS;
  let prompt = null;
  const css = `
  .awi-btn{display:inline-flex;align-items:center;gap:8px;border:1px solid currentColor;background:transparent;color:inherit;border-radius:999px;padding:8px 16px;font:inherit;font-size:.9rem;cursor:pointer}
  .awi-btn svg{width:18px;height:18px}
  .awi-fundo{position:fixed;inset:0;z-index:900;background:#0008;display:flex;align-items:flex-end;justify-content:center;padding:16px}
  .awi-cx{width:min(440px,100%);background:#fff;color:#222;border-radius:18px;padding:22px 22px 18px;box-shadow:0 20px 60px #0005;font-family:inherit;max-height:90vh;overflow:auto}
  @media (min-width:700px){.awi-fundo{align-items:center}}
  .awi-cx h3{margin:0 0 4px;font-size:1.25rem}
  .awi-cx p{margin:0 0 12px;color:#555;line-height:1.5}
  .awi-cx ol{margin:0 0 16px;padding-left:22px;line-height:1.7}
  .awi-ic{display:inline-flex;vertical-align:-4px;width:20px;height:20px}
  .awi-acoes{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
  .awi-acoes button{border:0;border-radius:999px;padding:10px 18px;font:inherit;font-weight:600;cursor:pointer}
  .awi-sim{background:var(--accent-color,${L.cores ? L.cores.destaque : '#333'});color:#fff}
  .awi-nao{background:#eee;color:#333}
  .awi-qr{display:flex;justify-content:center;margin:4px 0 14px}.awi-qr svg{width:180px;height:180px}
  .awi-topo{display:flex;align-items:center;gap:12px;margin-bottom:12px}.awi-topo img{width:52px;height:52px;border-radius:12px;object-fit:cover}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M12 7v7m-3-3 3 3 3-3M10 18.5h4"/></svg>';
  const PARTILHAR = '<span class="awi-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8"/></svg></span>';
  const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const siteUrl = () => location.origin + location.pathname.replace(/[^/]*$/, '');

  function caixa(html, botoes) {
    fechar();
    const f = document.createElement('div'); f.className = 'awi-fundo'; f.id = 'awi';
    f.innerHTML = `<div class="awi-cx" role="dialog" aria-modal="true" aria-labelledby="awi-t">${html}<div class="awi-acoes">${botoes}</div></div>`;
    f.addEventListener('click', (e) => { if (e.target === f || e.target.closest('[data-awi-fechar]')) fechar(); });
    document.body.appendChild(f); const b = f.querySelector('button'); if (b) b.focus();
    return f;
  }
  function fechar() { const f = document.getElementById('awi'); if (f) f.remove(); }
  addEventListener('keydown', (e) => { if (e.key === 'Escape') fechar(); });
  const topo = (t) => `<div class="awi-topo">${L.icone ? `<img src="${esc(L.icone)}" alt="">` : ''}<div><h3 id="awi-t">${esc(t)}</h3><p style="margin:0">${esc(L.nome || document.title)}</p></div></div>`;

  function abrir() {
    if (instalada()) { caixa(topo('A app já está instalada'), '<button class="awi-nao" data-awi-fechar>Fechar</button>'); return; }
    if (prompt) {
      const f = caixa(topo('Instalar a app') + '<p>Fica no ecrã principal do telemóvel, como as outras apps. Para marcar, basta abrir.</p>', '<button class="awi-nao" data-awi-fechar>Agora não</button><button class="awi-sim" id="awi-ok">Instalar</button>');
      f.querySelector('#awi-ok').onclick = async () => { const p = prompt; prompt = null; fechar(); p.prompt(); try { await p.userChoice; } catch (e) { /* */ } pintar(); };
      return;
    }
    if (iOS) {
      caixa(topo('Instalar no iPhone') + `<ol><li>Toque em ${PARTILHAR} <b>Partilhar</b>, na barra do Safari.</li><li>Escolha <b>Adicionar ao ecrã principal</b>.</li><li>Toque em <b>Adicionar</b>.</li></ol><p>Se estiver noutra app (Instagram, WhatsApp), abra primeiro este site no Safari.</p>`, '<button class="awi-sim" data-awi-fechar>Percebi</button>');
      return;
    }
    if (movel) {
      caixa(topo('Instalar a app') + '<ol><li>Toque no menu <b>⋮</b> do navegador.</li><li>Escolha <b>Instalar app</b> ou <b>Adicionar ao ecrã principal</b>.</li></ol><p>Se estiver dentro de outra app (Instagram, Facebook), abra primeiro o site no Chrome.</p>', '<button class="awi-sim" data-awi-fechar>Percebi</button>');
      return;
    }
    const qr = window.qrcode ? (() => { const q = window.qrcode(0, 'M'); q.addData(siteUrl() + '?instalar=1'); q.make(); return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); })() : '';
    caixa(topo('Instalar no telemóvel') + `<p>Aponte a câmara do telemóvel para o código e siga os passos.</p>${qr ? `<div class="awi-qr">${qr}</div>` : ''}`, '<button class="awi-sim" data-awi-fechar>Fechar</button>');
  }
  function pintar() {
    document.querySelectorAll('[data-instalar]').forEach((b) => { b.hidden = instalada(); if (!b.dataset.awiPronto) { b.dataset.awiPronto = '1'; b.addEventListener('click', (e) => { e.preventDefault(); abrir(); }); } });
  }
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); prompt = e; pintar(); });
  addEventListener('appinstalled', () => { prompt = null; pintar(); });
  window.AWInstalar = { abrir, pintar, botao: (cls) => `<button type="button" class="awi-btn ${cls || ''}" data-instalar>${ICON}<span>Instalar a app</span></button>` };
  const inicio = () => { pintar(); if (/[?&]instalar=1\b/.test(location.search) && !instalada()) setTimeout(abrir, 900); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inicio); else inicio();
})();
