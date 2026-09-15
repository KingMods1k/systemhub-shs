// finance.js — números "ao vivo" de Entrada/Saída/Liquidez mostrados na
// landing page (seção "Auron em Números").
//
// Como funciona:
//   - Entrada e saída ficam persistidas no Mongo, num único documento
//     (_id: 'geral') na collection "Financeiro". Saldo (liquidez) NÃO é
//     mais persistido: é calculado sempre como entrada - saida na leitura.
//   - Entrada é um valor FIXO (ENTRADA_SEED), controlado manualmente pelo
//     RH direto no Atlas — não tem timer nem geração automática.
//   - O que roda "em memória" é só o AGENDADOR do próximo incremento de
//     saída: um setTimeout com atraso aleatório entre 10s e 170s. A cada
//     disparo, gera um valor aleatório em R$ (140,00 a 1.515,99), CONVERTE
//     pela cotação atual do USD/BRL (dividindo pelo dólar) e soma esse
//     resultado ao total de saída + persiste no Mongo.
//   - A cotação do dólar é cacheada por alguns minutos (não precisa buscar
//     a cada disparo do timer) e vem da AwesomeAPI, que não exige chave.

const { connectFinanceiro } = require('./db');

const SAIDA_MIN_REAIS = 140.0;
const SAIDA_MAX_REAIS = 1515.99;

const TIMER_MIN_MS = 10 * 1000;   // 10s
const TIMER_MAX_MS = 170 * 1000;  // 170s

const USD_CACHE_MS = 3 * 60 * 1000; // recotiza a cada 3 minutos
const USD_FALLBACK = 5.0; // usado só se a API falhar e ainda não houver cache

let cachedUsd = { value: USD_FALLBACK, fetchedAt: 0 };

// ---------------------------------------------------------------------------
// Cotação USD/BRL — AwesomeAPI (gratuita, sem chave, resposta pequena em JSON)
// https://docs.awesomeapi.com.br/api-de-moedas
// ---------------------------------------------------------------------------
async function getUsdBrl() {
  const now = Date.now();
  if (now - cachedUsd.fetchedAt < USD_CACHE_MS) {
    return cachedUsd.value;
  }
  try {
    const resp = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL');
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    const bid = parseFloat(data?.USDBRL?.bid);
    if (!bid || Number.isNaN(bid)) throw new Error('Resposta sem "bid" valido.');
    cachedUsd = { value: bid, fetchedAt: now };
    return bid;
  } catch (err) {
    console.error('[finance.js] Falha ao buscar cotacao USD/BRL, usando ultimo valor conhecido:', err.message);
    // Mantem o cache antigo vivo (so atualiza o timestamp pra nao martelar a
    // API a cada chamada durante uma falha prolongada).
    cachedUsd = { value: cachedUsd.value, fetchedAt: now };
    return cachedUsd.value;
  }
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function randomTimerDelay() {
  return Math.floor(randomBetween(TIMER_MIN_MS, TIMER_MAX_MS));
}

// ---------------------------------------------------------------------------
// Persistência — documento único "geral"
// ---------------------------------------------------------------------------
const ENTRADA_SEED = 1175872637.51; // valor fixo — controlado manualmente pelo RH no Atlas

async function getState() {
  const col = await connectFinanceiro();
  let doc = await col.findOne({ _id: 'geral' });
  if (!doc) {
    doc = { _id: 'geral', entrada: ENTRADA_SEED, saida: 0, updated_at: new Date() };
    await col.insertOne(doc);
  }
  const entrada = doc.entrada || 0;
  const saida = doc.saida || 0;
  // Liquidez nao fica mais persistida isolada: e sempre entrada - saida,
  // calculada na leitura, pra nunca dessincronizar dos dois campos fonte.
  return { ...doc, entrada, saida, saldo: entrada - saida };
}

async function applySaida(valor) {
  const col = await connectFinanceiro();
  const result = await col.findOneAndUpdate(
    { _id: 'geral' },
    { $inc: { saida: valor }, $set: { updated_at: new Date() } },
    { upsert: true, returnDocument: 'after' }
  );
  return result.value || result; // compat entre versões do driver
}

// ---------------------------------------------------------------------------
// Agendador do timer de saída (em memória — reinicia do zero a cada boot)
// ---------------------------------------------------------------------------
let timerHandle = null;

async function tick() {
  try {
    const valorBase = randomBetween(SAIDA_MIN_REAIS, SAIDA_MAX_REAIS);
    const usd = await getUsdBrl();
    const valorConvertido = Math.round((valorBase / usd) * 100) / 100;
    await applySaida(valorConvertido);
  } catch (err) {
    console.error('[finance.js] Erro ao processar tick de saida:', err.message);
  } finally {
    scheduleNextTick();
  }
}

function scheduleNextTick() {
  const delay = randomTimerDelay();
  timerHandle = setTimeout(tick, delay);
  timerHandle.unref(); // nao mantem o processo vivo sozinho
}

// Chamar uma vez no boot do server (server.js)
function startFinanceEngine() {
  if (timerHandle) return; // ja iniciado
  scheduleNextTick();
  console.log('[finance.js] Motor de saida iniciado (proximo tick agendado).');
}

module.exports = {
  getState,
  getUsdBrl,
  startFinanceEngine,
};
