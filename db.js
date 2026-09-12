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
let connectPromise = null;

async function connect() {
  if (usersCollection) return usersCollection;
  if (!connectPromise) {
    connectPromise = client.connect().then(async () => {
      const db = client.db(DB_NAME);
      usersCollection = db.collection('users');
      // Garante email único a nível de banco (equivalente ao UNIQUE do SQLite)
      await usersCollection.createIndex({ _email: 1 }, { unique: true });
      console.log('Conectado ao MongoDB (' + DB_NAME + ')');
      return usersCollection;
    });
  }
  return connectPromise;
}

module.exports = { connect };
