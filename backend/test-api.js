const https = require('https');
const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
const tokenMatch = envFile.match(/CONTA_AZUL_ACCESS_TOKEN_RJ="([^"]+)"/);
const token = tokenMatch ? tokenMatch[1] : null;

if (!token) {
    console.error('Token nao encontrado no .env');
    process.exit(1);
}

function testApi(url) {
    return new Promise((resolve) => {
        https.get('https://api-v2.contaazul.com/v1' + url, {
            headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' }
        }, (res) => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => {
                try {
                    const j = JSON.parse(body);
                    resolve({ status: res.statusCode, total: j.itens_totais, firstDates: j.itens?.map(i => i.emissao) });
                } catch (e) { resolve({ status: res.statusCode, body: body.substring(0, 100) }); }
            });
        });
    });
}

async function main() {
    console.log("Teste de Data YYYY-MM-DD:");
    const r1 = await testApi('/venda/busca?emissao_de=2025-01-01&emissao_ate=2026-12-31');
    console.log(r1);

    console.log("\nTeste de Data DD/MM/YYYY:");
    const r2 = await testApi('/venda/busca?emissao_de=01/01/2025&emissao_ate=31/12/2026');
    console.log(r2);
}
main();
