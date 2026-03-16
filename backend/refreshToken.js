/**
 * Script para obter token fresco da Conta Azul.
 * 
 * USO: node refreshToken.js
 * 
 * Rode a partir da pasta backend:
 *   cd conta_azul_dashboard/backend
 *   node refreshToken.js
 */

const https = require('https');
const fs = require('fs');
const readline = require('readline');
const { exec } = require('child_process');

const CLIENT_ID = '1fd21vesg97n1nr7u5p21lp88t';
const CLIENT_SECRET = 'u7s6mjt86j6iagpbn63me35ptpvovd2o3co2lge4ohjfgf96r4l';
const REDIRECT_URI = 'https://google.com';
const AUTH_URL = `https://auth.contaazul.com/login?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=refresh&scope=openid+profile+aws.cognito.signin.user.admin`;

console.log('');
console.log('===========================================');
console.log('  🔐 Atualizar Token - Conta Azul API');
console.log('===========================================');
console.log('');

// Abre o navegador
exec(`start "" "${AUTH_URL}"`);

console.log('Navegador aberto! Faça login e depois');
console.log('copie o link do Google e cole aqui:');
console.log('');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('📋 Cole o link: ', (url) => {
    rl.close();
    let code;
    try {
        code = new URL(url.trim()).searchParams.get('code');
    } catch {
        const m = url.match(/code=([^&]+)/);
        code = m ? m[1] : null;
    }
    if (!code) { console.log('❌ Código não encontrado.'); process.exit(1); }

    console.log('Trocando código por token...');

    const basicAuth = Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64');
    const postData = 'grant_type=authorization_code&redirect_uri=' + encodeURIComponent(REDIRECT_URI) + '&code=' + code;

    const req = https.request({
        hostname: 'auth.contaazul.com', path: '/oauth2/token', method: 'POST',
        headers: { 'Authorization': 'Basic ' + basicAuth, 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) }
    }, (res) => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => {
            const j = JSON.parse(body);
            if (j.access_token) {
                const envPath = __dirname + '/.env';
                let env = fs.readFileSync(envPath, 'utf8');
                env = env.replace(/CONTA_AZUL_ACCESS_TOKEN_RJ="[^"]*"/, 'CONTA_AZUL_ACCESS_TOKEN_RJ="' + j.access_token + '"');
                if (j.refresh_token) env = env.replace(/CONTA_AZUL_REFRESH_TOKEN_RJ="[^"]*"/, 'CONTA_AZUL_REFRESH_TOKEN_RJ="' + j.refresh_token + '"');
                fs.writeFileSync(envPath, env);
                console.log('');
                console.log('🎉 TOKEN ATUALIZADO COM SUCESSO!');
                console.log('   .env salvo. Agora rode: npm run dev');
            } else {
                console.log('❌ Erro:', body);
            }
            process.exit(0);
        });
    });
    req.write(postData);
    req.end();
});
