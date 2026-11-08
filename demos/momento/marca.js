/* =====================================================================
   MARCA.JS — o ÚNICO ficheiro a mudar para cada novo cliente.
   Tudo o resto (site, área de cliente, painel, regras, funções) lê daqui.
   Depois de editar, corre: node scripts/nova-marca.mjs
   (gera manifest.json, functions/marca.json e .firebaserc)

   A marca "Lume" é fictícia (demonstração). As fotografias de exemplo são do
   Unsplash (licença livre) — ver CREDITOS.md. Troca-as pelas do cliente.
   ===================================================================== */
window.MARCA = {
  id: "lume", // identificador curto, sem espaços
  nome: "Lume",
  nomeCompleto: "Lume · Fotografia & Eventos",
  donoNome: "Marta", // aparece no login: "Se és a Marta, entra com o teu email"
  slogan: "Fotografia, conteúdo e eventos",
  descricao: "Fotografia de casamentos, batizados e aniversários, conteúdo para marcas e organização de eventos.",
  site: "https://lume.pt", // endereço final do site (vai nos emails e no link da área de cliente)

  // ---------- Aspeto ----------
  logo: "", // opcional: "img/logo.png". Vazio = o nome escrito com a fonte dos títulos
  icone: "img/icone.png", // ícone da app (quadrado)
  cores: {
    fundo: "#F6F1EA",
    fundo2: "#EDE5D9", // secções alternadas
    texto: "#2B2420",
    suave: "#76695F", // texto secundário
    destaque: "#A07A4E", // botões, linhas, pormenores
    destaqueEscuro: "#6E5235",
    linha: "#DDD1C1"
  },
  fontes: { titulo: "Cormorant Garamond", texto: "DM Sans" }, // guardadas no site (RGPD: não envia o IP à Google)
  fontesLocais: ["Cormorant Garamond", "DM Sans"],

  // ---------- Página inicial ----------
  hero: {
    etiqueta: "Fotografia, conteúdo e eventos",
    titulo: "Os teus momentos, contados com *cuidado*.", // *texto* fica em itálico de destaque
    subtitulo: "Casamentos, batizados, aniversários e marcas. Do primeiro contacto à entrega das fotografias, tudo num só sítio.",
    imagens: { principal: "img/hero.jpg", fundo: "img/mesa-redonda.jpg", frente: "img/aliancas.jpg" },
    nota: ["Do planeamento", "à última fotografia."],
    selo: "FEITO COM TEMPO E CARINHO · HISTÓRIAS QUE FICAM · "
  },
  faixa: ["Casamentos", "Batizados", "Aniversários", "Eventos", "Conteúdo para marcas"],

  sobre: {
    etiqueta: "Quem sou",
    titulo: "Gosto de pessoas e de *pormenores*.",
    destaque: "Sou a Marta. Fotografo casamentos, batizados e festas, e crio conteúdo para marcas pequenas que querem comunicar com verdade.",
    texto: [
      "Antes de cada trabalho, quero perceber quem são as pessoas e o que querem guardar daquele dia. É isso que decide o que fotografo e como conto a história.",
      "Trabalho com tempo, com calma e com atenção ao que quase ninguém repara: uma mão no ombro, uma mesa antes de os convidados chegarem, a avó a rir."
    ],
    foto: "img/retrato.jpg",
    legenda: "Marta, fotógrafa",
    assinatura: "Com carinho, Marta"
  },

  servicos: [
    { simbolo: "♡", tipo: "Celebração", nome: "Casamentos", texto: "Do getting ready à última dança, com reportagem completa e um álbum para guardar.", itens: ["Reportagem do dia", "Sessão de noivado", "Álbum e galeria online"] },
    { simbolo: "✿", tipo: "Família", nome: "Batizados e aniversários", texto: "Momentos de família com luz natural e sem poses forçadas.", itens: ["Cerimónia e festa", "Fotos de família", "Entrega em 3 semanas"] },
    { simbolo: "✳", tipo: "Marcas", nome: "Conteúdo e redes sociais", texto: "Fotografia e vídeo para marcas, e gestão das redes com um calendário pensado.", itens: ["Sessões de produto", "Reels e vídeo curto", "Gestão mensal das redes"] },
    { simbolo: "◇", tipo: "Organização", nome: "Eventos", texto: "Organização e decoração de festas e eventos de empresa, do conceito ao dia.", itens: ["Conceito e decoração", "Fornecedores", "Coordenação no dia"] }
  ],

  // O portefólio aparece num carrossel 3D. "categoria" e "titulo" aparecem por baixo.
  portefolio: [
    { img: "img/casamento-mesa.jpg", categoria: "Casamentos", titulo: "Uma mesa ao pôr do sol" },
    { img: "img/batizado.jpg", categoria: "Batizados", titulo: "O primeiro capítulo" },
    { img: "img/sapatos.jpg", categoria: "Casamentos", titulo: "Os pormenores do dia" },
    { img: "img/aniversario.jpg", categoria: "Aniversários", titulo: "Flores e chapéus de festa" },
    { img: "img/jantar.jpg", categoria: "Eventos", titulo: "Jantar de empresa" },
    { img: "img/conteudo.jpg", categoria: "Marcas", titulo: "Bastidores de uma sessão" }
  ],

  passos: [
    { titulo: "Pedes um orçamento", texto: "Contas-me a ideia, a data e o local. Respondo em menos de 48 horas." },
    { titulo: "Preparamos juntos", texto: "Recebes acesso à tua área de cliente: mensagens, notas para o dia e ficheiros." },
    { titulo: "O grande dia", texto: "Estou lá do princípio ao fim, sem pressas e com atenção a tudo." },
    { titulo: "Recebes as fotografias", texto: "A entrega chega à tua área de cliente, com um guia para as descarregar." }
  ],

  // Testemunhos: na demonstração são fictícios. Troca pelos dos teus clientes, ou deixa a lista vazia [].
  testemunhos: [
    { texto: "Esquecemo-nos de que havia uma fotógrafa no casamento. E depois as fotografias mostraram tudo o que não tínhamos visto.", autor: "Ana e Pedro, casamento (exemplo)" },
    { texto: "As notas para o dia foram uma ajuda enorme: não faltou nenhuma fotografia de família.", autor: "Sofia, batizado do Tomás (exemplo)" }
  ],

  // ---------- Pedido de orçamento ----------
  tiposEvento: ["Casamento", "Batizado", "Aniversário", "Evento de empresa", "Conteúdo para marca", "Gestão de redes sociais", "Outro"],
  respostaEmHoras: 48,

  // ---------- Área de cliente ----------
  // Passos que o cliente vê na sua área (o painel escolhe em que passo está cada projeto)
  etapas: ["Proposta aceite", "Preparação", "O grande dia", "Seleção e edição", "Entrega"],
  boasVindas: "Olá {nome}! Bem-vindos à vossa área. Aqui podemos falar sobre tudo, deixar notas para o dia e partilhar ficheiros sem se perder nada.",
  ficheiroMaxMB: 3, // ficheiros maiores: por link (WeTransfer, Google Drive)

  // ---------- Contactos ----------
  contactos: {
    email: "ola@lume.pt",
    telefone: "910000000",
    instagram: "lume.fotografia",
    cidade: "Porto, Portugal"
  },
  indicativo: "351",
  dominio: "lume.pt",

  // ---------- Firebase (vazio = modo demonstração, dados só no navegador) ----------
  firebase: { apiKey: "", authDomain: "", databaseURL: "", projectId: "", appId: "" },
  regiaoBD: "europe-west1",
  fuso: "Europe/Lisbon",

  // Ao entregar o site: https://joaoantunesss.github.io/aw/#suporte?site=NOME-DO-SITE
  suporteUrl: ""
};
