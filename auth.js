// auth.js — registro, login e verificação de sessão
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const db = require('./db');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error(
    'JWT_SECRET ausente ou fraco. Defina uma string aleatória de 64+ caracteres na variável de ambiente JWT_SECRET (veja .env.example).'
  );
}

const TOKEN_EXPIRES_IN = '7d';
const COOKIE_NAME = 'shs_token';
const BCRYPT_ROUNDS = 12;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getClientIp(req) {
  // Se estiver atrás de proxy (nginx, etc.), configure app.set('trust proxy', 1) no server.js
  return req.ip || req.socket.remoteAddress || null;
}

function issueToken(user) {
  return jwt.sign(
    { sub: user.id, email: user._email, perm: user._permission },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRES_IN }
  );
}

function setTokenCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,               // não acessível via JS no navegador (mitiga XSS)
    secure: process.env.NODE_ENV === 'production', // exige HTTPS em produção
    sameSite: 'lax',              // mitiga CSRF básico
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias, em ms
    path: '/',
  });
}

// --- Rate limiting: protege contra brute-force em login/registro ---
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20,                  // 20 tentativas por IP nesse intervalo
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Tente novamente mais tarde.' },
});

// --- POST /auth/register ---
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Email inválido.' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'A senha precisa ter ao menos 8 caracteres.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = db.prepare('SELECT id FROM users WHERE _email = ?').get(normalizedEmail);
    if (existing) {
      return res.status(409).json({ error: 'Este email já está cadastrado.' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const ip = getClientIp(req);

    const insert = db.prepare(`
      INSERT INTO users (_email, _permission, _password, _ip, token)
      VALUES (?, 'user', ?, ?, NULL)
    `);
    const result = insert.run(normalizedEmail, passwordHash, ip);

    const user = {
      id: result.lastInsertRowid,
      _email: normalizedEmail,
      _permission: 'user',
    };

    const token = issueToken(user);
    db.prepare('UPDATE users SET token = ? WHERE id = ?').run(token, user.id);
    setTokenCookie(res, token);

    return res.status(201).json({
      ok: true,
      user: { email: user._email, permission: user._permission },
    });
  } catch (err) {
    console.error('Erro no registro:', err);
    return res.status(500).json({ error: 'Erro interno ao registrar.' });
  }
});

// --- POST /auth/login ---
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE _email = ?').get(normalizedEmail);

    // Mensagem genérica de propósito: não revelar se o email existe ou não
    const invalidMsg = { error: 'Email ou senha inválidos.' };

    if (!user) {
      return res.status(401).json(invalidMsg);
    }

    const match = await bcrypt.compare(password, user._password);
    if (!match) {
      return res.status(401).json(invalidMsg);
    }

    const ip = getClientIp(req);
    const token = issueToken(user);

    db.prepare('UPDATE users SET token = ?, _ip = ? WHERE id = ?').run(token, ip, user.id);
    setTokenCookie(res, token);

    return res.json({
      ok: true,
      user: { email: user._email, permission: user._permission },
    });
  } catch (err) {
    console.error('Erro no login:', err);
    return res.status(500).json({ error: 'Erro interno ao logar.' });
  }
});

// --- POST /auth/logout ---
router.post('/logout', (req, res) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (token) {
    db.prepare('UPDATE users SET token = NULL WHERE token = ?').run(token);
  }
  res.clearCookie(COOKIE_NAME, { path: '/' });
  return res.json({ ok: true });
});

// --- Middleware: exige sessão válida ---
function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ error: 'Não autenticado.' });
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
  }

  // Confirma que o token ainda é o "vigente" no banco (permite invalidar sessões antigas)
  const user = db.prepare('SELECT * FROM users WHERE id = ? AND token = ?').get(payload.sub, token);
  if (!user) {
    return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
  }

  req.user = { id: user.id, email: user._email, permission: user._permission };
  next();
}

// --- GET /auth/me — checar sessão atual ---
router.get('/me', requireAuth, (req, res) => {
  res.json({ ok: true, user: req.user });
});

module.exports = { router, requireAuth };
