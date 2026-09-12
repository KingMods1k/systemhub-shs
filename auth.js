// auth.js — registro, login e verificação de sessão (MongoDB)
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { connect } = require('./db');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error(
    'JWT_SECRET ausente ou fraco. Defina uma string aleatoria de 64+ caracteres na variavel de ambiente JWT_SECRET (veja .env.example).'
  );
}

const TOKEN_EXPIRES_IN = '7d';
const COOKIE_NAME = 'shs_token';
const BCRYPT_ROUNDS = 12;

// Apenas letras, numeros e pontos nas partes local/dominio, com exatamente um @
const EMAIL_RE = /^[A-Za-z0-9.]+@[A-Za-z0-9.]+\.[A-Za-z]{2,}$/;
const EMAIL_MAX_LENGTH = 150;

function validateEmail(email) {
  if (typeof email !== 'string') return 'Email invalido.';
  if (email.length > EMAIL_MAX_LENGTH) return `O email deve ter no maximo ${EMAIL_MAX_LENGTH} caracteres.`;
  if ((email.match(/@/g) || []).length !== 1) return 'O email deve conter exatamente um "@".';
  if (!EMAIL_RE.test(email)) return 'Email invalido. Use apenas letras, numeros e pontos.';
  return null;
}

function getClientIp(req) {
  // Se estiver atras de proxy (Render, nginx, etc.), configure app.set('trust proxy', 1) no server.js
  return req.ip || req.socket.remoteAddress || null;
}

function issueToken(user) {
  return jwt.sign(
    { sub: String(user._id), email: user._email, perm: user._permission },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRES_IN }
  );
}

function setTokenCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,               // nao acessivel via JS no navegador (mitiga XSS)
    secure: process.env.NODE_ENV === 'production', // exige HTTPS em producao
    sameSite: 'lax',              // mitiga CSRF basico
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
    const users = await connect();
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha sao obrigatorios.' });
    }
    const emailError = validateEmail(email);
    if (emailError) {
      return res.status(400).json({ error: emailError });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'A senha precisa ter ao menos 8 caracteres.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await users.findOne({ _email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ error: 'Este email ja esta cadastrado.' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const ip = getClientIp(req);

    const insertResult = await users.insertOne({
      _email: normalizedEmail,
      _permission: 'user',
      _password: passwordHash,
      _ip: ip,
      token: null,
      created_at: new Date(),
    });

    const user = {
      _id: insertResult.insertedId,
      _email: normalizedEmail,
      _permission: 'user',
    };

    const token = issueToken(user);
    await users.updateOne({ _id: user._id }, { $set: { token } });
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
    const users = await connect();
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha sao obrigatorios.' });
    }
    const emailError = validateEmail(email);
    if (emailError) {
      return res.status(400).json({ error: emailError });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await users.findOne({ _email: normalizedEmail });

    // Mensagem generica de proposito: nao revelar se o email existe ou nao
    const invalidMsg = { error: 'Email ou senha invalidos.' };

    if (!user) {
      return res.status(401).json(invalidMsg);
    }

    const match = await bcrypt.compare(password, user._password);
    if (!match) {
      return res.status(401).json(invalidMsg);
    }

    const ip = getClientIp(req);
    const token = issueToken(user);

    await users.updateOne({ _id: user._id }, { $set: { token, _ip: ip } });
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
router.post('/logout', async (req, res) => {
  try {
    const users = await connect();
    const token = req.cookies?.[COOKIE_NAME];
    if (token) {
      await users.updateOne({ token }, { $set: { token: null } });
    }
    res.clearCookie(COOKIE_NAME, { path: '/' });
    return res.json({ ok: true });
  } catch (err) {
    console.error('Erro no logout:', err);
    return res.status(500).json({ error: 'Erro interno ao sair.' });
  }
});

// --- Middleware: exige sessao valida ---
async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) {
      return res.status(401).json({ error: 'Nao autenticado.' });
    }

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Sessao invalida ou expirada.' });
    }

    const users = await connect();
    const { ObjectId } = require('mongodb');
    const user = await users.findOne({ _id: new ObjectId(payload.sub), token });
    if (!user) {
      return res.status(401).json({ error: 'Sessao invalida ou expirada.' });
    }

    req.user = { id: String(user._id), email: user._email, permission: user._permission };
    next();
  } catch (err) {
    console.error('Erro no requireAuth:', err);
    return res.status(500).json({ error: 'Erro interno de autenticacao.' });
  }
}

// --- GET /auth/me — checar sessao atual ---
router.get('/me', requireAuth, (req, res) => {
  res.json({ ok: true, user: req.user });
});

// --- Verifica sessao sem bloquear a requisicao: retorna o user ou null ---
async function checkAuth(req) {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return null;

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return null;
    }

    const users = await connect();
    const { ObjectId } = require('mongodb');
    const user = await users.findOne({ _id: new ObjectId(payload.sub), token });
    if (!user) return null;

    return { id: String(user._id), email: user._email, permission: user._permission };
  } catch (err) {
    console.error('Erro no checkAuth:', err);
    return null;
  }
}

module.exports = { router, requireAuth, checkAuth };
