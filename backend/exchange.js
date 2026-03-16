const https = require('https');
const fs = require('fs');

const BASIC_AUTH = 'MWZkMjF2ZXNnOTduMW5yN3U1cDIxbHA4OHQ6dTdzNm1qdDg2ajZpYWdwYm42M21lMzVwdHB2b3ZkMm8zY28ybGdlNG9oamZnZjk2cjRs';
const CODE = 'd4ce09a5-c1d7-4c00-8e79-c0eb995fa39e';
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
                const envPath = __dirname + '/.env';
                let env = fs.readFileSync(envPath, 'utf8');
                env = env.replace(/CONTA_AZUL_ACCESS_TOKEN_RJ="[^"]*"/, 'CONTA_AZUL_ACCESS_TOKEN_RJ="' + j.access_token + '"');
                if (j.refresh_token) {
                    env = env.replace(/CONTA_AZUL_REFRESH_TOKEN_RJ="[^"]*"/, 'CONTA_AZUL_REFRESH_TOKEN_RJ="' + j.refresh_token + '"');
                }
                fs.writeFileSync(envPath, env);
                console.log('TOKEN DE PRODUCAO SALVO!');
                console.log('access_token length:', j.access_token.length);
                if (j.refresh_token) console.log('refresh_token length:', j.refresh_token.length);

                // Testa a API com dados reais
                const r2 = https.request({
                    hostname: 'api-v2.contaazul.com',
                    path: '/v1/categorias?pagina=1&tamanhoPagina=5',
                    method: 'GET',
                    headers: { 'Authorization': 'Bearer ' + j.access_token, 'Accept': 'application/json' }
                }, (res2) => {
                    let b2 = '';
                    res2.on('data', d => b2 += d);
                    res2.on('end', () => console.log('API PRODUCAO:', res2.statusCode, b2.substring(0, 300)));
                });
                r2.end();
            } else {
                console.log('ERRO:', body);
            }
        } catch (e) {
            console.log('ERRO PARSE:', e.message, body);
        }
    });
});
req.write(postData);
req.end();
