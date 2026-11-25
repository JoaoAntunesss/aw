/* =====================================================================
   LOJA.JS — o ÚNICO ficheiro a mudar para cada novo cliente.
   Tudo o resto (site, painel, regras, funções) lê daqui.
   Depois de editar, corre: node scripts/nova-loja.mjs
   (gera manifest.json, admin-manifest.json, .firebaserc e functions/loja.json)
   ===================================================================== */
window.LOJA = {
  id: "glam-diva", // identificador curto, sem espaços
  nome: "Glam Diva",
  nomeCurto: "Glam Diva", // nome na app instalada (PWA)
  slogan: "Sobrancelhas & Estética em Matosinhos",
  descricao: "Design de sobrancelhas com linha e estética em Matosinhos — marcações online",
  site: "https://awdigital.pt/propostas/glam-diva/", // endereço final do site, ex.: "https://studio.awdigital.pt" (usado no QR do cartaz). Vazio = o endereço onde o site está aberto

  // ---------- Aspeto ----------
  logo: "img/logo.svg",
  logoClaro: "img/logo-claro.svg", // opcional: versão branca do logo para o topo (sem ela, o logo vai numa pastilha branca)
  icone: "img/icone.svg", // ícone da app (quadrado)
  cores: {
    fundo: "#fbf8f6",
    texto: "#231b1f",
    destaque: "#9c3d5c", // botões, preços
    destaqueEscuro: "#5e2338", // títulos, banners
    painelFundo: "#f7f1f3"
  },
  fontes: { titulo: "Playfair Display", texto: "Lato" }, // fontes guardadas no site (RGPD: não envia o IP à Google)
  fontesLocais: ["Playfair Display", "Lato"], // se mudares as fontes, para outra que não esteja aqui, o site volta a pedir à Google Fonts

  hero: {
    imagem: "img/hero.svg",
    titulo: "Sobrancelhas *perfeitas*, à linha", // *palavra* fica em itálico de destaque
    subtitulo: "Na Avenida Menéres, em Matosinhos. Escolha o serviço, o dia e a hora, e receba a confirmação no WhatsApp."
  },
  noticiaInicial: "Agora já pode marcar online, a qualquer hora.",

  // ---------- Contactos ----------
  morada: ["Av. Menéres, 570", "4450-189 Matosinhos"],
  mapa: "https://maps.google.com/?q=Glam+Diva+Av.+Men%C3%A9res+570+Matosinhos",
  telefone: "914439465", // aparece no site e no botão WhatsApp
  indicativo: "351",
  redes: [],
  fotoLoja: "img/loja.svg",

  galeria: [
    { src: "img/g1.svg", alt: "Unhas de gel" },
    { src: "img/g2.svg", alt: "Lifting de pestanas" },
    { src: "img/g3.svg", alt: "Massagem" },
    { src: "img/g4.svg", alt: "Design de sobrancelhas" },
    { src: "img/g5.svg", alt: "Limpeza de pele" },
    { src: "img/g6.svg", alt: "Verniz gel" }
  ],
  // Descrição curta opcional por serviço: acrescente desc: "..." a cada serviço.

  // ---------- Avaliações (copie as REAIS do Google; nunca invente) ----------
  // nota/total: null para esconder o cartão. lista: [] para esconder a secção.
  avaliacoes: { nota: null, total: null, link: "", lista: [] },

  // ---------- Agenda ----------
  agenda: {
    intervaloMin: 30, // tamanho de cada bloco da agenda
    // Horas de abertura por dia. Vários intervalos = pausa de almoço.
    // null = fechado. Formato: [["abre","fecha"], ...]
    horario: {
      seg: null,
      ter: [["10:00", "20:00"]],
      qua: [["10:00", "20:00"]],
      qui: [["10:00", "20:00"]],
      sex: [["10:00", "20:00"]],
      sab: [["10:00", "19:00"]],
      dom: null
    }
  },

  // ---------- Serviços (min = duração em minutos) ----------
  servicos: [
    { cat: "Sobrancelhas", nome: "Design de sobrancelhas com linha", desc: "Desenho à medida do rosto, sem cera", min: 30, preco: 10 },
    { cat: "Sobrancelhas", nome: "Sobrancelhas e buço com linha", desc: "", min: 30, preco: 12 },
    { cat: "Sobrancelhas", nome: "Design com henna", desc: "Cor e definição que duram semanas", min: 45, preco: 18 },
    { cat: "Sobrancelhas", nome: "Brow lamination", desc: "Pelos alinhados e com volume", min: 60, preco: 25 },
    { cat: "Rosto", nome: "Epilação do rosto com linha", desc: "", min: 30, preco: 15 },
    { cat: "Rosto", nome: "Buço com linha", desc: "", min: 15, preco: 5 },
    { cat: "Pestanas", nome: "Lifting de pestanas", desc: "Olhar aberto sem extensões", min: 60, preco: 25 },
    { cat: "Pestanas", nome: "Coloração de pestanas", desc: "", min: 30, preco: 8 },
    { cat: "Mãos", nome: "Manicure com verniz gel", desc: "Brilho que dura até três semanas", min: 60, preco: 15 }
  ],

  pagamentos: [" MB Way", " Multibanco", " Numerário (no local)"],
  pedirNif: true,

  // Vouchers de plataformas (ex.: Odisseias). ativo:false esconde tudo.
  vouchers: { ativo: false, nome: "" },

  // ---------- Equipa ----------
  // Salão de uma pessoa: deixe a lista vazia. Com equipa: veja exemplos/loja-equipa.js
  equipa: [],

  // ---------- Painel ----------
  admin: { nome: "Glam Diva", titulo: "Painel da Glam Diva" },

  mensagens: {
    // {nome} {servico} {data} {hora} {loja}
    confirmacao: "Olá {nome}! A sua marcação para *{servico}* está confirmada para dia *{data} às {hora}* no {loja}. Muito obrigada!",
    confirmacaoVarias: "Olá {nome}! As suas marcações no {loja} estão confirmadas:",
    despedida: "Muito obrigada e até breve! "
  },

  // ---------- Serviços externos ----------
  // EmailJS (email de confirmação à cliente). Deixa "" para desligar.
  // A public key do EmailJS é pública por natureza: restringe o domínio no painel do EmailJS.
  // ---------- RGPD (página privacidade.html e aviso na marcação) ----------
  // Preenche com os dados de quem é responsável pelo negócio. O que ficar vazio não aparece.
  rgpd: { responsavel: "", nif: "", morada: "", email: "", retencao: "até 2 anos após a última marcação", prestador: "AW (awdigital.pt)" },

  emailjs: { publicKey: "", servico: "", template: "" },

  // Firebase do cliente (Consola Firebase > Definições do projeto > A tua app Web).
  // apiKey vazio = MODO DEMONSTRAÇÃO (dados fictícios guardados só no navegador).
  firebase: {
    apiKey: "",
    authDomain: "",
    databaseURL: "",
    projectId: "",
    appId: ""
  },
  regiaoBD: "europe-west1", // região da Realtime Database (para as Functions)
  fuso: "Europe/Lisbon",
  resumoDiario: "19:30", // hora do resumo diário no Telegram da dona

  // Ligação "Pedir suporte" no painel do cliente. O botão aparece sempre.
  // já vem preenchido; ao entregar um site junta o nome: "https://awdigital.pt/#suporte?site=NOME-DO-SITE"
  suporteUrl: "https://awdigital.pt/#suporte",
  creditos: { texto: "Site por AW · awdigital.pt", email: "awdigital.pt@gmail.com" }
};
