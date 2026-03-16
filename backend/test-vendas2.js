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
                catch (e) { resolve({ status: res.statusCode, body: body.substring(0, 500) }); }
            });
        }).on('error', e => { resolve({ error: e.message }); });
    });
}

async function main() {
    // 1. Quantas paginas de vendas existem? Testar pagina 2, 3 etc.
    console.log('=== PAGINAÇÃO DE VENDAS ===');
    for (let page = 1; page <= 10; page++) {
        const r = await apiGet(`/venda/busca?pagina=${page}&tamanhoPagina=100`);
        if (r.data && r.data.length > 0) {
            const dates = r.data.map(v => v.data).filter(Boolean);
            const minDate = dates.sort()[0];
            const maxDate = dates.sort()[dates.length - 1];
            console.log(`Pagina ${page}: ${r.data.length} itens, datas: ${minDate} a ${maxDate}`);
        } else if (r.data && Array.isArray(r.data) && r.data.length === 0) {
            console.log(`Pagina ${page}: VAZIA (0 itens)`);
            break;
        } else {
            // Pode ser que o response muda de formato
            const items = r.data?.itens || r.data;
            if (Array.isArray(items) && items.length > 0) {
                const dates = items.map(v => v.data).filter(Boolean);
                const minDate = dates.sort()[0];
                const maxDate = dates.sort()[dates.length - 1];
                console.log(`Pagina ${page}: ${items.length} itens, datas: ${minDate} a ${maxDate}`);
            } else {
                console.log(`Pagina ${page}: resposta inesperada`, JSON.stringify(r.data).substring(0, 200));
                break;
            }
        }
    }

    // 2. Testar endpoint de NF-e
    console.log('\n=== TESTE ENDPOINT NF-e ===');
    const nfe1 = await apiGet('/nota-fiscal-servico/busca?pagina=1&tamanhoPagina=5');
    console.log('NFS-e:', nfe1.status, JSON.stringify(nfe1.data).substring(0, 300));

    const nfe2 = await apiGet('/nfe/busca?pagina=1&tamanhoPagina=5');
    console.log('NF-e:', nfe2.status, JSON.stringify(nfe2.data).substring(0, 300));

    // 3. Total de vendas na ultima pagina para estimar total
    console.log('\n=== ESTIMATIVA TOTAL ===');
    const r50 = await apiGet('/venda/busca?pagina=50&tamanhoPagina=100');
    const items50 = r50.data?.itens || (Array.isArray(r50.data) ? r50.data : []);
    if (items50.length > 0) {
        const dates = items50.map(v => v.data).filter(Boolean);
        console.log(`Pagina 50: ${items50.length} itens, datas: ${dates.sort()[0]} a ${dates.sort()[dates.length - 1]}`);
    } else {
        console.log(`Pagina 50: vazia ou erro`, JSON.stringify(r50.data).substring(0, 200));
    }
}

main();
