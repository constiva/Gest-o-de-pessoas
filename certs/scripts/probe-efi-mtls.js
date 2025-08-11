// scripts/probe-efi-mtls.js
const fs = require('fs');
const https = require('https');
const url = require('url');

// Ajuste para sandbox ou produção
const HOST = process.env.EFI_SANDBOX === 'true'
  ? 'apis-h.efipay.com.br' // homolog
  : 'apis.efipay.com.br';   // produção

// Lê seu bundle PEM (KEY + CERT). Se preferir, separe em key/cert.
const pemPath = process.env.EFI_CERT_PATH || './certs/homologacao-bundle.pem';
const pem = fs.readFileSync(pemPath, 'utf8');

// Tenta extrair KEY e CERT do bundle
const keyMatch = pem.match(/-----BEGIN PRIVATE KEY-----[\s\S]+?-----END PRIVATE KEY-----/);
const certMatch = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/);

if (!keyMatch || !certMatch) {
  console.error('Bundle PEM não contém PRIVATE KEY e CERTIFICATE.');
  process.exit(1);
}

const agent = new https.Agent({
  keepAlive: false,
  // mTLS:
  key: keyMatch[0],
  cert: certMatch[0],
  // você pode acrescentar CA se tiver cadeia adicional:
  // ca: fs.readFileSync('./certs/chain.pem'),
  rejectUnauthorized: true,
});

const opts = {
  host: HOST,
  port: 443,
  method: 'GET',
  path: '/',           // só pra fechar handshake
  agent,
  headers: { 'User-Agent': 'probe-efi-mtls' },
};

console.log('[PROBE] tentando TLS em', `https://${HOST}/`);
const req = https.request(opts, (res) => {
  console.log('[PROBE] status:', res.statusCode);
  console.log('[PROBE] headers:', res.headers);
  res.resume();
  res.on('end', () => process.exit(0));
});

req.on('error', (err) => {
  console.error('[PROBE][ERROR]', err.code || '', err.message);
  if (err.reason) console.error('reason:', err.reason);
  if (err.response) console.error('resp-like:', err.response?.status, err.response?.data);
  process.exit(2);
});

req.end();
