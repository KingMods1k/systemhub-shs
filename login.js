// login.js — HTML do formulário de login/registro (usado na raiz / quando não autenticado)
function renderLoginPage() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Acesso — Auron</title>
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

body{
  background:var(--bg);
  color:var(--text);
  font-family:'Archivo',sans-serif;
  min-height:100vh;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:24px;
  position:relative;
  overflow:hidden;
}

.bg-glow{
  position:absolute;inset:0;
  background:
    radial-gradient(ellipse 60% 50% at 70% 20%, rgba(201,162,75,.10), transparent),
    radial-gradient(ellipse 50% 40% at 20% 80%, rgba(201,162,75,.06), transparent);
  pointer-events:none;
}

.card{
  position:relative;
  z-index:1;
  width:100%;
  max-width:400px;
  background:var(--bg-alt);
  border:1px solid var(--line);
  border-radius:6px;
  padding:44px 36px;
}

.mark{
  font-family:'Bebas Neue',sans-serif;
  font-size:28px;
  letter-spacing:.08em;
  text-align:center;
  margin-bottom:6px;
}
.mark span{color:var(--gold)}

.subtitle{
  text-align:center;
  font-size:13px;
  color:var(--text-dim);
  margin-bottom:32px;
  letter-spacing:.02em;
}

form{display:flex;flex-direction:column;gap:16px}

.field{display:flex;flex-direction:column;gap:6px}
.field label{font-size:12px;color:var(--text-dim);letter-spacing:.04em}
.field input{
  padding:13px 14px;
  border-radius:4px;
  border:1px solid var(--line);
  background:var(--bg);
  color:var(--text);
  font-size:15px;
  font-family:'Archivo',sans-serif;
  transition:border-color .2s ease;
}
.field input:focus{outline:none;border-color:var(--gold-dim)}

.btn{
  padding:14px;
  border:none;
  border-radius:4px;
  font-family:'Archivo',sans-serif;
  font-size:15px;
  font-weight:600;
  cursor:pointer;
  transition:transform .2s ease, opacity .2s ease;
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
  margin-top:4px;
  letter-spacing:.02em;
}
.toggle:hover{text-decoration:underline}

.hint{font-size:11px;color:var(--text-dim);margin-top:-2px}
</style>
</head>
<body>
<div class="bg-glow"></div>

<div class="card">
  <div class="mark">AURON<span>.</span></div>
  <div class="subtitle" id="subtitle">Acesse sua conta para continuar</div>

  <form id="f">
    <div class="field">
      <label for="email">Email</label>
      <input type="email" id="email" placeholder="seu@email.com" maxlength="150" required>
    </div>
    <div class="field">
      <label for="password">Senha</label>
      <input type="password" id="password" placeholder="********" required minlength="8">
      <div class="hint" id="hint"></div>
    </div>

    <button type="submit" class="btn btn-primary" id="submitBtn">Entrar</button>

    <div class="msg" id="msg"></div>
    <div class="toggle" id="toggle">Nao tem conta? Registrar</div>
  </form>
</div>

<script>
let mode = 'login';
const toggle = document.getElementById('toggle');
const subtitle = document.getElementById('subtitle');
const submitBtn = document.getElementById('submitBtn');
const msg = document.getElementById('msg');
const hint = document.getElementById('hint');

toggle.onclick = () => {
  mode = mode === 'login' ? 'register' : 'login';
  const isLogin = mode === 'login';
  subtitle.textContent = isLogin ? 'Acesse sua conta para continuar' : 'Crie sua conta para comecar';
  submitBtn.textContent = isLogin ? 'Entrar' : 'Registrar';
  toggle.textContent = isLogin ? 'Nao tem conta? Registrar' : 'Ja tem conta? Entrar';
  hint.textContent = isLogin ? '' : 'Minimo de 8 caracteres.';
  msg.textContent = '';
  msg.className = 'msg';
};

document.getElementById('f').onsubmit = async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  msg.className = 'msg';
  msg.textContent = 'Enviando...';
  submitBtn.disabled = true;

  try {
    const r = await fetch('/auth/' + mode, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await r.json();
    if (!r.ok) {
      msg.className = 'msg error';
      msg.textContent = data.error || 'Erro.';
      submitBtn.disabled = false;
      return;
    }
    msg.className = 'msg success';
    msg.textContent = 'Sucesso! Redirecionando...';
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
