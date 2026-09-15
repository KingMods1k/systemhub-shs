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

app.use(express.json({ limit: '20mb' }));
app.use(cookieParser());

const { router: authRouter, requireAuth, checkAuth } = require('./auth');
const shsRouter = require('./shs');
const documentCrypto = require('./crypto');
const { renderLoginPage } = require('./login');

app.use('/auth', authRouter);
app.use('/shs', requireAuth, shsRouter); // tudo em /shs exige sessão válida

// --- Validação dos dados pessoais da segunda etapa (POST /vagas/finalizar) ---
// Tudo validado de novo aqui no servidor, mesmo que o client já formate/valide,
// porque o client nunca é confiável.

const PROC_NOME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ\s]+$/;
const PROC_NOME_MAX = 100;

const PROC_ENDERECO_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9.\-\s]+$/;
const PROC_ENDERECO_MAX = 160;

// Valida CPF (11 dígitos) pelos dígitos verificadores oficiais (módulo 11).
function isValidCpf(cpf) {
  if (typeof cpf !== 'string') return false;
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false; // rejeita sequências tipo 111.111.111-11

  const calcDigit = (base) => {
    let sum = 0;
    let weight = base.length + 1;
    for (const ch of base) {
      sum += parseInt(ch, 10) * weight;
      weight -= 1;
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const d1 = calcDigit(digits.slice(0, 9));
  const d2 = calcDigit(digits.slice(0, 9) + String(d1));
  return digits === digits.slice(0, 9) + String(d1) + String(d2);
}

function formatCpf(digits) {
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function formatRg(digits) {
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{1})/, '$1.$2.$3-$4');
}

function formatTel(digits) {
  return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
}

// DD/MM/AA — valida dia/mes plausiveis; nao valida ano contra data futura pois
// "AA" (2 digitos) e ambiguo de proposito (o usuario escolheu esse formato).
function isValidDataNascimento(str) {
  if (typeof str !== 'string') return false;
  const m = /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(str);
  if (!m) return false;
  const dia = parseInt(m[1], 10);
  const mes = parseInt(m[2], 10);
  if (mes < 1 || mes > 12) return false;
  if (dia < 1 || dia > 31) return false;
  return true;
}

function validateProcessoFields(body) {
  const { nome, cpf, rg, estadoCivil, vagaId, dataNascimento, tel, endereco } = body || {};

  if (typeof nome !== 'string' || !nome.trim()) return 'Nome é obrigatório.';
  const nomeTrim = nome.trim();
  if (nomeTrim.length > PROC_NOME_MAX) return `Nome deve ter no máximo ${PROC_NOME_MAX} caracteres.`;
  if (!PROC_NOME_RE.test(nomeTrim)) return 'Nome deve conter apenas letras.';

  if (typeof cpf !== 'string') return 'CPF é obrigatório.';
  const cpfDigits = cpf.replace(/\D/g, '');
  if (cpfDigits.length !== 11) return 'CPF deve ter 11 dígitos.';
  if (!isValidCpf(cpfDigits)) return 'CPF inválido.';

  if (typeof rg !== 'string') return 'RG é obrigatório.';
  const rgDigits = rg.replace(/\D/g, '');
  if (rgDigits.length !== 9) return 'RG deve ter 9 dígitos.';

  if (estadoCivil !== 'Solteiro' && estadoCivil !== 'Casado') return 'Estado cívil inválido.';

  if (typeof vagaId !== 'string' || !vagaId.trim()) return 'Selecione uma vaga.';

  if (!isValidDataNascimento(dataNascimento)) return 'Data de nascimento inválida. Use o formato DD/MM/AA.';

  if (typeof tel !== 'string') return 'Telefone é obrigatório.';
  const telDigits = tel.replace(/\D/g, '');
  if (telDigits.length !== 11) return 'Telefone deve ter 11 dígitos.';

  if (typeof endereco !== 'string' || !endereco.trim()) return 'Endereço é obrigatório.';
  const enderecoTrim = endereco.trim();
  if (enderecoTrim.length > PROC_ENDERECO_MAX) return `Endereço deve ter no máximo ${PROC_ENDERECO_MAX} caracteres.`;
  if (!PROC_ENDERECO_RE.test(enderecoTrim)) return 'Endereço contém caracteres inválidos.';

  return null;
}

// GET /vagas — lista as vagas abertas para o dialog "Vagas" da landing page.
// Publica (sem login), ja que qualquer visitante pode ver e se candidatar.
// Na primeira chamada, se a colecao estiver vazia, popula com as vagas
// padrao (seed) para nao precisar cadastrar na mao no Atlas.
app.get('/vagas', async (req, res) => {
  try {
    const { connectVagas } = require('./db');
    const vagas = await connectVagas();

    const total = await vagas.countDocuments();
    if (total === 0) {
      await vagas.insertMany([
        { titulo: 'Operador de Máquinas', area: 'Linha de montagem e engenharia', local: 'Botucatu - SP', tipo: 'Presencial', created_at: new Date() },
        { titulo: 'Engenheiro de Produção', area: 'Linha de montagem e engenharia', local: 'Botucatu - SP', tipo: 'Presencial', created_at: new Date() },
        { titulo: 'Consultor de Vendas', area: 'Vendas e relacionamento — concessionária', local: 'Botucatu - SP', tipo: 'Presencial', created_at: new Date() },
        { titulo: 'Analista de Relacionamento com Cliente', area: 'Vendas e relacionamento — concessionária', local: 'Botucatu - SP', tipo: 'Híbrido', created_at: new Date() },
        { titulo: 'Analista de Marketing', area: 'Marca, comunicação e eventos', local: 'Botucatu - SP', tipo: 'Híbrido', created_at: new Date() },
        { titulo: 'Produtor de Eventos', area: 'Marca, comunicação e eventos', local: 'Botucatu - SP', tipo: 'Presencial', created_at: new Date() },
        { titulo: 'Analista de Operações', area: 'Operações e expansão', local: 'Botucatu - SP', tipo: 'Presencial', created_at: new Date() },
        { titulo: 'Coordenador de Expansão', area: 'Operações e expansão', local: 'Botucatu - SP', tipo: 'Presencial', created_at: new Date() },
      ]);
    }

    const lista = await vagas.find({}).sort({ area: 1, titulo: 1 }).toArray();
    const formatada = lista.map((v) => ({ id: String(v._id), titulo: v.titulo, area: v.area, local: v.local, tipo: v.tipo }));
    return res.json({ vagas: formatada });
  } catch (err) {
    console.error('Erro ao listar vagas:', err);
    return res.status(500).json({ error: 'Erro interno ao carregar vagas.' });
  }
});

// POST /vagas/inscrever — registra a escolha do candidato apos ele selecionar
// uma vaga no dialog e clicar em "Continuar". Publica (sem login).
app.post('/vagas/inscrever', async (req, res) => {
  const { vagaId } = req.body || {};
  if (!vagaId) {
    return res.status(400).json({ error: 'Selecione uma vaga.' });
  }

  try {
    const { ObjectId } = require('mongodb');
    const { connectVagas } = require('./db');
    const vagas = await connectVagas();
    const vaga = await vagas.findOne({ _id: new ObjectId(vagaId) });
    if (!vaga) {
      return res.status(404).json({ error: 'Vaga nao encontrada.' });
    }
    return res.status(201).json({ ok: true, vaga: vaga.titulo });
  } catch (err) {
    console.error('Erro ao registrar inscricao:', err);
    return res.status(500).json({ error: 'Erro interno ao registrar inscricao.' });
  }
});

// POST /vagas/finalizar — segunda etapa da inscrição: recebe os dados pessoais
// (apos o candidato escolher a vaga e clicar em "Continuar") e salva um
// registro na collection "processos". Exige login (email vem da sessao, nunca
// do body, entao nao da pra falsificar em nome de outra pessoa).
app.post('/vagas/finalizar', requireAuth, async (req, res) => {
  const validationError = validateProcessoFields(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const { nome, cpf, rg, estadoCivil, vagaId, dataNascimento, tel, endereco } = req.body;
  const cpfDigits = cpf.replace(/\D/g, '');
  const rgDigits = rg.replace(/\D/g, '');
  const telDigits = tel.replace(/\D/g, '');

  try {
    const { ObjectId } = require('mongodb');
    const { connectVagas, connectProcessos } = require('./db');

    const vagas = await connectVagas();
    const vaga = await vagas.findOne({ _id: new ObjectId(vagaId) });
    if (!vaga) {
      return res.status(404).json({ error: 'Vaga não encontrada.' });
    }

    const processos = await connectProcessos();
    const result = await processos.insertOne({
      nome: nome.trim(),
      cpf: formatCpf(cpfDigits),
      rg: formatRg(rgDigits),
      email: req.user.email, // vem da sessao, nao do body: nao pode ser falsificado
      estadoCivil,
      vagaId: String(vaga._id),
      vagaTitulo: vaga.titulo,
      dataNascimento,
      tel: formatTel(telDigits),
      endereco: endereco.trim(),
      created_at: new Date(),
    });

    return res.status(201).json({ ok: true, id: String(result.insertedId) });
  } catch (err) {
    console.error('Erro ao finalizar inscricao:', err);
    return res.status(500).json({ error: 'Erro interno ao finalizar inscricao.' });
  }
});

app.get('/favicon.ico', (req, res) => {
  res.sendFile(require('path').join(__dirname, 'favicon.ico'));
});

// GET /myhub.js — hub interno, só pra funcionários (permission === 'authentic').
// requireAuth ja valida o token/cookie (inclusive contra login em outro navegador).
app.get('/myhub.js', requireAuth, (req, res) => {
  if (req.user.permission !== 'authentic') {
    return res.status(403).json({ error: 'Acesso restrito a funcionarios.' });
  }

  try {
    // Lazy require: assim o server nao quebra no boot enquanto o arquivo
    // ./myhub.js ainda nao existir no repo.
    const { renderMyHub } = require('./myhub');
    return res.type('html').send(renderMyHub(req.user));
  } catch (err) {
    console.error('Erro ao carregar myhub:', err);
    return res.status(500).json({ error: 'Hub indisponivel no momento.' });
  }
});

// POST /myhub/admitir — cria solicitação de admissão na collection "RHs".
// Mesma regra da tela: token valido + permission === 'authentic'.
app.post('/myhub/admitir', requireAuth, async (req, res) => {
  if (req.user.permission !== 'authentic') {
    return res.status(403).json({ error: 'Acesso restrito a funcionarios.' });
  }

  const { nome, idade, data, email, tel, endereco, cpf, rg, cargo, funcoes, cnpj } = req.body || {};
  if (!nome || !idade || !data || !email || !tel || !endereco || !cpf || !rg || !cargo || !funcoes || !cnpj) {
    return res.status(400).json({ error: 'Preencha todos os campos.' });
  }

  try {
    const { connectRHs } = require('./db');
    const rhs = await connectRHs();
    const result = await rhs.insertOne({
      nome,
      idade,
      data,
      email,
      tel,
      endereco,
      cpf,
      rg,
      cargo,
      funcoes,
      cnpj,
      solicitado_por: req.user.email,
      created_at: new Date(),
    });
    return res.status(201).json({ ok: true, id: String(result.insertedId) });
  } catch (err) {
    console.error('Erro ao registrar admissao:', err);
    return res.status(500).json({ error: 'Erro interno ao registrar admissao.' });
  }
});

// GET /myhub/documento/rsa-temp — gera uma chave RSA temporaria (uso unico, 5min de validade)
// pro app cifrar o pacote com. A chave privada correspondente nunca sai da RAM do server.
app.get('/myhub/documento/rsa-temp', requireAuth, (req, res) => {
  console.log('[rsa-temp] rota alcancada. user:', req.user && req.user.email, 'permission:', req.user && req.user.permission);
  if (req.user.permission !== 'authentic') {
    console.log('[rsa-temp] bloqueado: permission =', req.user.permission);
    return res.status(403).json({ error: 'Acesso restrito a funcionarios.' });
  }
  const { keyId, publicKey } = documentCrypto.generateTempKeyPair();
  console.log('[rsa-temp] chave gerada, keyId:', keyId);
  return res.json({ keyId, publicKey });
});

// POST /myhub/documento/upload — recebe o pacote cifrado do funcionario, abre com a chave
// RSA temporaria, cifra de novo com a chave PERMANENTE do servidor (.env), assina com a
// chave privada permanente e guarda tudo cifrado dentro do registro em "RHs".
//
// Corpo esperado (tudo em Base64, exceto keyId/funcionarioId/mimetype):
// { keyId, funcionarioId, mimetype, encryptedAesKey, iv, authTag, ciphertext }
app.post('/myhub/documento/upload', requireAuth, express.json({ limit: '20mb' }), async (req, res) => {
  console.log('[upload] rota alcancada. body keys:', Object.keys(req.body || {}));

  if (req.user.permission !== 'authentic') {
    console.log('[upload] bloqueado: permission =', req.user.permission);
    return res.status(403).json({ error: 'Acesso restrito a funcionarios.' });
  }

  const { keyId, funcionarioId, mimetype, encryptedAesKey, iv, authTag, ciphertext } = req.body || {};
  if (!keyId || !funcionarioId || !mimetype || !encryptedAesKey || !iv || !authTag || !ciphertext) {
    console.log('[upload] pacote incompleto. presentes:', {
      keyId: !!keyId, funcionarioId: !!funcionarioId, mimetype: !!mimetype,
      encryptedAesKey: !!encryptedAesKey, iv: !!iv, authTag: !!authTag, ciphertext: !!ciphertext,
    });
    return res.status(400).json({ error: 'Pacote incompleto.' });
  }

  const tempPrivateKey = documentCrypto.consumeTempPrivateKey(keyId);
  if (!tempPrivateKey) {
    console.log('[upload] chave temporaria invalida/expirada para keyId:', keyId);
    return res.status(400).json({ error: 'Chave temporaria invalida ou expirada. Peca uma nova e tente de novo.' });
  }

  try {
    // 1) Abre o pacote que veio do funcionario (RSA temporaria -> chave AES -> documento)
    const aesKey = documentCrypto.rsaDecrypt(Buffer.from(encryptedAesKey, 'base64'), tempPrivateKey);
    const plaintext = documentCrypto.aesDecrypt(
      Buffer.from(ciphertext, 'base64'),
      aesKey,
      Buffer.from(iv, 'base64'),
      Buffer.from(authTag, 'base64')
    );

    // 2) Cifra de novo com uma chave AES nova, envelopada com a RSA publica PERMANENTE do server
    const newAesKey = documentCrypto.generateAesKey();
    const { ciphertext: newCiphertext, iv: newIv, authTag: newAuthTag } = documentCrypto.aesEncrypt(plaintext, newAesKey);
    const encryptedAesKeyServer = documentCrypto.rsaEncrypt(newAesKey, documentCrypto.getServerPublicKey());

    // 3) Assina o conteudo original com a RSA privada PERMANENTE do server
    const signature = documentCrypto.sign(plaintext, documentCrypto.getServerPrivateKey());

    // 4) Empilha o documento cifrado dentro do registro do funcionario, em "RHs".
    // $push cria o array "documentos" sozinho se ainda nao existir, e cada novo
    // arquivo entra por baixo dos anteriores (mesma ordem de envio).
    const { ObjectId } = require('mongodb');
    const { connectRHs } = require('./db');
    const rhs = await connectRHs();
    const result = await rhs.updateOne(
      { _id: new ObjectId(funcionarioId) },
      {
        $push: {
          documentos: {
            _id: new ObjectId(),
            mimetype,
            arquivo_cifrado: newCiphertext,
            chave_cifrada: encryptedAesKeyServer,
            iv: newIv,
            auth_tag: newAuthTag,
            assinatura: signature,
            enviado_por: req.user.email,
            created_at: new Date(),
          },
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Funcionario nao encontrado.' });
    }

    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error('Erro ao processar documento cifrado:', err);
    return res.status(400).json({ error: 'Nao foi possivel processar o pacote cifrado.' });
  }
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
.nav-user-wrap{position:relative;display:flex;align-items:center;gap:10px}
.nav-dots{
  background:none;border:1px solid var(--line);color:var(--text);
  width:28px;height:28px;border-radius:50%;cursor:pointer;
  font-size:16px;line-height:1;display:flex;align-items:center;justify-content:center;
  transition:border-color .2s ease, color .2s ease, transform .2s ease;
}
.nav-dots:hover{border-color:var(--gold);color:var(--gold)}
.nav-dots:active{transform:scale(.85)}
.nav-dots.is-open{color:var(--gold);border-color:var(--gold);transform:rotate(90deg)}
.nav-dropdown{
  position:absolute;top:calc(100% + 12px);right:0;min-width:190px;
  background:var(--bg);border:1px solid var(--line);border-radius:6px;
  padding:6px;display:flex;flex-direction:column;gap:2px;
  box-shadow:0 12px 30px rgba(0,0,0,.5);z-index:200;
  opacity:0;visibility:hidden;pointer-events:none;
  transform:translateY(-8px) scale(.96);transform-origin:top right;
  transition:opacity .18s ease, transform .18s ease, visibility .18s;
}
.nav-dropdown.open{opacity:1;visibility:visible;pointer-events:auto;transform:translateY(0) scale(1)}
.nav-dropdown-item{
  background:none;border:none;text-align:left;color:var(--text);
  font-family:'Archivo';font-size:13px;padding:10px 12px;border-radius:4px;
  cursor:pointer;transition:background .2s ease, color .2s ease, transform .12s ease;
}
.nav-dropdown-item:hover{background:var(--line);color:var(--gold)}
.nav-dropdown-item:active{transform:scale(.97)}

.support-overlay{
  position:fixed;inset:0;background:rgba(0,0,0,.6);
  display:flex;align-items:center;justify-content:center;z-index:300;
  opacity:0;visibility:hidden;transition:opacity .25s ease, visibility .25s;
}
.support-overlay.open{opacity:1;visibility:visible}
.support-dialog{
  position:relative;background:var(--bg);border:1px solid var(--line);
  border-radius:22px;padding:38px 32px;width:min(360px,86vw);
  text-align:center;
  transform:scale(.85) translateY(14px);
  transition:transform .28s cubic-bezier(.34,1.56,.64,1);
}
.support-overlay.open .support-dialog{transform:scale(1) translateY(0)}
.support-dialog h3{font-family:'Bebas Neue';font-size:24px;letter-spacing:.04em;margin-bottom:22px}
.support-close{
  position:absolute;top:10px;right:10px;background:none;border:none;
  color:var(--text-dim);font-size:34px;cursor:pointer;line-height:1;
  width:44px;height:44px;display:flex;align-items:center;justify-content:center;
  border-radius:50%;transition:color .2s ease, background .2s ease, transform .15s ease;
}
.support-close:hover{color:var(--gold);background:var(--line)}
.support-close:active{transform:scale(.85)}
.support-row{display:flex;align-items:center;justify-content:center;gap:18px}
@keyframes wa-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
.support-row svg{flex:none;animation:wa-pulse 2.6s ease-in-out infinite}
.btn-whatsapp{
  display:inline-flex;align-items:center;gap:8px;background:#25D366;color:#0a0a0c;
  font-family:'Archivo';font-weight:700;font-size:14px;padding:14px 26px;
  border-radius:999px;text-decoration:none;transition:transform .2s ease, box-shadow .2s ease;
}
.btn-whatsapp:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(37,211,102,.35)}
.btn-whatsapp:active{transform:translateY(0) scale(.96)}
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
.btn-primary:active,.btn-ghost:active{transform:translateY(0) scale(.96)}
.btn-ghost{border:1px solid var(--line);color:var(--text)}
.btn-ghost:hover{border-color:var(--gold);color:var(--gold)}

footer{
  padding:50px 6vw;border-top:1px solid var(--line);
  display:flex;justify-content:space-between;color:var(--text-dim);font-size:13px;
  flex-wrap:wrap;gap:16px;
}

/* --- Dialog de Vagas --- */
.vagas-overlay{
  position:fixed;inset:0;z-index:100;
  background:rgba(0,0,0,.6);
  display:none;
  align-items:center;justify-content:center;
  padding:20px;
}
.vagas-overlay.open{display:flex}
.vagas-dialog{
  width:100%;max-width:480px;max-height:80vh;
  background:var(--bg-alt);border:1px solid var(--line);border-radius:6px;
  display:flex;flex-direction:column;
  overflow:hidden;
}
.vagas-header{
  padding:22px 24px;border-bottom:1px solid var(--line);
  display:flex;align-items:center;justify-content:space-between;
}
.vagas-header h3{font-family:'Bebas Neue',sans-serif;font-size:26px;letter-spacing:.04em;color:var(--text)}
.vagas-close{
  background:none;border:none;color:var(--text-dim);font-size:26px;line-height:1;
  cursor:pointer;padding:0 4px;
}
.vagas-close:hover{color:var(--gold)}
.vagas-body{padding:14px 16px;overflow-y:auto;flex:1;}
.vagas-loading,.vagas-empty,.vagas-error{padding:20px;text-align:center;color:var(--text-dim);font-size:14px;}
.vagas-item{
  display:flex;align-items:flex-start;gap:14px;
  padding:16px 12px;border-radius:4px;cursor:pointer;
  border:1px solid transparent;
}
.vagas-item:hover{background:rgba(255,255,255,.03)}
.vagas-item.selected{border-color:var(--gold-dim);background:rgba(201,162,75,.08)}
.vagas-item input[type=radio]{margin-top:4px;accent-color:var(--gold);flex-shrink:0}
.vagas-item-info .titulo{font-size:15px;font-weight:600;color:var(--text)}
.vagas-item-info .meta{font-size:12px;color:var(--text-dim);margin-top:3px}
.vagas-footer{padding:18px 24px;border-top:1px solid var(--line)}
.vagas-footer .btn{width:100%;text-align:center;border:none;cursor:pointer}
.vagas-footer .btn:disabled{opacity:.4;cursor:not-allowed}

.dados-body{padding:14px 24px;overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:14px}
.dados-field{display:flex;flex-direction:column;gap:6px}
.dados-field label{font-size:12px;color:var(--text-dim);letter-spacing:.03em}
.dados-field input,.dados-field select{
  background:rgba(255,255,255,.03);border:1px solid var(--line);border-radius:4px;
  padding:10px 12px;color:var(--text);font-size:14px;font-family:inherit;
}
.dados-field input:disabled{opacity:.55;cursor:not-allowed}
.dados-field input:focus,.dados-field select:focus{outline:none;border-color:var(--gold-dim)}
.dados-vaga-row{display:flex;gap:8px;align-items:center}
.dados-vaga-row select{flex:1}
.dados-error{font-size:12px;color:#e5484d;min-height:16px}
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
    <div class="nav-user-wrap">
      <div class="nav-user">${displayName}</div>
      <button class="nav-dots" id="navDotsBtn" aria-haspopup="true" aria-expanded="false" aria-label="Menu do usuário">⋯</button>
      <div class="nav-dropdown" id="navDropdown">
        ${user.permission === 'authentic' ? '<button class="nav-dropdown-item" id="btnManageProfile">Gerenciar</button>' : ''}
        <button class="nav-dropdown-item" id="btnSupport">Suporte</button>
        <button class="nav-dropdown-item" id="btnLogout">Sair</button>
      </div>
    </div>
  </div>
</nav>

<div class="support-overlay" id="supportOverlay">
  <div class="support-dialog">
    <button class="support-close" id="supportClose" aria-label="Fechar">&times;</button>
    <h3>Suporte</h3>
    <div class="support-row">
      <svg width="56" height="56" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
        <circle cx="18" cy="18" r="16" fill="#25D366"/>
        <g transform="translate(2,2)">
          <path d="M16 8a8 8 0 0 0-6.9 12.03L8 24l4.1-1.07A8 8 0 1 0 16 8Zm0 1.6a6.4 6.4 0 0 1 5.16 10.2l-.24.33.5 1.83-1.87-.49-.33.2A6.4 6.4 0 1 1 16 9.6Zm-2.75 3.15c-.15 0-.4.06-.6.3-.21.24-.8.78-.8 1.9s.82 2.2.93 2.35c.12.16 1.6 2.55 3.95 3.47 1.95.77 2.35.62 2.77.58.43-.04 1.38-.56 1.58-1.1.2-.55.2-1.02.14-1.11-.06-.1-.21-.16-.44-.28-.23-.11-1.38-.68-1.6-.76-.21-.08-.37-.11-.53.11-.16.24-.6.76-.74.91-.14.16-.27.18-.5.06-.23-.11-.97-.36-1.85-1.14-.68-.61-1.15-1.36-1.28-1.6-.14-.23-.02-.36.1-.48.1-.1.23-.27.34-.4.11-.14.15-.24.23-.4.08-.16.04-.3-.02-.42-.06-.11-.53-1.28-.73-1.75-.19-.46-.39-.4-.53-.4Z" fill="#0a0a0c"/>
        </g>
      </svg>
      <a href="https://wa.me/14991406778?" target="_blank" rel="noopener noreferrer" class="btn-whatsapp">WhatsApp</a>
    </div>
  </div>
</div>

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
    <div><strong>018</strong>ano de fundação</div>
    <div><strong>03</strong>unidades operacionais</div>
  </div>
</header>

<section id="sobre">
  <div class="eyebrow reveal">Sobre a Auron</div>
  <h2 class="section-title reveal reveal-delay-1">Da chapa de aço<br>ao showroom.</h2>
  <div class="sobre-grid">
    <p class="section-lede reveal reveal-delay-2">A Auron nasce para ocupar o espaço entre a engenharia pesada e a experiência de quem compra o carro pronto. Uma única companhia cuidando de toda a cadeia: fábrica própria, concessionária própria, padrão único do primeiro parafuso à entrega das chaves. Três unidades, uma só régua de qualidade — Auron Company Center (fábrica), Auron Dealership (concessionária) e Auron Company Invest (holding financeira).</p>
    <div class="sobre-stats reveal reveal-delay-3">
      <div class="stat-row"><span class="stat-label">Exportações realizadas</span><span class="stat-value">873.817</span></div>
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
    <a href="#" class="btn btn-primary" id="btnInscrever">Se inscrever...</a>
    <a href="#" class="btn btn-ghost">Reservar um modelo</a>
  </div>
</section>

<div class="vagas-overlay" id="vagasOverlay">
  <div class="vagas-dialog">
    <div class="vagas-header">
      <h3>Vagas</h3>
      <button type="button" class="vagas-close" id="vagasClose" aria-label="Fechar">&times;</button>
    </div>
    <div class="vagas-body" id="vagasBody">
      <div class="vagas-loading">Carregando vagas...</div>
    </div>
    <div class="vagas-footer">
      <button type="button" class="btn btn-primary" id="vagasContinuar" disabled>Continuar</button>
    </div>
  </div>
</div>

<div class="vagas-overlay" id="dadosOverlay">
  <div class="vagas-dialog">
    <div class="vagas-header">
      <h3>Dados pessoais</h3>
      <button type="button" class="vagas-close" id="dadosClose" aria-label="Fechar">&times;</button>
    </div>
    <div class="dados-body" id="dadosBody">
      <div class="dados-field">
        <label for="campoNome">Nome</label>
        <input type="text" id="campoNome" maxlength="100" placeholder="Nome completo">
      </div>
      <div class="dados-field">
        <label for="campoCpf">CPF</label>
        <input type="text" id="campoCpf" inputmode="numeric" placeholder="000.000.000-00" maxlength="14">
      </div>
      <div class="dados-field">
        <label for="campoRg">RG</label>
        <input type="text" id="campoRg" inputmode="numeric" placeholder="00.000.000-0" maxlength="12">
      </div>
      <div class="dados-field">
        <label for="campoEmail">Email</label>
        <input type="text" id="campoEmail" disabled>
      </div>
      <div class="dados-field">
        <label for="campoEstadoCivil">Estado cívil</label>
        <select id="campoEstadoCivil">
          <option value="">Selecione...</option>
          <option value="Solteiro">Solteiro</option>
          <option value="Casado">Casado</option>
        </select>
      </div>
      <div class="dados-field">
        <label for="campoVaga">Vaga</label>
        <div class="dados-vaga-row">
          <input type="text" id="campoVagaTitulo" disabled>
          <select id="campoVaga"></select>
        </div>
      </div>
      <div class="dados-field">
        <label for="campoNascimento">Data de nascimento</label>
        <input type="text" id="campoNascimento" inputmode="numeric" placeholder="DD/MM/AA" maxlength="8">
      </div>
      <div class="dados-field">
        <label for="campoTel">Telefone</label>
        <input type="text" id="campoTel" inputmode="numeric" placeholder="(00) 00000-0000" maxlength="15">
      </div>
      <div class="dados-field">
        <label for="campoEndereco">Endereço</label>
        <input type="text" id="campoEndereco" maxlength="160" placeholder="Rua, número, bairro...">
      </div>
      <div class="dados-error" id="dadosError"></div>
    </div>
    <div class="vagas-footer">
      <button type="button" class="btn btn-primary" id="dadosEnviar">Enviar inscrição</button>
    </div>
  </div>
</div>

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

<script>
// --- Menu de usuário (três pontinhos) ---
const navDotsBtn = document.getElementById('navDotsBtn');
const navDropdown = document.getElementById('navDropdown');

function closeNavDropdown() {
  navDropdown.classList.remove('open');
  navDotsBtn.classList.remove('is-open');
  navDotsBtn.setAttribute('aria-expanded', 'false');
}

navDotsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const isOpen = navDropdown.classList.toggle('open');
  navDotsBtn.classList.toggle('is-open', isOpen);
  navDotsBtn.setAttribute('aria-expanded', String(isOpen));
});

document.addEventListener('click', (e) => {
  if (!navDropdown.contains(e.target) && e.target !== navDotsBtn) {
    closeNavDropdown();
  }
});

// --- Dialog de suporte ---
const supportOverlay = document.getElementById('supportOverlay');
const btnSupport = document.getElementById('btnSupport');
const supportClose = document.getElementById('supportClose');

btnSupport.addEventListener('click', () => {
  closeNavDropdown();
  supportOverlay.classList.add('open');
});
supportClose.addEventListener('click', () => supportOverlay.classList.remove('open'));
supportOverlay.addEventListener('click', (e) => {
  if (e.target === supportOverlay) supportOverlay.classList.remove('open');
});

// --- Gerenciar perfil (sem ação definida ainda) ---
const btnManageProfile = document.getElementById('btnManageProfile');
if (btnManageProfile) {
  btnManageProfile.addEventListener('click', () => {
    closeNavDropdown();
    window.location.href = '/myhub.js';
  });
}

// --- Sair: apaga o token/cookie no servidor e volta pra tela de login ---
const btnLogout = document.getElementById('btnLogout');
btnLogout.addEventListener('click', async () => {
  closeNavDropdown();
  try {
    await fetch('/auth/logout', { method: 'POST' });
  } catch (err) {
    console.error('Erro ao sair:', err);
  }
  window.location.href = '/';
});
</script>

<script>
// --- Dialog de Vagas ---
(function () {
  const overlay = document.getElementById('vagasOverlay');
  const body = document.getElementById('vagasBody');
  const btnAbrir = document.getElementById('btnInscrever');
  const btnFechar = document.getElementById('vagasClose');
  const btnContinuar = document.getElementById('vagasContinuar');

  let vagaSelecionada = null;
  let vagasCarregadas = false;

  function renderVagas(vagas) {
    if (!vagas.length) {
      body.innerHTML = '<div class="vagas-empty">Nenhuma vaga aberta no momento.</div>';
      return;
    }
    body.innerHTML = vagas.map((v) => (
      '<label class="vagas-item" data-id="' + v.id + '">' +
        '<input type="radio" name="vaga" value="' + v.id + '">' +
        '<div class="vagas-item-info">' +
          '<div class="titulo">' + v.titulo + '</div>' +
          '<div class="meta">' + v.area + ' · ' + v.local + ' · ' + v.tipo + '</div>' +
        '</div>' +
      '</label>'
    )).join('');

    body.querySelectorAll('.vagas-item').forEach((item) => {
      item.addEventListener('click', () => {
        body.querySelectorAll('.vagas-item').forEach((i) => i.classList.remove('selected'));
        item.classList.add('selected');
        item.querySelector('input[type=radio]').checked = true;
        vagaSelecionada = item.getAttribute('data-id');
        btnContinuar.disabled = false;
      });
    });
  }

  async function carregarVagas() {
    body.innerHTML = '<div class="vagas-loading">Carregando vagas...</div>';
    try {
      const r = await fetch('/vagas');
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Erro ao carregar vagas.');
      renderVagas(data.vagas || []);
      vagasCarregadas = true;
    } catch (err) {
      body.innerHTML = '<div class="vagas-error">Não foi possível carregar as vagas agora.</div>';
    }
  }

  function abrirDialog() {
    overlay.classList.add('open');
    vagaSelecionada = null;
    btnContinuar.disabled = true;
    if (!vagasCarregadas) carregarVagas();
  }

  function fecharDialog() {
    overlay.classList.remove('open');
  }

  btnAbrir.addEventListener('click', (e) => {
    e.preventDefault();
    abrirDialog();
  });
  btnFechar.addEventListener('click', fecharDialog);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) fecharDialog();
  });

  // "Continuar" nao envia mais nada aqui: so guarda a lista de vagas e a
  // selecionada, fecha este dialog e abre o de dados pessoais.
  btnContinuar.addEventListener('click', () => {
    if (!vagaSelecionada) return;
    fecharDialog();
    window.abrirDadosPessoais(vagasCache, vagaSelecionada);
  });

  // Guarda a lista crua de vagas (com id/titulo) pra popular o seletor
  // do segundo formulario sem precisar buscar de novo.
  let vagasCache = [];
  const _renderVagasOriginal = renderVagas;
  renderVagas = function (vagas) {
    vagasCache = vagas;
    _renderVagasOriginal(vagas);
  };
})();
</script>

<script>
// --- Dialog de Dados pessoais (segunda etapa, exige login) ---
(function () {
  const overlay = document.getElementById('dadosOverlay');
  const btnClose = document.getElementById('dadosClose');
  const btnEnviar = document.getElementById('dadosEnviar');
  const errorBox = document.getElementById('dadosError');

  const campoNome = document.getElementById('campoNome');
  const campoCpf = document.getElementById('campoCpf');
  const campoRg = document.getElementById('campoRg');
  const campoEmail = document.getElementById('campoEmail');
  const campoEstadoCivil = document.getElementById('campoEstadoCivil');
  const campoVagaTitulo = document.getElementById('campoVagaTitulo');
  const campoVaga = document.getElementById('campoVaga');
  const campoNascimento = document.getElementById('campoNascimento');
  const campoTel = document.getElementById('campoTel');
  const campoEndereco = document.getElementById('campoEndereco');

  // --- Mascaras: aplicam formatação progressiva conforme o usuario digita ---
  function onlyDigits(str) { return str.replace(/\D/g, ''); }

  function maskCpf(digits) {
    digits = digits.slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return digits.replace(/(\d{3})(\d+)/, '$1.$2');
    if (digits.length <= 9) return digits.replace(/(\d{3})(\d{3})(\d+)/, '$1.$2.$3');
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d+)/, '$1.$2.$3-$4');
  }

  function maskRg(digits) {
    digits = digits.slice(0, 9);
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return digits.replace(/(\d{2})(\d+)/, '$1.$2');
    if (digits.length <= 8) return digits.replace(/(\d{2})(\d{3})(\d+)/, '$1.$2.$3');
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d+)/, '$1.$2.$3-$4');
  }

  function maskTel(digits) {
    digits = digits.slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return digits.replace(/(\d{2})(\d+)/, '($1) $2');
    return digits.replace(/(\d{2})(\d{5})(\d+)/, '($1) $2-$3');
  }

  function maskData(digits) {
    digits = digits.slice(0, 6);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return digits.replace(/(\d{2})(\d+)/, '$1/$2');
    return digits.replace(/(\d{2})(\d{2})(\d+)/, '$1/$2/$3');
  }

  campoCpf.addEventListener('input', () => { campoCpf.value = maskCpf(onlyDigits(campoCpf.value)); });
  campoRg.addEventListener('input', () => { campoRg.value = maskRg(onlyDigits(campoRg.value)); });
  campoTel.addEventListener('input', () => { campoTel.value = maskTel(onlyDigits(campoTel.value)); });
  campoNascimento.addEventListener('input', () => { campoNascimento.value = maskData(onlyDigits(campoNascimento.value)); });

  // Nome: so letras (com acento) e espaco
  campoNome.addEventListener('input', () => {
    campoNome.value = campoNome.value.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ\s]/g, '').slice(0, 100);
  });

  // Endereco: letras, numeros, "." e "-"
  campoEndereco.addEventListener('input', () => {
    campoEndereco.value = campoEndereco.value.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ0-9.\-\s]/g, '').slice(0, 160);
  });

  // --- Validação de CPF (dígitos verificadores) no client, espelhando o servidor ---
  function isValidCpf(digits) {
    if (digits.length !== 11) return false;
    if (/^(\\d)\\1{10}$/.test(digits)) return false;
    const calcDigit = (base) => {
      let sum = 0, weight = base.length + 1;
      for (const ch of base) { sum += parseInt(ch, 10) * weight; weight -= 1; }
      const rest = sum % 11;
      return rest < 2 ? 0 : 11 - rest;
    };
    const d1 = calcDigit(digits.slice(0, 9));
    const d2 = calcDigit(digits.slice(0, 9) + String(d1));
    return digits === digits.slice(0, 9) + String(d1) + String(d2);
  }

  // Ao terminar de digitar o CPF (blur), avisa se os dígitos verificadores não batem
  campoCpf.addEventListener('blur', () => {
    const digits = onlyDigits(campoCpf.value);
    if (digits.length === 11 && !isValidCpf(digits)) {
      errorBox.textContent = 'CPF inválido (dígitos verificadores não conferem).';
    } else if (errorBox.textContent.indexOf('CPF inválido') === 0) {
      errorBox.textContent = '';
    }
  });

  function fecharDialog() { overlay.classList.remove('open'); }
  btnClose.addEventListener('click', fecharDialog);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) fecharDialog(); });

  // Chamada pelo dialog de Vagas: recebe a lista de vagas e a vaga ja escolhida
  window.abrirDadosPessoais = async function (vagasCache, vagaIdSelecionada) {
    errorBox.textContent = '';
    campoNome.value = '';
    campoCpf.value = '';
    campoRg.value = '';
    campoEstadoCivil.value = '';
    campoNascimento.value = '';
    campoTel.value = '';
    campoEndereco.value = '';

    // Popula o email a partir da sessão logada (nunca editável)
    try {
      const r = await fetch('/auth/me');
      if (!r.ok) {
        window.location.href = '/'; // sem sessão: manda pra tela de login
        return;
      }
      const data = await r.json();
      campoEmail.value = data.user.email;
    } catch (err) {
      window.location.href = '/';
      return;
    }

    // Popula o seletor de vaga com a lista já carregada, marcando a escolhida
    campoVaga.innerHTML = vagasCache.map((v) => (
      '<option value="' + v.id + '"' + (v.id === vagaIdSelecionada ? ' selected' : '') + '>' + v.titulo + '</option>'
    )).join('');
    const vagaAtual = vagasCache.find((v) => v.id === vagaIdSelecionada);
    campoVagaTitulo.value = vagaAtual ? vagaAtual.titulo : '';

    campoVaga.onchange = () => {
      const v = vagasCache.find((x) => x.id === campoVaga.value);
      campoVagaTitulo.value = v ? v.titulo : '';
    };

    overlay.classList.add('open');
  };

  btnEnviar.addEventListener('click', async () => {
    errorBox.textContent = '';

    const payload = {
      nome: campoNome.value.trim(),
      cpf: campoCpf.value,
      rg: campoRg.value,
      estadoCivil: campoEstadoCivil.value,
      vagaId: campoVaga.value,
      dataNascimento: campoNascimento.value,
      tel: campoTel.value,
      endereco: campoEndereco.value.trim(),
    };

    if (!payload.nome || !payload.cpf || !payload.rg || !payload.estadoCivil ||
        !payload.vagaId || !payload.dataNascimento || !payload.tel || !payload.endereco) {
      errorBox.textContent = 'Preencha todos os campos.';
      return;
    }
    if (!isValidCpf(onlyDigits(payload.cpf))) {
      errorBox.textContent = 'CPF inválido.';
      return;
    }

    btnEnviar.disabled = true;
    btnEnviar.textContent = 'Enviando...';
    try {
      const r = await fetch('/vagas/finalizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Erro ao enviar inscrição.');
      btnEnviar.textContent = 'Inscrição enviada!';
      setTimeout(() => {
        overlay.classList.remove('open');
        btnEnviar.textContent = 'Enviar inscrição';
        btnEnviar.disabled = false;
      }, 1200);
    } catch (err) {
      btnEnviar.textContent = 'Enviar inscrição';
      btnEnviar.disabled = false;
      errorBox.textContent = err.message || 'Erro ao enviar. Tente novamente.';
    }
  });
})();
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
