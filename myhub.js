// myhub.js — Hub interno (RHs). Servido em GET /myhub.js, só pra usuários com permission "authentic".
function renderMyHub(user) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>RHs — Auron</title>
<link rel="icon" type="image/x-icon" href="/favicon.ico">

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
html,body{height:100%}
body{
  background:var(--bg);
  color:var(--text);
  font-family:'Archivo',sans-serif;
  min-height:100vh;
  display:flex;
  flex-direction:column;
}

header{
  height:64px;flex:none;
  display:flex;align-items:center;justify-content:space-between;
  padding:0 28px;border-bottom:1px solid var(--line);
}
.hub-mark{font-family:'Bebas Neue',sans-serif;font-size:24px;letter-spacing:.06em}
.hub-mark span{color:var(--gold)}
.hub-back{font-size:13px;color:var(--text-dim);text-decoration:none;transition:color .2s ease}
.hub-back:hover{color:var(--gold)}

.hub-body{flex:1;display:flex;min-height:0}

.sidebar{
  width:230px;flex:none;border-right:1px solid var(--line);
  padding:18px 10px;display:flex;flex-direction:column;gap:2px;
}
.sidebar-item{
  background:none;border:none;text-align:left;color:var(--text);
  font-family:'Archivo',sans-serif;font-size:14px;padding:12px 14px;
  border-radius:4px;cursor:pointer;transition:background .2s ease, color .2s ease, transform .12s ease;
}
.sidebar-item:hover{background:var(--line);color:var(--gold)}
.sidebar-item:active{transform:scale(.97)}
.sidebar-item.active{background:var(--bg-alt);color:var(--gold);border-left:2px solid var(--gold)}

.main{flex:1;overflow-y:auto;padding:36px 40px}
.empty-state{
  height:100%;display:flex;align-items:center;justify-content:center;
  color:var(--text-dim);font-size:13px;letter-spacing:.02em;
}

.panel{display:none;max-width:640px}
.panel.visible{display:block}
.panel h2{font-family:'Bebas Neue',sans-serif;font-size:26px;letter-spacing:.03em;margin-bottom:26px}

.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px 20px}
.field{display:flex;flex-direction:column;gap:6px}
.field.full{grid-column:1 / -1}
.field label{font-size:12px;color:var(--text-dim);letter-spacing:.04em}
.field input{
  padding:12px 14px;border-radius:2px;border:1px solid var(--line);
  background:var(--bg-alt);color:var(--text);font-size:14px;
  font-family:'Archivo',sans-serif;transition:border-color .2s ease;
}
.field input:focus{outline:none;border-color:var(--gold-dim)}

@media (max-width:720px){
  header{height:52px;padding:0 16px}
  .hub-mark{font-size:19px}
  .hub-back{font-size:12px}

  .hub-body{flex-direction:column}

  .sidebar{
    width:100%;flex-direction:row;overflow-x:auto;
    border-right:none;border-bottom:1px solid var(--line);
    padding:8px 10px;gap:6px;
    -webkit-overflow-scrolling:touch;scrollbar-width:none;
  }
  .sidebar::-webkit-scrollbar{display:none}
  .sidebar-item{
    flex:none;font-size:12px;padding:8px 12px;white-space:nowrap;
  }
  .sidebar-item.active{border-left:none;border-bottom:2px solid var(--gold)}

  .main{padding:20px 16px}
  .panel h2{font-size:21px;margin-bottom:18px}
  .form-grid{grid-template-columns:1fr;gap:12px}
  .field input{padding:10px 12px;font-size:13px}
  .btn{padding:12px 20px;font-size:13px;width:100%}
}

.btn{
  padding:14px 26px;border:none;border-radius:2px;
  font-family:'Archivo',sans-serif;font-size:14px;font-weight:600;
  cursor:pointer;transition:transform .2s ease, opacity .2s ease, background .2s ease;
  margin-top:22px;
}
.btn:active{transform:scale(.97)}
.btn:disabled{opacity:.5;cursor:not-allowed;transform:none}
.btn-primary{background:var(--gold);color:var(--bg)}
.btn-primary:hover:not(:disabled){background:#d8b25c}

.msg{font-size:13px;margin-top:14px;min-height:16px}
.msg.error{color:var(--red)}
.msg.success{color:var(--gold)}

.file-hint{font-size:12px;color:var(--text-dim);margin-top:2px}
.file-hint.error{color:var(--red)}

/* --- Admitidos --- */
.admitidos-item{
  display:flex;justify-content:space-between;align-items:center;
  padding:14px 16px;border:1px solid var(--line);border-radius:2px;
  margin-bottom:8px;cursor:pointer;transition:border-color .2s ease, background .2s ease;
}
.admitidos-item:hover{border-color:var(--gold-dim);background:var(--bg-alt)}
.admitidos-item .nome{font-size:14px}
.admitidos-item .cargo{font-size:12px;color:var(--text-dim)}

.detalhe{display:none;margin-top:8px}
.detalhe.visible{display:block}
.detalhe.visible ~ #admitidosLista{display:none}
.btn-voltar{
  background:none;border:none;color:var(--text-dim);font-family:'Archivo',sans-serif;
  font-size:13px;cursor:pointer;padding:0;margin-bottom:20px;transition:color .2s ease;
}
.btn-voltar:hover{color:var(--gold)}

.docs-title{font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:.03em;margin:28px 0 12px}
.doc-card{
  display:flex;justify-content:space-between;align-items:center;gap:10px;
  padding:12px 14px;border:1px solid var(--line);border-radius:2px;margin-bottom:8px;
}
.doc-card .doc-nome{font-size:13px;color:var(--text-dim)}
.doc-card .doc-acoes{display:flex;gap:8px;flex:none}
.btn-mini{
  background:none;border:1px solid var(--line);color:var(--text);
  font-family:'Archivo',sans-serif;font-size:12px;padding:7px 12px;border-radius:2px;
  cursor:pointer;transition:border-color .2s ease, color .2s ease;
}
.btn-mini:hover{border-color:var(--gold-dim);color:var(--gold)}
.reenvio-field{margin-top:6px}

/* --- Processos --- */
.processos-search{
  width:100%;padding:12px 14px;border-radius:2px;border:1px solid var(--line);
  background:var(--bg-alt);color:var(--text);font-size:14px;
  font-family:'Archivo',sans-serif;margin-bottom:16px;transition:border-color .2s ease;
}
.processos-search:focus{outline:none;border-color:var(--gold-dim)}
.processos-item{
  display:flex;justify-content:space-between;align-items:center;
  padding:14px 16px;border:1px solid var(--line);border-radius:2px;
  margin-bottom:8px;cursor:pointer;transition:border-color .2s ease, background .2s ease;
}
.processos-item:hover{border-color:var(--gold-dim);background:var(--bg-alt)}
.processos-item .nome-wrap{display:flex;align-items:center;gap:8px}
.processos-item .nome{font-size:14px}
.processos-item .vaga{font-size:12px;color:var(--text-dim)}
.processos-item.nao-visto .nome{font-weight:700;color:var(--gold)}
.badge-novo{
  width:7px;height:7px;border-radius:50%;background:var(--gold);flex:none;
}
.campo-leitura{
  padding:12px 14px;border-radius:2px;border:1px solid var(--line);
  background:var(--bg-alt);color:var(--text);font-size:14px;
}
.btn-arquivar{background:var(--red);color:var(--text)}
.btn-arquivar:hover:not(:disabled){background:#c94848}

.processing-overlay{
  position:fixed;inset:0;background:rgba(0,0,0,.78);
  display:none;align-items:center;justify-content:center;
  flex-direction:column;gap:16px;z-index:500;
}
.processing-overlay.active{display:flex}
.spinner{
  width:52px;height:52px;border-radius:50%;
  border:4px solid rgba(255,255,255,.12);border-top-color:var(--gold);
  animation:hub-spin .8s linear infinite;
}
@keyframes hub-spin{to{transform:rotate(360deg)}}
.processing-text{font-size:13px;color:var(--text-dim);letter-spacing:.03em}
</style>
</head>
<body>

<header>
  <div class="hub-mark">RH<span>s</span></div>
  <a href="/" class="hub-back">&larr; Voltar</a>
</header>

<div class="hub-body">
  <div class="sidebar">
    <button class="sidebar-item" id="navAdmitir">Admitir</button>
    <button class="sidebar-item" id="navAdmitidos">Admitidos</button>
    <button class="sidebar-item" id="navProcessos">Processos</button>
  </div>

  <div class="main">
    <div class="empty-state" id="emptyState">Selecione uma opção ao lado.</div>

    <div class="panel" id="panelAdmitir">
      <h2>Admitir funcionário</h2>
      <form id="formAdmitir">
        <div class="form-grid">
          <div class="field full">
            <label for="f-nome">Nome</label>
            <input type="text" id="f-nome" required>
          </div>
          <div class="field">
            <label for="f-idade">Idade</label>
            <input type="number" id="f-idade" min="14" max="120" required>
          </div>
          <div class="field">
            <label for="f-data">Data</label>
            <input type="date" id="f-data" required>
          </div>
          <div class="field">
            <label for="f-email">Email</label>
            <input type="email" id="f-email" required>
          </div>
          <div class="field">
            <label for="f-tel">Tel</label>
            <input type="tel" id="f-tel" required>
          </div>
          <div class="field full">
            <label for="f-endereco">Endereço</label>
            <input type="text" id="f-endereco" required>
          </div>
          <div class="field">
            <label for="f-cpf">CPF</label>
            <input type="text" id="f-cpf" required>
          </div>
          <div class="field">
            <label for="f-rg">RG</label>
            <input type="text" id="f-rg" required>
          </div>
          <div class="field">
            <label for="f-cargo">Cargo</label>
            <input type="text" id="f-cargo" required>
          </div>
          <div class="field">
            <label for="f-funcoes">Funções</label>
            <input type="text" id="f-funcoes" required>
          </div>
          <div class="field full">
            <label for="f-cnpj">CNPJ</label>
            <input type="text" id="f-cnpj" required>
          </div>
          <div class="field full">
            <label for="f-documentos">Documentos (máx. 6, PDF)</label>
            <input type="file" id="f-documentos" accept="application/pdf" multiple>
            <div class="file-hint" id="fileHint"></div>
          </div>
        </div>

        <button type="submit" class="btn btn-primary" id="submitBtn">Solicitar Admissão</button>
        <div class="msg" id="msg"></div>
      </form>
    </div>

    <div class="panel" id="panelAdmitidos">
      <h2>Admitidos</h2>

      <div id="admitidosLista"></div>

      <div class="detalhe" id="admitidosDetalhe">
        <button type="button" class="btn-voltar" id="voltarLista">&larr; Voltar</button>
        <form id="formEditar">
          <div class="form-grid">
            <div class="field full">
              <label for="e-nome">Nome</label>
              <input type="text" id="e-nome" required>
            </div>
            <div class="field">
              <label for="e-idade">Idade</label>
              <input type="number" id="e-idade" min="14" max="120" required>
            </div>
            <div class="field">
              <label for="e-data">Data</label>
              <input type="date" id="e-data" required>
            </div>
            <div class="field">
              <label for="e-email">Email</label>
              <input type="email" id="e-email" required>
            </div>
            <div class="field">
              <label for="e-tel">Tel</label>
              <input type="tel" id="e-tel" required>
            </div>
            <div class="field full">
              <label for="e-endereco">Endereço</label>
              <input type="text" id="e-endereco" required>
            </div>
            <div class="field">
              <label for="e-cpf">CPF</label>
              <input type="text" id="e-cpf" required>
            </div>
            <div class="field">
              <label for="e-rg">RG</label>
              <input type="text" id="e-rg" required>
            </div>
            <div class="field">
              <label for="e-cargo">Cargo</label>
              <input type="text" id="e-cargo" required>
            </div>
            <div class="field">
              <label for="e-funcoes">Funções</label>
              <input type="text" id="e-funcoes" required>
            </div>
            <div class="field full">
              <label for="e-cnpj">CNPJ</label>
              <input type="text" id="e-cnpj" required>
            </div>
          </div>
          <button type="submit" class="btn btn-primary" id="salvarEdicaoBtn">Salvar alterações</button>
          <div class="msg" id="msgEditar"></div>
        </form>

        <h3 class="docs-title">Documentos</h3>
        <div id="documentosLista"></div>
        <div class="field full reenvio-field">
          <label for="e-reenviar">Enviar novo documento (substitui o selecionado)</label>
          <input type="file" id="e-reenviar" accept="application/pdf" style="display:none">
        </div>
      </div>
    </div>

    <div class="panel" id="panelProcessos">
      <h2>Processos</h2>

      <input type="text" class="processos-search" id="processosBusca" placeholder="Pesquisar por nome, CPF, email, vaga...">

      <div id="processosLista"></div>

      <div class="detalhe" id="processosDetalhe">
        <button type="button" class="btn-voltar" id="voltarListaProcessos">&larr; Voltar</button>
        <div class="form-grid">
          <div class="field full">
            <label>Nome</label>
            <div class="campo-leitura" id="p-nome"></div>
          </div>
          <div class="field">
            <label>CPF</label>
            <div class="campo-leitura" id="p-cpf"></div>
          </div>
          <div class="field">
            <label>RG</label>
            <div class="campo-leitura" id="p-rg"></div>
          </div>
          <div class="field">
            <label>Email</label>
            <div class="campo-leitura" id="p-email"></div>
          </div>
          <div class="field">
            <label>Estado civil</label>
            <div class="campo-leitura" id="p-estadoCivil"></div>
          </div>
          <div class="field">
            <label>Data de nascimento</label>
            <div class="campo-leitura" id="p-dataNascimento"></div>
          </div>
          <div class="field">
            <label>Telefone</label>
            <div class="campo-leitura" id="p-tel"></div>
          </div>
          <div class="field full">
            <label>Endereço</label>
            <div class="campo-leitura" id="p-endereco"></div>
          </div>
          <div class="field full">
            <label>Vaga</label>
            <div class="campo-leitura" id="p-vagaTitulo"></div>
          </div>
        </div>
        <button type="button" class="btn btn-primary btn-arquivar" id="arquivarBtn">Arquivar</button>
        <div class="msg" id="msgProcesso"></div>
      </div>
    </div>
  </div>
</div>

<div class="processing-overlay" id="processingOverlay">
  <div class="spinner"></div>
  <div class="processing-text" id="processingText">Processando...</div>
</div>

<script>
const navAdmitir = document.getElementById('navAdmitir');
const emptyState = document.getElementById('emptyState');
const panelAdmitir = document.getElementById('panelAdmitir');
const dataInput = document.getElementById('f-data');

dataInput.value = new Date().toISOString().slice(0, 10);

navAdmitir.addEventListener('click', () => {
  navAdmitir.classList.remove('active');
  navAdmitidos.classList.remove('active');
  navProcessos.classList.remove('active');
  panelAdmitidos.classList.remove('visible');
  panelProcessos.classList.remove('visible');
  navAdmitir.classList.add('active');
  emptyState.style.display = 'none';
  panelAdmitir.classList.add('visible');
});

const form = document.getElementById('formAdmitir');
const submitBtn = document.getElementById('submitBtn');
const msg = document.getElementById('msg');
const fileInput = document.getElementById('f-documentos');
const fileHint = document.getElementById('fileHint');
const processingOverlay = document.getElementById('processingOverlay');
const processingText = document.getElementById('processingText');

const MAX_FILES = 6;

fileInput.addEventListener('change', () => {
  if (fileInput.files.length > MAX_FILES) {
    fileHint.textContent = 'Máximo de ' + MAX_FILES + ' arquivos — selecione novamente.';
    fileHint.className = 'file-hint error';
    fileInput.value = '';
  } else if (fileInput.files.length > 0) {
    fileHint.textContent = fileInput.files.length + ' arquivo(s) selecionado(s).';
    fileHint.className = 'file-hint';
  } else {
    fileHint.textContent = '';
    fileHint.className = 'file-hint';
  }
});

// --- Helpers de criptografia (Web Crypto API, roda no navegador) ---
// O servidor manda a chave publica RSA ja em Base64 "cru" (sem cabecalho
// -----BEGIN/END----- nem quebras de linha), entao aqui e so decodificar
// direto, sem nenhuma limpeza/regex.
function base64ToArrayBuffer(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function importTempRsaPublicKey(base64Key) {
  return crypto.subtle.importKey(
    'spki',
    base64ToArrayBuffer(base64Key),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  );
}

// Cifra 1 arquivo (AES-256-GCM + envelope RSA-OAEP com chave temporaria) e envia.
// Se "substituirId" for passado, o documento troca no lugar em vez de empilhar mais um.
async function encryptAndUploadFile(file, funcionarioId, substituirId) {
  const tempRes = await fetch('/myhub/documento/rsa-temp');
  if (!tempRes.ok) throw new Error('Nao foi possivel obter chave temporaria do servidor.');
  const { keyId, publicKey } = await tempRes.json();

  const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const fileBuffer = await file.arrayBuffer();
  const encryptedCombined = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, fileBuffer);

  // O Web Crypto devolve ciphertext + tag colados (tag = ultimos 16 bytes) —
  // o server espera os dois separados, então separamos aqui antes de enviar.
  const combined = new Uint8Array(encryptedCombined);
  const authTag = combined.slice(combined.length - 16);
  const ciphertext = combined.slice(0, combined.length - 16);

  const rawAesKey = await crypto.subtle.exportKey('raw', aesKey);
  let rsaPublicKey, encryptedAesKey;
  try {
    rsaPublicKey = await importTempRsaPublicKey(publicKey);
    encryptedAesKey = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, rsaPublicKey, rawAesKey);
  } catch (e) {
    throw new Error('Falha ao cifrar a chave com RSA: ' + e.name + (e.message ? ' — ' + e.message : ''));
  }

  const uploadBody = {
    keyId,
    funcionarioId,
    mimetype: file.type || 'application/pdf',
    encryptedAesKey: bufferToBase64(encryptedAesKey),
    iv: bufferToBase64(iv),
    authTag: bufferToBase64(authTag),
    ciphertext: bufferToBase64(ciphertext),
  };
  if (substituirId) uploadBody.substituirId = substituirId;

  const uploadRes = await fetch('/myhub/documento/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(uploadBody),
  });

  if (!uploadRes.ok) {
    const data = await uploadRes.json().catch(() => ({}));
    throw new Error(data.error || ('Falha ao enviar "' + file.name + '".'));
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    nome: document.getElementById('f-nome').value.trim(),
    idade: document.getElementById('f-idade').value,
    data: document.getElementById('f-data').value,
    email: document.getElementById('f-email').value.trim(),
    tel: document.getElementById('f-tel').value.trim(),
    endereco: document.getElementById('f-endereco').value.trim(),
    cpf: document.getElementById('f-cpf').value.trim(),
    rg: document.getElementById('f-rg').value.trim(),
    cargo: document.getElementById('f-cargo').value.trim(),
    funcoes: document.getElementById('f-funcoes').value.trim(),
    cnpj: document.getElementById('f-cnpj').value.trim(),
  };
  const files = Array.from(fileInput.files || []);

  msg.className = 'msg';
  msg.textContent = '';
  submitBtn.disabled = true;
  processingText.textContent = 'Enviando dados...';
  processingOverlay.classList.add('active');

  try {
    const r = await fetch('/myhub/admitir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    if (!r.ok) {
      throw new Error(data.error || 'Erro ao enviar.');
    }

    // Envia os documentos um de cada vez, na ordem em que foram selecionados
    for (let i = 0; i < files.length; i++) {
      processingText.textContent = 'Enviando documento ' + (i + 1) + ' de ' + files.length + '...';
      await encryptAndUploadFile(files[i], data.id);
    }

    processingText.textContent = 'Concluído! Recarregando...';
    window.location.reload();
  } catch (err) {
    processingOverlay.classList.remove('active');
    msg.className = 'msg error';
    msg.textContent = err.message || 'Erro de conexão.';
    submitBtn.disabled = false;
  }
});

// --- Aba "Admitidos" ---
const navAdmitidos = document.getElementById('navAdmitidos');
const panelAdmitidos = document.getElementById('panelAdmitidos');
const admitidosLista = document.getElementById('admitidosLista');
const admitidosDetalhe = document.getElementById('admitidosDetalhe');
const voltarLista = document.getElementById('voltarLista');
const formEditar = document.getElementById('formEditar');
const salvarEdicaoBtn = document.getElementById('salvarEdicaoBtn');
const msgEditar = document.getElementById('msgEditar');
const documentosLista = document.getElementById('documentosLista');
const reenviarInput = document.getElementById('e-reenviar');

let funcionarios = [];
let funcionarioAtual = null;
let reenviarDocId = null;

// Gera um par RSA-OAEP DIRETO no navegador — a privada nunca sai daqui.
async function generateRsaKeyPair() {
  return crypto.subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['encrypt', 'decrypt']
  );
}

navAdmitidos.addEventListener('click', async () => {
  navAdmitir.classList.remove('active');
  navProcessos.classList.remove('active');
  panelAdmitir.classList.remove('visible');
  panelProcessos.classList.remove('visible');
  navAdmitidos.classList.add('active');
  emptyState.style.display = 'none';
  panelAdmitidos.classList.add('visible');
  admitidosDetalhe.classList.remove('visible');
  await loadAdmitidos();
});

navProcessos.addEventListener('click', async () => {
  navAdmitir.classList.remove('active');
  navAdmitidos.classList.remove('active');
  panelAdmitir.classList.remove('visible');
  panelAdmitidos.classList.remove('visible');
  navProcessos.classList.add('active');
  emptyState.style.display = 'none';
  panelProcessos.classList.add('visible');
  processosDetalhe.classList.remove('visible');
  processosLista.style.display = '';
  processosBusca.value = '';
  await loadProcessos();
});

async function loadAdmitidos() {
  admitidosLista.innerHTML = '<div class="file-hint">Carregando...</div>';
  try {
    const keyPair = await generateRsaKeyPair();
    const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    const publicKeyB64 = bufferToBase64(spki);

    const res = await fetch('/myhub/admitidos/listar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicKey: publicKeyB64 }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao carregar admitidos.');

    const encryptedAesKey = base64ToArrayBuffer(data.encryptedAesKey);
    const rawAesKey = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, keyPair.privateKey, encryptedAesKey);
    const aesKey = await crypto.subtle.importKey('raw', rawAesKey, { name: 'AES-GCM' }, false, ['decrypt']);

    const ciphertext = new Uint8Array(base64ToArrayBuffer(data.ciphertext));
    const authTag = new Uint8Array(base64ToArrayBuffer(data.authTag));
    const iv = base64ToArrayBuffer(data.iv);

    // Web Crypto espera ciphertext + tag colados no final.
    const combined = new Uint8Array(ciphertext.length + authTag.length);
    combined.set(ciphertext, 0);
    combined.set(authTag, ciphertext.length);

    const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, combined);
    const json = JSON.parse(new TextDecoder().decode(plainBuffer));
    funcionarios = json.funcionarios || [];
    renderAdmitidosList();
  } catch (err) {
    admitidosLista.innerHTML = '';
    const errDiv = document.createElement('div');
    errDiv.className = 'msg error';
    errDiv.textContent = err.message || 'Erro ao carregar admitidos.';
    admitidosLista.appendChild(errDiv);
  }
}

function renderAdmitidosList() {
  admitidosLista.innerHTML = '';
  if (funcionarios.length === 0) {
    admitidosLista.innerHTML = '<div class="file-hint">Nenhum funcionário admitido ainda.</div>';
    return;
  }
  funcionarios.forEach((f) => {
    const item = document.createElement('div');
    item.className = 'admitidos-item';
    item.innerHTML =
      '<span class="nome">' + escapeHtml(f.nome) + '</span>' +
      '<span class="cargo">' + escapeHtml(f.cargo) + '</span>';
    item.addEventListener('click', () => abrirDetalhe(f._id));
    admitidosLista.appendChild(item);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str == null ? '' : str);
  return div.innerHTML;
}

function abrirDetalhe(id) {
  funcionarioAtual = funcionarios.find((f) => f._id === id);
  if (!funcionarioAtual) return;

  document.getElementById('e-nome').value = funcionarioAtual.nome || '';
  document.getElementById('e-idade').value = funcionarioAtual.idade || '';
  document.getElementById('e-data').value = funcionarioAtual.data || '';
  document.getElementById('e-email').value = funcionarioAtual.email || '';
  document.getElementById('e-tel').value = funcionarioAtual.tel || '';
  document.getElementById('e-endereco').value = funcionarioAtual.endereco || '';
  document.getElementById('e-cpf').value = funcionarioAtual.cpf || '';
  document.getElementById('e-rg').value = funcionarioAtual.rg || '';
  document.getElementById('e-cargo').value = funcionarioAtual.cargo || '';
  document.getElementById('e-funcoes').value = funcionarioAtual.funcoes || '';
  document.getElementById('e-cnpj').value = funcionarioAtual.cnpj || '';
  msgEditar.className = 'msg';
  msgEditar.textContent = '';

  renderDocumentos();
  admitidosDetalhe.classList.add('visible');
}

voltarLista.addEventListener('click', () => {
  admitidosDetalhe.classList.remove('visible');
  funcionarioAtual = null;
});

function renderDocumentos() {
  documentosLista.innerHTML = '';
  const documentos = (funcionarioAtual && funcionarioAtual.documentos) || [];
  if (documentos.length === 0) {
    documentosLista.innerHTML = '<div class="file-hint">Nenhum documento enviado.</div>';
    return;
  }
  documentos.forEach((doc, idx) => {
    const card = document.createElement('div');
    card.className = 'doc-card';
    card.innerHTML =
      '<span class="doc-nome">Documento ' + (idx + 1) + ' — ' + escapeHtml(doc.mimetype) + '</span>' +
      '<span class="doc-acoes">' +
      '<button type="button" class="btn-mini" data-acao="baixar">Baixar</button>' +
      '<button type="button" class="btn-mini" data-acao="reenviar">Reenviar</button>' +
      '</span>';
    card.querySelector('[data-acao="baixar"]').addEventListener('click', () => baixarDocumento(doc));
    card.querySelector('[data-acao="reenviar"]').addEventListener('click', () => {
      reenviarDocId = doc._id;
      reenviarInput.value = '';
      reenviarInput.click();
    });
    documentosLista.appendChild(card);
  });
}

function baixarDocumento(doc) {
  const bytes = base64ToArrayBuffer(doc.conteudo);
  const blob = new Blob([bytes], { type: doc.mimetype || 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (funcionarioAtual.nome || 'documento').replace(/\s+/g, '_') + '.pdf';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

reenviarInput.addEventListener('change', async () => {
  const file = reenviarInput.files && reenviarInput.files[0];
  if (!file || !funcionarioAtual || !reenviarDocId) return;

  processingText.textContent = 'Reenviando documento...';
  processingOverlay.classList.add('active');
  try {
    await encryptAndUploadFile(file, funcionarioAtual._id, reenviarDocId);
    await loadAdmitidos();
    const id = funcionarioAtual._id;
    abrirDetalhe(id);
    msgEditar.className = 'msg success';
    msgEditar.textContent = 'Documento substituído com sucesso.';
  } catch (err) {
    msgEditar.className = 'msg error';
    msgEditar.textContent = err.message || 'Erro ao reenviar documento.';
  } finally {
    processingOverlay.classList.remove('active');
    reenviarDocId = null;
  }
});

formEditar.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!funcionarioAtual) return;

  const payload = {
    funcionarioId: funcionarioAtual._id,
    nome: document.getElementById('e-nome').value.trim(),
    idade: document.getElementById('e-idade').value,
    data: document.getElementById('e-data').value,
    email: document.getElementById('e-email').value.trim(),
    tel: document.getElementById('e-tel').value.trim(),
    endereco: document.getElementById('e-endereco').value.trim(),
    cpf: document.getElementById('e-cpf').value.trim(),
    rg: document.getElementById('e-rg').value.trim(),
    cargo: document.getElementById('e-cargo').value.trim(),
    funcoes: document.getElementById('e-funcoes').value.trim(),
    cnpj: document.getElementById('e-cnpj').value.trim(),
  };

  msgEditar.className = 'msg';
  msgEditar.textContent = '';
  salvarEdicaoBtn.disabled = true;

  try {
    const r = await fetch('/myhub/admitidos/editar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Erro ao salvar.');

    Object.assign(funcionarioAtual, payload);
    delete funcionarioAtual.funcionarioId;
    renderAdmitidosList();
    msgEditar.className = 'msg success';
    msgEditar.textContent = 'Dados salvos com sucesso.';
  } catch (err) {
    msgEditar.className = 'msg error';
    msgEditar.textContent = err.message || 'Erro de conexão.';
  } finally {
    salvarEdicaoBtn.disabled = false;
  }
});

// --- Aba "Processos" (inscritos pela página inicial) ---
const navProcessos = document.getElementById('navProcessos');
const panelProcessos = document.getElementById('panelProcessos');
const processosLista = document.getElementById('processosLista');
const processosBusca = document.getElementById('processosBusca');
const processosDetalhe = document.getElementById('processosDetalhe');
const voltarListaProcessos = document.getElementById('voltarListaProcessos');
const arquivarBtn = document.getElementById('arquivarBtn');
const msgProcesso = document.getElementById('msgProcesso');

let candidatos = [];
let candidatoAtual = null;

async function loadProcessos() {
  processosLista.innerHTML = '<div class="file-hint">Carregando...</div>';
  try {
    const keyPair = await generateRsaKeyPair();
    const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    const publicKeyB64 = bufferToBase64(spki);

    const res = await fetch('/myhub/processos/listar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicKey: publicKeyB64 }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao carregar processos.');

    const encryptedAesKey = base64ToArrayBuffer(data.encryptedAesKey);
    const rawAesKey = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, keyPair.privateKey, encryptedAesKey);
    const aesKey = await crypto.subtle.importKey('raw', rawAesKey, { name: 'AES-GCM' }, false, ['decrypt']);

    const ciphertext = new Uint8Array(base64ToArrayBuffer(data.ciphertext));
    const authTag = new Uint8Array(base64ToArrayBuffer(data.authTag));
    const iv = base64ToArrayBuffer(data.iv);

    const combined = new Uint8Array(ciphertext.length + authTag.length);
    combined.set(ciphertext, 0);
    combined.set(authTag, ciphertext.length);

    const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, combined);
    const json = JSON.parse(new TextDecoder().decode(plainBuffer));
    candidatos = json.candidatos || [];
    renderProcessosList();
  } catch (err) {
    processosLista.innerHTML = '';
    const errDiv = document.createElement('div');
    errDiv.className = 'msg error';
    errDiv.textContent = err.message || 'Erro ao carregar processos.';
    processosLista.appendChild(errDiv);
  }
}

// Pesquisa é só um filtro local em cima do que já foi carregado/decifrado — não bate
// no servidor de novo, e olha em todos os campos do candidato de uma vez.
function candidatoBateComBusca(c, termo) {
  if (!termo) return true;
  const alvo = [c.nome, c.cpf, c.rg, c.email, c.estadoCivil, c.vagaTitulo, c.dataNascimento, c.tel, c.endereco]
    .map((v) => String(v || '').toLowerCase())
    .join(' ');
  return alvo.includes(termo.toLowerCase());
}

function renderProcessosList() {
  processosLista.innerHTML = '';
  const termo = processosBusca.value.trim();
  const filtrados = candidatos.filter((c) => candidatoBateComBusca(c, termo));

  if (candidatos.length === 0) {
    processosLista.innerHTML = '<div class="file-hint">Nenhuma inscrição recebida ainda.</div>';
    return;
  }
  if (filtrados.length === 0) {
    processosLista.innerHTML = '<div class="file-hint">Nenhum resultado para essa busca.</div>';
    return;
  }

  filtrados.forEach((c) => {
    const item = document.createElement('div');
    item.className = 'processos-item' + (c.visto ? '' : ' nao-visto');
    item.innerHTML =
      '<span class="nome-wrap">' +
      (c.visto ? '' : '<span class="badge-novo"></span>') +
      '<span class="nome">' + escapeHtml(c.nome) + '</span>' +
      '</span>' +
      '<span class="vaga">' + escapeHtml(c.vagaTitulo) + '</span>';
    item.addEventListener('click', () => abrirDetalheProcesso(c._id));
    processosLista.appendChild(item);
  });
}

processosBusca.addEventListener('input', renderProcessosList);

async function abrirDetalheProcesso(id) {
  candidatoAtual = candidatos.find((c) => c._id === id);
  if (!candidatoAtual) return;

  document.getElementById('p-nome').textContent = candidatoAtual.nome || '';
  document.getElementById('p-cpf').textContent = candidatoAtual.cpf || '';
  document.getElementById('p-rg').textContent = candidatoAtual.rg || '';
  document.getElementById('p-email').textContent = candidatoAtual.email || '';
  document.getElementById('p-estadoCivil').textContent = candidatoAtual.estadoCivil || '';
  document.getElementById('p-dataNascimento').textContent = candidatoAtual.dataNascimento || '';
  document.getElementById('p-tel').textContent = candidatoAtual.tel || '';
  document.getElementById('p-endereco').textContent = candidatoAtual.endereco || '';
  document.getElementById('p-vagaTitulo').textContent = candidatoAtual.vagaTitulo || '';
  msgProcesso.className = 'msg';
  msgProcesso.textContent = '';
  arquivarBtn.disabled = false;

  processosLista.style.display = 'none';
  processosDetalhe.classList.add('visible');

  // Marca como visto ao abrir — se já estava visto, não faz requisição à toa.
  if (!candidatoAtual.visto) {
    candidatoAtual.visto = true;
    try {
      await fetch('/myhub/processos/marcar-visto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ processoId: candidatoAtual._id }),
      });
    } catch (err) {
      // Falha silenciosa: pior caso, o registro continua aparecendo como não-visto
      // na próxima vez que a lista for recarregada.
    }
  }
}

voltarListaProcessos.addEventListener('click', () => {
  processosDetalhe.classList.remove('visible');
  processosLista.style.display = '';
  candidatoAtual = null;
  renderProcessosList();
});

arquivarBtn.addEventListener('click', async () => {
  if (!candidatoAtual) return;
  arquivarBtn.disabled = true;
  msgProcesso.className = 'msg';
  msgProcesso.textContent = '';

  try {
    const r = await fetch('/myhub/processos/arquivar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ processoId: candidatoAtual._id }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Erro ao arquivar.');

    candidatos = candidatos.filter((c) => c._id !== candidatoAtual._id);
    candidatoAtual = null;
    processosDetalhe.classList.remove('visible');
    processosLista.style.display = '';
    renderProcessosList();
  } catch (err) {
    msgProcesso.className = 'msg error';
    msgProcesso.textContent = err.message || 'Erro de conexão.';
    arquivarBtn.disabled = false;
  }
});
</script>
</body>
</html>`;
}

module.exports = { renderMyHub };
