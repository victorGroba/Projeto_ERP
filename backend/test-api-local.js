const http = require('http');

// Step 1: Login to get JWT token
function makeRequest(options, body) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
                catch (e) { resolve({ status: res.statusCode, data: data.substring(0, 500) }); }
            });
        });
        req.on('error', e => reject(e));
        if (body) req.write(body);
        req.end();
    });
}

async function main() {
    // 1. Login
    console.log('=== LOGIN ===');
    const loginBody = JSON.stringify({ email: 'admin@grobatech.com', password: 'admin123' });
    const loginRes = await makeRequest({
        hostname: 'localhost', port: 3001, path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginBody) }
    }, loginBody);
    console.log('Status:', loginRes.status);

    const token = loginRes.data?.token;
    if (!token) {
        console.error('Falha no login:', loginRes.data);
        return;
    }
    console.log('Token OK:', token.substring(0, 30) + '...');

    // 2. Test Faturamento Metrics for 2025
    console.log('\n=== FATURAMENTO METRICS ?year=2025 ===');
    const fatRes = await makeRequest({
        hostname: 'localhost', port: 3001, path: '/api/faturamento/metrics?year=2025',
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + token }
    });
    console.log('Status:', fatRes.status);
    console.log('faturamentoAcumulado:', fatRes.data?.faturamentoAcumulado);
    const monthly = fatRes.data?.monthlyEvolution;
    if (monthly) {
        monthly.forEach(m => {
            if (m.receitaBruta > 0) console.log(`  Mês ${m.month}: R$ ${m.receitaBruta.toFixed(2)}`);
        });
    }

    // 3. Test Top Clients
    console.log('\n=== TOP CLIENTS ?year=2025 ===');
    const topRes = await makeRequest({
        hostname: 'localhost', port: 3001, path: '/api/faturamento/top-clients?year=2025',
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + token }
    });
    console.log('Status:', topRes.status);
    console.log('Top 5:', topRes.data?.top5?.length, 'clientes');
    topRes.data?.top5?.forEach(c => console.log(`  ${c.nome}: R$ ${c.total.toFixed(2)}`));

    // 4. Test Inadimplencia Overview
    console.log('\n=== INADIMPLENCIA OVERVIEW ?year=2025 ===');
    const inadRes = await makeRequest({
        hostname: 'localhost', port: 3001, path: '/api/inadimplencia/overview?year=2025',
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + token }
    });
    console.log('Status:', inadRes.status);
    console.log('Data:', JSON.stringify(inadRes.data, null, 2));

    // 5. Test Inadimplencia Evolution
    console.log('\n=== INADIMPLENCIA EVOLUTION ?year=2025 ===');
    const evoRes = await makeRequest({
        hostname: 'localhost', port: 3001, path: '/api/inadimplencia/evolution?year=2025',
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + token }
    });
    console.log('Status:', evoRes.status);
    console.log('Data:', JSON.stringify(evoRes.data, null, 2));
}

main().catch(console.error);
