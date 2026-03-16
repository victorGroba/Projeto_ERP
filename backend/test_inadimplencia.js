const axios = require('axios');
const jwt = require('jsonwebtoken');

async function test() {
    const token = jwt.sign({ id: '1', role: 'ADMIN' }, 'chave_secreta_super_segura_aqui_12345', { expiresIn: '1h' });
    const config = { headers: { Authorization: 'Bearer ' + token } };
    try {
        console.log('--- Calling ETL Sync ---');
        await axios.post('http://localhost:3001/api/etl/sync', {}, config);
        console.log('--- Calling Overview ---');
        const r1 = await axios.get('http://localhost:3001/api/inadimplencia/overview?year=2026', config);
        console.log('1. Overview:', r1.data);

        console.log('--- Calling Composition ---');
        const r2 = await axios.get('http://localhost:3001/api/inadimplencia/composition?year=2026', config);
        console.log('2. Composition:', r2.data);

        console.log('--- Calling Evolution ---');
        const r3 = await axios.get('http://localhost:3001/api/inadimplencia/evolution?year=2026', config);
        console.log('3. Evolution Data Points:', r3.data.evolution.length);

    } catch (err) {
        if (err.response) {
            console.error('ERROR ON API STATUS:', err.response.status);
            console.error('ERROR ON API DATA:', err.response.data);
        } else {
            console.error('ERROR:', err.message);
        }
    }
}
test();
