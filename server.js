require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const app = express();
const PORT = process.env.PORT || 3000;

// Necessário para req.ip funcionar corretamente atrás de proxy/load balancer (Render, nginx, etc.)
app.set('trust proxy', 1);

// Rate limit global: 200 requisições por minuto, por IP, em todas as rotas
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(404).end();
  },
});
app.use(globalLimiter);

app.use(express.json());
app.use(cookieParser());

const { router: authRouter, requireAuth, checkAuth } = require('./auth');
const shsRouter = require('./shs');
const { renderLoginPage } = require('./login');

app.use('/auth', authRouter);
app.use('/shs', requireAuth, shsRouter); // tudo em /shs exige sessão válida

app.get('/favicon.ico', (req, res) => {
  res.sendFile(require('path').join(__dirname, 'favicon.ico'));
});

// Formata o nome do usuário pra exibir na barra superior:
// - 1 palavra: mostra inteira
// - 2 palavras: primeiro nome + sobrenome (abreviado pra "X." se tiver mais de 3 letras)
// - 3 palavras: primeiro nome + nome do meio abreviado (mesma regra) + último nome inteiro
// - 4+ palavras: mostra só o primeiro nome
function formatDisplayName(rawName) {
  if (typeof rawName !== 'string') return '';
  const words = rawName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';

  const abbreviate = (word) => (word.length > 3 ? `${word[0]}.` : word);

  if (words.length === 1) return words[0];
  if (words.length === 2) return `${words[0]} ${abbreviate(words[1])}`;
  if (words.length === 3) return `${words[0]} ${abbreviate(words[1])} ${words[2]}`;
  return words[0];
}

app.get('/', async (req, res) => {
  const user = await checkAuth(req, res);
  if (!user) {
    return res.type('html').send(renderLoginPage());
  }
  const displayName = formatDisplayName(user.name);

  res.type('html').send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Auron Company Invest — Fábrica &amp; Concessionária</title>
<meta name="description" content="Fábrica e concessionária própria de veículos. Da chapa de aço ao showroom: modelos X1, GT, E-ONE e LUX da linha Auron MVIST.">
<link rel="icon" type="image/x-icon" href="/favicon.ico">

<meta property="og:type" content="website">
<meta property="og:site_name" content="Auron Company MVIST">
<meta property="og:title" content="Auron Company Invest — Engenharia em movimento.">
<meta property="og:description" content="Fábrica e concessionária própria de veículos. Da chapa de aço ao showroom: modelos X1, GT, E-ONE e LUX da linha Auron MVIST.">
<meta property="og:image" content="https://raw.githubusercontent.com/KingMods1k/systemhub-shs/main/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="https://server-for-application.onrender.com">
<meta property="og:locale" content="pt_BR">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Auron Company Invest — Engenharia em movimento.">
<meta name="twitter:description" content="Fábrica e concessionária própria de veículos. Da chapa de aço ao showroom.">
<meta name="twitter:image" content="https://raw.githubusercontent.com/KingMods1k/systemhub-shs/main/og-image.png">

<style>
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Archivo:wght@400;500;600;700&display=swap');

:root{
  --bg: #0a0a0c;
  --bg-alt: #111114;
  --gold: #c9a24b;
  --gold-dim: #8a7038;
  --text: #e8e6e0;
  --text-dim: #8a8a90;
  --line: #2a2a2f;
  --red: #7d1f1f;
}

*{margin:0;padding:0;box-sizing:border-box}

html{scroll-behavior:smooth}

body{
  background:var(--bg);
  color:var(--text);
  font-family:'Archivo',sans-serif;
  overflow-x:hidden;
}

h1,h2,h3,.display{
  font-family:'Bebas Neue',sans-serif;
  letter-spacing:.01em;
  font-weight:400;
  line-height:.92;
}

::selection{background:var(--gold);color:var(--bg)}

/* ---------- reveal on scroll ---------- */
.reveal{
  opacity:0;
  transform:translateY(28px);
  transition:opacity .9s cubic-bezier(.16,1,.3,1), transform .9s cubic-bezier(.16,1,.3,1);
}
.reveal.in{opacity:1;transform:translateY(0)}
.reveal-delay-1{transition-delay:.12s}
.reveal-delay-2{transition-delay:.24s}
.reveal-delay-3{transition-delay:.36s}

@media (prefers-reduced-motion: reduce){
  .reveal{opacity:1;transform:none;transition:none}
  .type-line span{animation:none !important;opacity:1 !important}
}

/* ---------- nav ---------- */
nav{
  position:fixed;top:0;left:0;right:0;z-index:100;
  display:flex;justify-content:space-between;align-items:center;
  padding:26px 6vw;
  mix-blend-mode:difference;
}
.nav-mark{font-family:'Bebas Neue';font-size:22px;letter-spacing:.08em}
.nav-right{display:flex;align-items:center;gap:36px}
.nav-links{display:flex;gap:36px;font-size:13px;letter-spacing:.04em}
.nav-links a{color:var(--text);text-decoration:none;opacity:.8;transition:opacity .25s}
.nav-links a:hover{opacity:1}
.nav-user{font-family:'Archivo';font-size:13px;font-weight:600;letter-spacing:.04em;color:var(--gold)}
@media (max-width:720px){.nav-links{display:none}}

/* ---------- hero ---------- */
.hero{
  min-height:100vh;
  display:flex;
  flex-direction:column;
  justify-content:flex-end;
  padding:0 6vw 8vh;
  position:relative;
  border-bottom:1px solid var(--line);
}
.hero-bg{
  position:absolute;inset:0;
  background:
    radial-gradient(ellipse 60% 50% at 70% 20%, rgba(201,162,75,.10), transparent),
    repeating-linear-gradient(100deg, transparent 0 120px, rgba(255,255,255,.018) 120px 121px);
  pointer-events:none;
}
.hero-eyebrow{
  font-size:14px;color:var(--gold);letter-spacing:.14em;
  margin-bottom:22px;
}
.hero-title{
  font-size:clamp(64px,13vw,168px);
  color:var(--text);
}
.hero-title .line{overflow:hidden;display:block}
.hero-title .line span{
  display:inline-block;
  transform:translateY(105%);
  animation:riseUp .9s cubic-bezier(.16,1,.3,1) forwards;
}
.hero-title .line:nth-child(1) span{animation-delay:.15s}
.hero-title .line:nth-child(2) span{animation-delay:.32s}
@keyframes riseUp{to{transform:translateY(0)}}

.hero-sub{
  max-width:520px;
  margin-top:28px;
  font-size:17px;
  line-height:1.6;
  color:var(--text-dim);
  opacity:0;
  animation:fadeIn 1s ease forwards;
  animation-delay:.75s;
}
@keyframes fadeIn{to{opacity:1}}

.hero-meta{
  display:flex;gap:48px;margin-top:56px;
  opacity:0;animation:fadeIn 1s ease forwards;animation-delay:.95s;
}
.hero-meta div{font-size:13px;color:var(--text-dim)}
.hero-meta strong{display:block;font-family:'Bebas Neue';font-size:28px;color:var(--text);letter-spacing:.02em}

/* ---------- section shell ---------- */
section{padding:140px 6vw;position:relative}
.section-alt{background:var(--bg-alt)}
.eyebrow{font-size:13px;color:var(--gold);letter-spacing:.1em;margin-bottom:18px}
.section-title{font-size:clamp(40px,6vw,84px);max-width:900px}
.section-lede{max-width:560px;color:var(--text-dim);font-size:17px;line-height:1.7;margin-top:28px}

/* ---------- sobre ---------- */
.sobre-grid{
  display:grid;grid-template-columns:1.1fr .9fr;gap:80px;margin-top:80px;
}
@media (max-width:900px){.sobre-grid{grid-template-columns:1fr}}
.sobre-stats{display:flex;flex-direction:column;gap:0}
.stat-row{
  display:flex;justify-content:space-between;align-items:baseline;
  padding:26px 0;border-top:1px solid var(--line);
}
.stat-row:last-child{border-bottom:1px solid var(--line)}
.stat-label{font-size:14px;color:var(--text-dim)}
.stat-value{font-family:'Bebas Neue';font-size:42px;color:var(--gold)}

/* ---------- linha (modelos) ---------- */
.linha-list{margin-top:70px;border-top:1px solid var(--line)}
.linha-item{
  display:grid;grid-template-columns:70px 1fr 220px 40px;
  align-items:center;
  padding:34px 0;
  border-bottom:1px solid var(--line);
  cursor:pointer;
  transition:padding-left .3s ease, background .3s ease;
}
.linha-item:hover{padding-left:18px;background:rgba(201,162,75,.04)}
.linha-num{font-family:'Bebas Neue';font-size:16px;color:var(--gold-dim)}
.linha-name{font-family:'Bebas Neue';font-size:clamp(26px,4vw,48px);letter-spacing:.01em}
.linha-tag{font-size:13px;color:var(--text-dim);letter-spacing:.04em}
.linha-status{
  font-size:11px;letter-spacing:.08em;color:var(--text-dim);
  border:1px solid var(--line);border-radius:100px;
  padding:7px 14px;text-align:center;white-space:nowrap;justify-self:start;
}
.linha-arrow{font-size:22px;color:var(--gold);opacity:0;transform:translateX(-8px);transition:.3s}
.linha-item:hover .linha-arrow{opacity:1;transform:translateX(0)}
@media (max-width:720px){
  .linha-item{grid-template-columns:40px 1fr;row-gap:10px}
  .linha-status,.linha-arrow{grid-column:2}
}

/* preview 3D placeholder (visual, sem three.js) */
.preview-note{
  margin-top:56px;padding:28px 30px;border:1px dashed var(--line);
  border-radius:4px;font-size:14px;color:var(--text-dim);line-height:1.7;
  display:flex;gap:18px;align-items:flex-start;
}
.preview-note .dot{width:8px;height:8px;border-radius:50%;background:var(--gold);margin-top:7px;flex:none}

/* ---------- modelo cards com carro SVG de fundo ---------- */
.modelos-grid{margin-top:70px;display:grid;grid-template-columns:1fr 1fr;gap:2px;background:var(--line)}
@media (max-width:820px){.modelos-grid{grid-template-columns:1fr}}
.modelo-card{
  position:relative;background:var(--bg);padding:44px 38px 38px;
  min-height:340px;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;
}
.modelo-car-svg{position:absolute;top:36px;right:-10px;width:78%;opacity:.55;pointer-events:none}
.modelo-kicker{font-size:12px;letter-spacing:.1em;color:var(--gold-dim);position:relative;z-index:2}
.modelo-name{font-family:'Bebas Neue';font-size:clamp(30px,4vw,44px);position:relative;z-index:2;margin-top:6px}
.modelo-tag{font-size:14px;color:var(--text-dim);max-width:320px;margin-top:10px;position:relative;z-index:2}
.modelo-specs{list-style:none;display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:22px;position:relative;z-index:2}
.modelo-specs li{font-size:12px;color:var(--text-dim)}
.modelo-specs li::before{content:'—';color:var(--gold);margin-right:6px}
.modelo-price{margin-top:24px;position:relative;z-index:2}
.modelo-price span{display:block;font-size:11px;letter-spacing:.08em;color:var(--text-dim)}
.modelo-price strong{font-family:'Bebas Neue';font-size:30px;color:var(--gold)}

/* ---------- motor ---------- */
.motor-wrap{margin-top:70px;display:grid;grid-template-columns:1.15fr .85fr;gap:60px;align-items:center}
@media (max-width:900px){.motor-wrap{grid-template-columns:1fr}}
.motor-svg-box{background:var(--bg-alt);border:1px solid var(--line);padding:20px}
.motor-specs{border-top:1px solid var(--line)}
.motor-specs .stat-row{padding:20px 0}
.motor-specs .stat-value{font-size:30px}

/* ---------- carreiras ---------- */
.carreiras{
  display:grid;grid-template-columns:1fr 1fr;gap:80px;margin-top:80px;
}
@media (max-width:900px){.carreiras{grid-template-columns:1fr}}
.carreiras-copy p{color:var(--text-dim);font-size:17px;line-height:1.75;margin-bottom:20px}
.uniform-card{
  border:1px solid var(--line);padding:44px 38px;
  background:linear-gradient(160deg, rgba(201,162,75,.06), transparent 60%);
}
.uniform-card h3{font-size:30px;margin-bottom:16px}
.uniform-list{list-style:none;display:flex;flex-direction:column;gap:14px;margin-top:24px}
.uniform-list li{
  display:flex;gap:14px;font-size:15px;color:var(--text-dim);align-items:baseline;
}
.uniform-list li::before{content:'—';color:var(--gold);flex:none}

/* ---------- cta final ---------- */
.cta{
  min-height:70vh;display:flex;flex-direction:column;justify-content:center;
  text-align:left;border-top:1px solid var(--line);
}
.cta-title{font-size:clamp(48px,9vw,120px);max-width:1000px}
.cta-title em{font-style:normal;color:var(--gold)}
.cta-actions{display:flex;gap:20px;margin-top:48px;flex-wrap:wrap}
.btn{
  font-family:'Archivo';font-size:15px;font-weight:600;
  padding:18px 34px;border-radius:2px;text-decoration:none;
  transition:transform .25s ease, background .25s ease;
  display:inline-block;
}
.btn-primary{background:var(--gold);color:var(--bg)}
.btn-primary:hover{transform:translateY(-3px)}
.btn-ghost{border:1px solid var(--line);color:var(--text)}
.btn-ghost:hover{border-color:var(--gold);color:var(--gold)}

footer{
  padding:50px 6vw;border-top:1px solid var(--line);
  display:flex;justify-content:space-between;color:var(--text-dim);font-size:13px;
  flex-wrap:wrap;gap:16px;
}
</style>
</head>
<body>

<nav>
  <div class="nav-mark">AURON</div>
  <div class="nav-right">
    <div class="nav-links">
      <a href="#sobre">Sobre</a>
      <a href="#linha">Linha</a>
      <a href="#motor">Motor</a>
      <a href="#carreiras">Carreiras</a>
      <a href="#investir">Investir</a>
    </div>
    <div class="nav-user">${displayName}</div>
  </div>
</nav>

<header class="hero">
  <div class="hero-bg"></div>
  <div class="hero-eyebrow">Auron Company Invest — Fábrica &amp; Concessionária</div>
  <h1 class="hero-title">
    <span class="line"><span>ENGENHARIA</span></span>
    <span class="line"><span>EM MOVIMENTO.</span></span>
  </h1>
  <p class="hero-sub">Projetamos, fabricamos e entregamos veículos com a mesma régua: precisão de linha de montagem e obsessão pelo detalhe. Esta é a Auron.</p>
  <div class="hero-meta">
    <div><strong>04</strong>modelos em linha</div>
    <div><strong>2018</strong>ano de fundação</div>
    <div><strong>03</strong>unidades operacionais</div>
  </div>
</header>

<section id="sobre">
  <div class="eyebrow reveal">Sobre a Auron</div>
  <h2 class="section-title reveal reveal-delay-1">Da chapa de aço<br>ao showroom.</h2>
  <div class="sobre-grid">
    <p class="section-lede reveal reveal-delay-2">A Auron nasce para ocupar o espaço entre a engenharia pesada e a experiência de quem compra o carro pronto. Uma única companhia cuidando de toda a cadeia: fábrica própria, concessionária própria, padrão único do primeiro parafuso à entrega das chaves. Três unidades, uma só régua de qualidade — Auron Company Center (fábrica), Auron Dealership (concessionária) e Auron Company Invest (holding financeira).</p>
    <div class="sobre-stats reveal reveal-delay-3">
      <div class="stat-row"><span class="stat-label">Exportações realizadas</span><span class="stat-value">4.817</span></div>
      <div class="stat-row"><span class="stat-label">Satisfação jurídica e legal</span><span class="stat-value">97,3%</span></div>
      <div class="stat-row"><span class="stat-label">Reputação geral de mercado</span><span class="stat-value">78%</span></div>
    </div>
  </div>
</section>

<section id="linha" class="section-alt">
  <div class="eyebrow reveal">Linha de produção</div>
  <h2 class="section-title reveal reveal-delay-1">Os modelos<br>Auron.</h2>
  <p class="section-lede reveal reveal-delay-2">Quatro modelos abrem a linha MVIST, da mobilidade elétrica ao esportivo de alta performance. Fichas técnicas completas e modelos 3D interativos entram no ar nas próximas semanas.</p>

  <div class="modelos-grid">
    <div class="modelo-card reveal">
      <svg class="modelo-car-svg" viewBox="0 0 400 180" xmlns="http://www.w3.org/2000/svg">
        <path d="M40 130 Q50 95 100 88 L140 60 Q170 48 220 50 L270 60 Q310 68 330 95 L350 130 Z" fill="none" stroke="#c9a24b" stroke-width="1.4" opacity=".7"/>
        <path d="M140 60 L160 68 L245 68 L270 60" fill="none" stroke="#c9a24b" stroke-width="1" opacity=".5"/>
        <circle cx="105" cy="132" r="24" fill="none" stroke="#c9a24b" stroke-width="1.4" opacity=".7"/>
        <circle cx="285" cy="132" r="24" fill="none" stroke="#c9a24b" stroke-width="1.4" opacity=".7"/>
        <line x1="40" y1="130" x2="350" y2="130" stroke="#c9a24b" stroke-width="1" opacity=".4"/>
      </svg>
      <span class="modelo-kicker">01 — SUV moderno</span>
      <h3 class="modelo-name">Auron MVIST X1</h3>
      <p class="modelo-tag">Confortável e tecnológico para o uso diário, com assistente de condução.</p>
      <ul class="modelo-specs">
        <li>Motor 1.5 Turbo</li><li>Central multimídia 10"</li><li>Assistente de condução</li>
      </ul>
      <div class="modelo-price"><span>A partir de</span><strong>R$ 129.990</strong></div>
    </div>

    <div class="modelo-card reveal reveal-delay-1">
      <svg class="modelo-car-svg" viewBox="0 0 400 180" xmlns="http://www.w3.org/2000/svg">
        <path d="M35 128 Q45 100 90 92 L130 66 Q165 52 225 54 L275 66 Q315 76 335 100 L355 128 Z" fill="none" stroke="#c9a24b" stroke-width="1.4" opacity=".7"/>
        <path d="M130 66 L150 72 L250 72 L275 66" fill="none" stroke="#c9a24b" stroke-width="1" opacity=".5"/>
        <circle cx="100" cy="130" r="23" fill="none" stroke="#c9a24b" stroke-width="1.4" opacity=".7"/>
        <circle cx="290" cy="130" r="23" fill="none" stroke="#c9a24b" stroke-width="1.4" opacity=".7"/>
        <line x1="35" y1="128" x2="355" y2="128" stroke="#c9a24b" stroke-width="1" opacity=".4"/>
      </svg>
      <span class="modelo-kicker">02 — Esportivo</span>
      <h3 class="modelo-name">Auron MVIST GT</h3>
      <p class="modelo-tag">Desempenho e design esportivo: 0 a 100 km/h em 5,4s, modo Sport dedicado.</p>
      <ul class="modelo-specs">
        <li>Motor 2.0 Turbo</li><li>200 cv de potência</li><li>Modo Sport</li>
      </ul>
      <div class="modelo-price"><span>A partir de</span><strong>R$ 179.990</strong></div>
    </div>

    <div class="modelo-card reveal reveal-delay-2">
      <svg class="modelo-car-svg" viewBox="0 0 400 180" xmlns="http://www.w3.org/2000/svg">
        <path d="M38 129 Q48 98 95 90 L135 63 Q168 50 222 52 L272 63 Q312 72 332 98 L352 129 Z" fill="none" stroke="#c9a24b" stroke-width="1.4" opacity=".7"/>
        <path d="M135 63 L155 70 L248 70 L272 63" fill="none" stroke="#c9a24b" stroke-width="1" opacity=".5"/>
        <circle cx="102" cy="131" r="23" fill="none" stroke="#c9a24b" stroke-width="1.4" opacity=".7"/>
        <circle cx="288" cy="131" r="23" fill="none" stroke="#c9a24b" stroke-width="1.4" opacity=".7"/>
        <path d="M95 100 L110 100" stroke="#c9a24b" stroke-width="1" opacity=".5"/>
        <line x1="38" y1="129" x2="352" y2="129" stroke="#c9a24b" stroke-width="1" opacity=".4"/>
      </svg>
      <span class="modelo-kicker">03 — Mobilidade elétrica</span>
      <h3 class="modelo-name">Auron MVIST E-ONE</h3>
      <p class="modelo-tag">100% elétrico, autonomia de até 450 km e carregamento rápido.</p>
      <ul class="modelo-specs">
        <li>100% elétrico</li><li>450 km de autonomia</li><li>Carregamento rápido</li>
      </ul>
      <div class="modelo-price"><span>A partir de</span><strong>R$ 199.990</strong></div>
    </div>

    <div class="modelo-card reveal reveal-delay-3">
      <svg class="modelo-car-svg" viewBox="0 0 400 180" xmlns="http://www.w3.org/2000/svg">
        <path d="M32 128 Q42 97 88 89 L128 62 Q165 48 228 50 L280 62 Q320 72 340 98 L360 128 Z" fill="none" stroke="#c9a24b" stroke-width="1.4" opacity=".7"/>
        <path d="M128 62 L148 69 L254 69 L280 62" fill="none" stroke="#c9a24b" stroke-width="1" opacity=".5"/>
        <circle cx="98" cy="130" r="24" fill="none" stroke="#c9a24b" stroke-width="1.4" opacity=".7"/>
        <circle cx="292" cy="130" r="24" fill="none" stroke="#c9a24b" stroke-width="1.4" opacity=".7"/>
        <line x1="32" y1="128" x2="360" y2="128" stroke="#c9a24b" stroke-width="1" opacity=".4"/>
      </svg>
      <span class="modelo-kicker">04 — Sedã premium</span>
      <h3 class="modelo-name">Auron MVIST LUX</h3>
      <p class="modelo-tag">Conforto e sofisticação: acabamento premium, teto solar panorâmico, bancos em couro.</p>
      <ul class="modelo-specs">
        <li>Acabamento premium</li><li>Teto solar panorâmico</li><li>Bancos em couro</li>
      </ul>
      <div class="modelo-price"><span>A partir de</span><strong>R$ 219.990</strong></div>
    </div>
  </div>

  <div class="preview-note reveal reveal-delay-3">
    <span class="dot"></span>
    <span>Visualização 3D dos modelos: em desenvolvimento. Esta apresentação traz o posicionamento de marca e a estrutura da linha — os modelos interativos entram nesta mesma página assim que estiverem prontos.</span>
  </div>
</section>

<section id="motor">
  <div class="eyebrow reveal">Engenharia sob o capô</div>
  <h2 class="section-title reveal reveal-delay-1">O motor<br>por trás do GT.</h2>
  <p class="section-lede reveal reveal-delay-2">4 cilindros em linha, 4 tempos, desenvolvido para equilibrar resposta imediata e eficiência no dia a dia. Este é o coração do Auron MVIST GT.</p>

  <div class="motor-wrap">
    <div class="motor-svg-box reveal reveal-delay-3">
      <svg viewBox="0 0 400 380" width="100%" xmlns="http://www.w3.org/2000/svg">
        <rect x="130" y="20" width="100" height="16" rx="2" fill="none" stroke="#c9a24b" stroke-width="1"/>
        <rect x="140" y="36" width="80" height="20" fill="none" stroke="#c9a24b" stroke-width="1"/>
        <rect x="138" y="56" width="10" height="120" fill="none" stroke="#8a8a90" stroke-width="1"/>
        <rect x="162" y="56" width="10" height="120" fill="none" stroke="#8a8a90" stroke-width="1"/>
        <rect x="186" y="56" width="10" height="120" fill="none" stroke="#8a8a90" stroke-width="1"/>
        <rect x="210" y="56" width="8" height="20" fill="none" stroke="#c9a24b" stroke-width="1"/>
        <rect x="128" y="176" width="100" height="55" fill="none" stroke="#c9a24b" stroke-width="1"/>
        <circle cx="145" cy="185" r="4" fill="none" stroke="#c9a24b" stroke-width="1"/>
        <rect x="118" y="231" width="120" height="120" fill="none" stroke="#8a8a90" stroke-width="1"/>
        <rect x="152" y="248" width="20" height="34" fill="none" stroke="#c9a24b" stroke-width="1"/>
        <line x1="162" y1="282" x2="162" y2="322" stroke="#c9a24b" stroke-width="1.4"/>
        <line x1="150" y1="322" x2="174" y2="322" stroke="#c9a24b" stroke-width="1.4"/>
        <circle cx="162" cy="322" r="6" fill="none" stroke="#c9a24b" stroke-width="1.2"/>
        <rect x="112" y="351" width="130" height="16" fill="none" stroke="#8a8a90" stroke-width="1"/>
        <circle cx="130" cy="359" r="6" fill="none" stroke="#c9a24b" stroke-width="1"/>
        <circle cx="177" cy="359" r="6" fill="none" stroke="#c9a24b" stroke-width="1"/>
        <circle cx="224" cy="359" r="6" fill="none" stroke="#c9a24b" stroke-width="1"/>

        <line x1="230" y1="27" x2="300" y2="27" stroke="#8a8a90" stroke-width=".5" stroke-dasharray="2,2"/>
        <text x="304" y="31" font-family="Archivo" font-size="11" fill="#8a8a90">Tampa de válvulas</text>

        <line x1="220" y1="46" x2="300" y2="60" stroke="#8a8a90" stroke-width=".5" stroke-dasharray="2,2"/>
        <text x="304" y="64" font-family="Archivo" font-size="11" fill="#8a8a90">Comando de válvulas</text>

        <line x1="218" y1="66" x2="300" y2="95" stroke="#8a8a90" stroke-width=".5" stroke-dasharray="2,2"/>
        <text x="304" y="99" font-family="Archivo" font-size="11" fill="#8a8a90">Válvulas de admissão/escape</text>

        <line x1="228" y1="200" x2="300" y2="200" stroke="#8a8a90" stroke-width=".5" stroke-dasharray="2,2"/>
        <text x="304" y="204" font-family="Archivo" font-size="11" fill="#8a8a90">Cabeçote</text>

        <line x1="238" y1="290" x2="300" y2="290" stroke="#8a8a90" stroke-width=".5" stroke-dasharray="2,2"/>
        <text x="304" y="294" font-family="Archivo" font-size="11" fill="#8a8a90">Bloco do motor</text>

        <line x1="152" y1="265" x2="60" y2="250" stroke="#8a8a90" stroke-width=".5" stroke-dasharray="2,2"/>
        <text x="20" y="254" font-family="Archivo" font-size="11" fill="#8a8a90">Pistão</text>

        <line x1="162" y1="300" x2="60" y2="308" stroke="#8a8a90" stroke-width=".5" stroke-dasharray="2,2"/>
        <text x="20" y="312" font-family="Archivo" font-size="11" fill="#8a8a90">Biela</text>

        <line x1="224" y1="359" x2="300" y2="359" stroke="#8a8a90" stroke-width=".5" stroke-dasharray="2,2"/>
        <text x="304" y="363" font-family="Archivo" font-size="11" fill="#8a8a90">Virabrequim</text>
      </svg>
    </div>
    <div class="motor-specs reveal reveal-delay-3">
      <div class="stat-row"><span class="stat-label">Tipo</span><span class="stat-value" style="font-size:16px">4 tempos, 4 cilindros em linha</span></div>
      <div class="stat-row"><span class="stat-label">Cilindrada</span><span class="stat-value">1.998 cm³</span></div>
      <div class="stat-row"><span class="stat-label">Potência máxima</span><span class="stat-value">200 cv</span></div>
      <div class="stat-row"><span class="stat-label">Torque máximo</span><span class="stat-value">205 Nm</span></div>
      <div class="stat-row"><span class="stat-label">0 a 100 km/h</span><span class="stat-value">5,4s</span></div>
    </div>
  </div>
</section>

<section id="carreiras">
  <div class="eyebrow reveal">Vista a camisa</div>
  <h2 class="section-title reveal reveal-delay-1">Quem constrói<br>a Auron.</h2>
  <div class="carreiras">
    <div class="carreiras-copy reveal reveal-delay-2">
      <p>Toda empresa começa com quem topa entrar antes de existir prova de que vai dar certo. Hoje convidamos quem está nesta sala a ocupar um posto na Auron — da linha de produção ao balcão da concessionária.</p>
      <p>Quem veste a camisa, entra na fundação da companhia. Não como espectador: como parte do time que decide como a Auron vai ser.</p>
    </div>
    <div class="uniform-card reveal reveal-delay-3">
      <h3>Times abertos hoje</h3>
      <ul class="uniform-list">
        <li>Linha de montagem e engenharia</li>
        <li>Vendas e relacionamento — concessionária</li>
        <li>Marca, comunicação e eventos</li>
        <li>Operações e expansão</li>
      </ul>
    </div>
  </div>
</section>

<section id="investir" class="cta section-alt">
  <div class="eyebrow reveal">Para quem fica de fora do quadro</div>
  <h2 class="cta-title reveal reveal-delay-1">Não trabalha na Auron?<br>Então <em>entre</em> na Auron.</h2>
  <p class="section-lede reveal reveal-delay-2">Quem não veste a camisa hoje ainda tem um lugar: como cliente da primeira hora ou investidor da primeira rodada. A fábrica está de portas abertas.</p>
  <div class="cta-actions reveal reveal-delay-3">
    <a href="#" class="btn btn-primary">Quero investir na Auron</a>
    <a href="#" class="btn btn-ghost">Reservar um modelo</a>
  </div>
</section>

<footer>
  <span>Auron Company Invest — Fábrica &amp; Concessionária · (14) 98101-6182</span>
  <span>Fundada em 2018 · Botucatu - SP</span>
</footer>

<script>
const io = new IntersectionObserver((entries)=>{
  entries.forEach(e=>{ if(e.isIntersecting) e.target.classList.add('in'); });
},{threshold:.15});
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));
</script>

</body>
</html>
`);
});

app.use((req, res) => {
  res.status(404).end();
});

app.listen(PORT, () => {
  console.log('Servidor rodando na porta ' + PORT);
});
