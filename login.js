// login.js — página pública com formulário de login/registro
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.type('html').send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Acesso — Auron</title>
<style>
  body{background:#0a0a0c;color:#e8e6e0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
  form{background:#111114;padding:32px;border-radius:6px;width:320px;display:flex;flex-direction:column;gap:14px;border:1px solid #2a2a2f}
  input{padding:10px;border-radius:4px;border:1px solid #2a2a2f;background:#0a0a0c;color:#e8e6e0}
  button{padding:12px;border:none;border-radius:4px;background:#c9a24b;color:#0a0a0c;font-weight:600;cursor:pointer}
  .msg{font-size:13px;color:#8a8a90;min-height:18px}
  .toggle{font-size:13px;color:#c9a24b;cursor:pointer;text-align:center}
</style>
</head>
<body>
<form id="f">
  <h2 id="title">Entrar</h2>
  <input type="email" id="email" placeholder="Email" required>
  <input type="password" id="password" placeholder="Senha" required minlength="8">
  <button type="submit">Entrar</button>
  <div class="msg" id="msg"></div>
  <div class="toggle" id="toggle">Não tem conta? Registrar</div>
</form>
<script>
let mode = 'login';
const toggle = document.getElementById('toggle');
const title = document.getElementById('title');
const btn = document.querySelector('button');
toggle.onclick = () => {
  mode = mode === 'login' ? 'register' : 'login';
  title.textContent = mode === 'login' ? 'Entrar' : 'Registrar';
  btn.textContent = mode === 'login' ? 'Entrar' : 'Registrar';
  toggle.textContent = mode === 'login' ? 'Não tem conta? Registrar' : 'Já tem conta? Entrar';
};

document.getElementById('f').onsubmit = async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const msg = document.getElementById('msg');
  msg.textContent = 'Enviando...';
  try {
    const r = await fetch('/auth/' + mode, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await r.json();
    if (!r.ok) {
      msg.textContent = data.error || 'Erro.';
      return;
    }
    window.location.href = '/shs';
  } catch (err) {
    msg.textContent = 'Erro de conexão.';
  }
};
</script>
</body>
</html>`);
});

module.exports = router;
