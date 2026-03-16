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

function testApi(label, url) {
    return new Promise((resolve) => {
        const fullUrl = 'https://api-v2.contaazul.com/v1' + url;
        console.log(`\n--- ${label} ---`);
        console.log(`URL: ${fullUrl}`);
        https.get(fullUrl, {
            headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' }
        }, (res) => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => {
                console.log(`Status: ${res.statusCode}`);
                try {
                    const j = JSON.parse(body);
                    console.log(`Total itens: ${j.itens_totais || 'N/A'}`);
                    console.log(`Itens nesta pagina: ${j.itens?.length || 0}`);
                    if (j.itens && j.itens.length > 0) {
                        console.log(`Primeiro item - emissao: ${j.itens[0].emissao}, numero: ${j.itens[0].numero}`);
                        console.log(`Ultimo item - emissao: ${j.itens[j.itens.length - 1].emissao}, numero: ${j.itens[j.itens.length - 1].numero}`);
                    }
                    resolve(j);
                } catch (e) {
                    console.log(`Body: ${body.substring(0, 300)}`);
                    resolve(null);
                }
            });
        }).on('error', e => { console.error(e); resolve(null); });
    });
}

async function main() {
    // Teste 1: sem filtro de data
    await testApi('SEM filtro de data', '/venda/busca?pagina=1&tamanhoPagina=5');

    // Teste 2: com emissao_de no formato DD/MM/YYYY 
    await testApi('emissao_de DD/MM/YYYY', '/venda/busca?emissao_de=01/01/2025&emissao_ate=31/12/2026&pagina=1&tamanhoPagina=5');

    // Teste 3: com emissao_de no formato YYYY-MM-DD
    await testApi('emissao_de YYYY-MM-DD', '/venda/busca?emissao_de=2025-01-01&emissao_ate=2026-12-31&pagina=1&tamanhoPagina=5');

    // Teste 4: com data_emissao_de (outro nome possível)
    await testApi('data_emissao_de YYYY-MM-DD', '/venda/busca?data_emissao_de=2025-01-01&data_emissao_ate=2026-12-31&pagina=1&tamanhoPagina=5');

    // Teste 5: dataInicio/dataFim (o nome antigo que usávamos)
    await testApi('dataInicio/dataFim YYYY-MM-DD', '/venda/busca?dataInicio=2025-01-01&dataFim=2026-12-31&pagina=1&tamanhoPagina=5');

    // Teste 6: Check a sale details to see what fields exist
    const result = await testApi('Primeira venda (detalhes)', '/venda/busca?pagina=1&tamanhoPagina=1');
    if (result && result.itens && result.itens[0]) {
        console.log('\n--- CAMPOS DA VENDA ---');
        console.log(JSON.stringify(result.itens[0], null, 2));
    }
}
main();
