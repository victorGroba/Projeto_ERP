const https = require('https');
const fs = require('fs');
const path = require('path');

const BASIC_AUTH = 'MWZkMjF2ZXNnOTduMW5yN3U1cDIxbHA4OHQ6dTdzNm1qdDg2ajZpYWdwYm42M21lMzVwdHB2b3ZkMm8zY28ybGdlNG9oamZnZjk2cjRs';
const CODE = process.argv[2] || '1167bfa8-340c-4f66-8d40-ec8c3d65a767';

const postData = 'grant_type=authorization_code&redirect_uri=' + encodeURIComponent('https://google.com') + '&code=' + CODE;

const req = https.request({
    hostname: 'auth.contaazul.com',
    path: '/oauth2/token',
    method: 'POST',
    headers: {
        'Authorization': 'Basic ' + BASIC_AUTH,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
    }
}, (res) => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => {
        try {
            const j = JSON.parse(body);
            if (j.access_token) {
                const envPath = path.join(__dirname, '.env');
                let env = fs.readFileSync(envPath, 'utf8');
                env = env.replace(/CONTA_AZUL_ACCESS_TOKEN_RJ="[^"]*"/, `CONTA_AZUL_ACCESS_TOKEN_RJ="${j.access_token}"`);
                if (j.refresh_token) {
                    env = env.replace(/CONTA_AZUL_REFRESH_TOKEN_RJ="[^"]*"/, `CONTA_AZUL_REFRESH_TOKEN_RJ="${j.refresh_token}"`);
                }
                fs.writeFileSync(envPath, env);
                console.log('✅ TOKEN RENOVADO COM SUCESSO NO .ENV!');
            } else {
                console.error('❌ Falha na API Auth Conta Azul:', body);
            }
        } catch (e) {
            console.error('❌ Erro JSON:', e, body);
        }
    });
});

req.write(postData);
req.end();
