const https = require('https');
const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
const tokenMatch = envFile.match(/CONTA_AZUL_ACCESS_TOKEN_RJ="([^"]+)"/);
const token = tokenMatch ? tokenMatch[1] : null;

function apiGet(url) {
    return new Promise((resolve) => {
        https.get('https://api-v2.contaazul.com/v1' + url, {
            headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' }
        }, (res) => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
                catch (e) { resolve({ status: res.statusCode, body: body.substring(0, 200) }); }
            });
        }).on('error', e => { resolve({ error: e.message }); });
    });
}

async function main() {
    // Binary search: find last page
    console.log('Procurando última página de vendas...');

    // Test some high pages
    const testPages = [100, 200, 500, 1000, 2000];
    for (const page of testPages) {
        const r = await apiGet(`/venda/busca?pagina=${page}`);
        const items = Array.isArray(r.data) ? r.data : (r.data?.itens || []);
        if (items.length > 0) {
            const dates = items.map(v => v.data).filter(Boolean).sort();
            console.log(`Pagina ${page}: ${items.length} itens, datas: ${dates[0]} a ${dates[dates.length - 1]}`);
        } else {
            console.log(`Pagina ${page}: VAZIA`);
        }
    }
}

main();
