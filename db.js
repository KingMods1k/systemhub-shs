// db.js — conexão com MongoDB Atlas e acesso à coleção "users"
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  throw new Error(
    'MONGO_URI ausente. Defina a connection string do MongoDB Atlas na variável de ambiente MONGO_URI (veja .env.example).'
  );
}

const DB_NAME = process.env.MONGO_DB_NAME || 'shs';

const client = new MongoClient(MONGO_URI);

let usersCollection = null;
let rhsCollection = null;
let clientConnectPromise = null;

// Garante que o client.connect() só roda uma vez, seja pedido via
// connect() (users) ou connectRHs() (RHs) — as duas compartilham a mesma conexão.
async function ensureClientConnected() {
  if (!clientConnectPromise) {
    clientConnectPromise = client.connect().then(() => client.db(DB_NAME));
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

module.exports = { connect, connectRHs };
