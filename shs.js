// shs.js — tudo relacionado à rota privada /shs fica isolado aqui
const express = require('express');
const { requireAuth } = require('./auth');

const router = express.Router();

// Tudo dentro deste router já passa por requireAuth (ver server.js: app.use('/shs', requireAuth, shsRouter))

router.get('/', (req, res) => {
  res.type('html').send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>SHS — Painel</title>
</head>
<body>
  <h1>Bem-vindo, ${req.user.email}</h1>
  <p>Permissão: ${req.user.permission}</p>
</body>
</html>`);
});

module.exports = router;
