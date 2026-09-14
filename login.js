// login.js — HTML do formulário de login/registro (usado na raiz / quando não autenticado)
function renderLoginPage() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Acesso — Auron</title>
<meta name="description" content="Auron Company Invest — Fábrica e concessionária própria. Acesse sua conta para continuar.">
<link rel="icon" type="image/x-icon" href="/favicon.ico">

<meta property="og:type" content="website">
<meta property="og:site_name" content="Auron Company MVIST">
<meta property="og:title" content="Auron Company Invest — Engenharia em movimento.">
<meta property="og:description" content="Fábrica e concessionária própria de veículos. Da chapa de aço ao showroom: modelos X1, GT, E-ONE e LUX da linha Auron MVIST.">
<meta property="og:image" content="https://raw.githubusercontent.com/KingMods1k/systemhub-shs/main/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="https://systemhub-shs.onrender.com">
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
  --red: #b23b3b;
}

*{margin:0;padding:0;box-sizing:border-box}

html,body{height:100%}
body{
  background:var(--bg);
  color:var(--text);
  font-family:'Archivo',sans-serif;
  min-height:100vh;
  display:flex;
  align-items:stretch;
  position:relative;
  overflow:hidden;
}

.bg-glow{
  position:absolute;inset:0;
  background:
    radial-gradient(ellipse 60% 50% at 80% 15%, rgba(201,162,75,.09), transparent),
    radial-gradient(ellipse 50% 40% at 15% 85%, rgba(201,162,75,.05), transparent),
    repeating-linear-gradient(115deg, transparent 0 130px, rgba(255,255,255,.012) 130px 131px);
  pointer-events:none;
}

.side{
  flex:1.1;
  position:relative;
  z-index:1;
  display:flex;
  flex-direction:column;
  justify-content:center;
  padding:8vw;
  border-right:1px solid var(--line);
}
.side-eyebrow{font-size:13px;color:var(--gold);letter-spacing:.12em;margin-bottom:22px}
.side-title{font-family:'Bebas Neue',sans-serif;font-size:clamp(40px,5.2vw,68px);line-height:.96;letter-spacing:.01em}
.side-title em{color:var(--gold);font-style:normal}
.side-lede{max-width:380px;margin-top:22px;font-size:15px;line-height:1.7;color:var(--text-dim)}
.side-stats{display:flex;gap:40px;margin-top:48px}
.side-stats div{font-size:12px;color:var(--text-dim)}
.side-stats strong{display:block;font-family:'Bebas Neue';font-size:26px;color:var(--text);letter-spacing:.02em}
@media (max-width:860px){.side{display:none}}

.form-col{
  flex:1;
  min-width:340px;
  position:relative;
  z-index:1;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:24px;
}
@media (max-width:860px){
  body{min-height:100vh}
  .form-col{width:100%;min-height:100vh}
}

.card{
  position:relative;
  width:100%;
  max-width:380px;
  padding:8px 4px;
}

.mark{
  font-family:'Bebas Neue',sans-serif;
  font-size:26px;
  letter-spacing:.08em;
  margin-bottom:4px;
}
.mark span{color:var(--gold)}

.subtitle{
  font-size:13px;
  color:var(--text-dim);
  margin-bottom:36px;
  letter-spacing:.02em;
}

form{display:flex;flex-direction:column;gap:16px}

.field{display:flex;flex-direction:column;gap:6px}
.field label{font-size:12px;color:var(--text-dim);letter-spacing:.04em}
.field input{
  padding:13px 14px;
  border-radius:2px;
  border:1px solid var(--line);
  background:var(--bg-alt);
  color:var(--text);
  font-size:15px;
  font-family:'Archivo',sans-serif;
  transition:border-color .2s ease;
}
.field input:focus{outline:none;border-color:var(--gold-dim)}

.btn{
  padding:14px;
  border:none;
  border-radius:2px;
  font-family:'Archivo',sans-serif;
  font-size:15px;
  font-weight:600;
  cursor:pointer;
  transition:transform .2s ease, opacity .2s ease, background .2s ease;
  margin-top:6px;
}
.btn:active{transform:scale(.98)}
.btn:disabled{opacity:.5;cursor:not-allowed;transform:none}

.btn-primary{background:var(--gold);color:var(--bg)}
.btn-primary:hover:not(:disabled){background:#d8b25c}

.msg{
  font-size:13px;
  min-height:18px;
  text-align:center;
  color:var(--text-dim);
}
.msg.error{color:var(--red)}
.msg.success{color:var(--gold)}

.toggle{
  font-size:13px;
  color:var(--gold);
  cursor:pointer;
  text-align:center;
  margin-top:6px;
  letter-spacing:.02em;
}
.toggle:hover{text-decoration:underline}

.hint{font-size:11px;color:var(--text-dim);margin-top:-2px}
</style>
</head>
<body>
<div class="bg-glow"></div>

<div class="side">
  <div class="side-eyebrow">Auron Company Invest</div>
  <h1 class="side-title">Engenharia<br>em <em>movimento.</em></h1>
  <p class="side-lede">Fábrica e concessionária próprias, do primeiro parafuso à entrega das chaves. Acesse para acompanhar a linha Auron MVIST.</p>
  <div class="side-stats">
    <div><strong>29</strong>modelos em linha</div>
    <div><strong>1926</strong>fundação</div>
    <div><strong>03</strong>unidades</div>
  </div>
</div>

<div class="form-col">
<div class="card">
  <div class="mark">AURON<span>.</span></div>
  <div class="subtitle" id="subtitle">Acesse sua conta para continuar</div>

  <form id="f">
    <div class="field" id="nameField" style="display:none">
      <label for="name">Nome</label>
      <input type="text" id="name" placeholder="Nome de Úsuario" maxlength="60">
    </div>
    <div class="field">
      <label for="email">Email</label>
      <input type="email" id="email" placeholder="exemplo@email.com" maxlength="150" required>
    </div>
    <div class="field">
      <label for="password">Senha</label>
      <input type="password" id="password" placeholder="minímo 8 dígitos" required minlength="8">
      <div class="hint" id="hint"></div>
    </div>

    <button type="submit" class="btn btn-primary" id="submitBtn">Entrar</button>

    <div class="msg" id="msg"></div>
    <div class="toggle" id="toggle">Registrar</div>
  </form>
</div>
</div>

<script>
let mode = 'login';
const toggle = document.getElementById('toggle');
const subtitle = document.getElementById('subtitle');
const submitBtn = document.getElementById('submitBtn');
const msg = document.getElementById('msg');
const hint = document.getElementById('hint');
const nameField = document.getElementById('nameField');
const nameInput = document.getElementById('name');

toggle.onclick = () => {
  mode = mode === 'login' ? 'register' : 'login';
  const isLogin = mode === 'login';
  subtitle.textContent = isLogin ? 'Acesse sua conta para continuar' : 'Crie sua conta para comecar';
  submitBtn.textContent = isLogin ? 'Entrar' : 'Registrar';
  toggle.textContent = isLogin ? 'Nao tem conta? Registrar' : 'Ja tem conta? Entrar';
  hint.textContent = isLogin ? '' : 'Minimo de 8 caracteres.';
  nameField.style.display = isLogin ? 'none' : 'flex';
  nameInput.required = !isLogin;
  msg.textContent = '';
  msg.className = 'msg';
};

document.getElementById('f').onsubmit = async (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  msg.className = 'msg';
  msg.textContent = 'Enviando...';
  submitBtn.disabled = true;

  try {
    const body = mode === 'register' ? { name, email, password } : { email, password };
    const r = await fetch('/auth/' + mode, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok) {
      msg.className = 'msg error';
      msg.textContent = data.error || 'Erro.';
      submitBtn.disabled = false;
      return;
    }
    msg.className = 'msg success';
    msg.textContent = 'Sucesso! Conectando...';
    window.location.reload();
  } catch (err) {
    msg.className = 'msg error';
    msg.textContent = 'Erro de conexao.';
    submitBtn.disabled = false;
  }
};
</script>
</body>
</html>`;
}

module.exports = { renderLoginPage };
