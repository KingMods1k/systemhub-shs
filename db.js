// db.js — conexão com MongoDB Atlas e acesso à coleção "users"
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  throw new Error(
    'MONGO_URI ausente. Defina a connection string do MongoDB Atlas na variável de ambiente MONGO_URI (veja .env.example).'
  );
}

const DB_NAME = process.env.MONGO_DB_NAME || 'SHS';
console.log('[db.js] Usando banco: "' + DB_NAME + '" (confira se bate exatamente, maiuscula/minuscula, com o nome no Atlas)');

const client = new MongoClient(MONGO_URI, {
  serverSelectionTimeoutMS: 8000, // falha rapido e com erro claro, em vez de travar ~30s
  connectTimeoutMS: 8000,
});

let usersCollection = null;
let rhsCollection = null;
let clientConnectPromise = null;

// Garante que o client.connect() só roda uma vez, seja pedido via
// connect() (users) ou connectRHs() (RHs) — as duas compartilham a mesma conexão.
async function ensureClientConnected() {
  if (!clientConnectPromise) {
    clientConnectPromise = client.connect().then(() => client.db(DB_NAME));
    // Se a conexao falhar, libera pra tentar de novo na proxima chamada em vez
    // de ficar preso pra sempre repetindo o mesmo erro guardado em cache.
    clientConnectPromise.catch((err) => {
      console.error('[db.js] Falha ao conectar no MongoDB:', err.message);
      clientConnectPromise = null;
    });
  }
  return clientConnectPromise;
}

async function connect() {
  if (usersCollection) return usersCollection;
  const db = await ensureClientConnected();
  usersCollection = db.collection('users');
  // Garante email único a nível de banco (equivalente ao UNIQUE do SQLite)
  await usersCollection.createIndex({ _email: 1 }, { unique: true });
  console.log('Conectado ao MongoDB (' + DB_NAME + ') — collection users');
  return usersCollection;
}

// Coleção "RHs" — solicitações de admissão feitas pelo hub interno (/myhub.js).
async function connectRHs() {
  if (rhsCollection) return rhsCollection;
  const db = await ensureClientConnected();
  rhsCollection = db.collection('RHs');
  console.log('Conectado ao MongoDB (' + DB_NAME + ') — collection RHs');
  return rhsCollection;
}

let vagasCollection = null;

// Coleção "Vagas" — lista de vagas abertas mostrada no dialog de inscrição da landing page.
async function connectVagas() {
  if (vagasCollection) return vagasCollection;
  const db = await ensureClientConnected();
  vagasCollection = db.collection('Vagas');
  console.log('Conectado ao MongoDB (' + DB_NAME + ') — collection Vagas');
  return vagasCollection;
}

let processosCollection = null;

// Coleção "processos" — dados pessoais enviados pelo candidato na segunda
// etapa da inscrição (apos escolher a vaga e clicar em "Continuar").
async function connectProcessos() {
  if (processosCollection) return processosCollection;
  const db = await ensureClientConnected();
  processosCollection = db.collection('processos');
  console.log('Conectado ao MongoDB (' + DB_NAME + ') — collection processos');
  return processosCollection;
}

let financeiroCollection = null;

// Coleção "Financeiro" — documento único (_id: 'geral') com entrada, saida e
// saldo (patrimônio) acumulados. Persistido aqui; o timer que gera os
// incrementos de saída roda em memória (ver finance.js).
async function connectFinanceiro() {
  if (financeiroCollection) return financeiroCollection;
  const db = await ensureClientConnected();
  financeiroCollection = db.collection('Financeiro');
  console.log('Conectado ao MongoDB (' + DB_NAME + ') — collection Financeiro');
  return financeiroCollection;
}

module.exports = { connect, connectRHs, connectVagas, connectProcessos, connectFinanceiro };
