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
function pemToArrayBuffer(pem) {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s+/g, '');
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

async function importTempRsaPublicKey(pem) {
  return crypto.subtle.importKey(
    'spki',
    pemToArrayBuffer(pem),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  );
}

// Cifra 1 arquivo (AES-256-GCM + envelope RSA-OAEP com chave temporaria) e envia.
async function encryptAndUploadFile(file, funcionarioId) {
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
  const rsaPublicKey = await importTempRsaPublicKey(publicKey);
  const encryptedAesKey = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, rsaPublicKey, rawAesKey);

  const uploadRes = await fetch('/myhub/documento/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      keyId,
      funcionarioId,
      mimetype: file.type || 'application/pdf',
      encryptedAesKey: bufferToBase64(encryptedAesKey),
      iv: bufferToBase64(iv),
      authTag: bufferToBase64(authTag),
      ciphertext: bufferToBase64(ciphertext),
    }),
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
</script>
</body>
</html>`;
}

module.exports = { renderMyHub };
