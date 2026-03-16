import axios from 'axios';

// Valores literais evitam problemas de parsing com .env
const CLIENT_ID = '2t9tsul3nbcg7eqlfoj3esllqa';
const CLIENT_SECRET = '1okp3gcafs2jm4as6ltgi2tc9lvbihabo8ur239pv54eqs5naf65';
const REDIRECT_URI = 'https://google.com';

/**
 * Script auxiliar para ajudar na autorização Oauth2.0 da Conta Azul
 * Passo 1. O Gestor acessa a URL gerada abaixo.
 * Passo 2. A Conta Azul irá redirecionar para https://contaazul.com/?code=123XYZ
 * Passo 3. Pegaremos esse 'code' e chamaremos getAccessToken()
 */

const getAuthURL = () => {
    const state = Math.random().toString(36).substring(7);
    const url = `https://api.contaazul.com/auth/authorize?redirect_uri=${encodeURIComponent(REDIRECT_URI)}&client_id=${CLIENT_ID}&scope=sales&state=${state}`;
    console.log('\n--- PASSO 1: AUTORIZAÇÃO OAUTH2 ---');
    console.log('1. Tente abrir esta nova URL limpa em uma Guia Anonima (para evitar caches de login anterior):');
    console.log('\n' + url + '\n');
    console.log('2. Faça o login. Olhe para a URL dessa página no seu navegador. Ela terá um "?code=..." no final.');
    console.log('3. Copie este valor de CODE longo e rode a segunda metade deste script (descomentando a linha 44) passando ele por parâmetro!');
};

const getAccessToken = async (code: string) => {
    try {
        const tokenB64 = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
        const response = await axios.post('https://api.contaazul.com/oauth2/token', null, {
            params: {
                grant_type: 'authorization_code',
                redirect_uri: REDIRECT_URI,
                code: code
            },
            headers: {
                'Authorization': `Basic ${tokenB64}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('\n✅ SUCESSO! SEUS TOKENS:');
        console.log(`CONTA_AZUL_ACCESS_TOKEN_RJ="${response.data.access_token}"`);
        console.log(`CONTA_AZUL_REFRESH_TOKEN_RJ="${response.data.refresh_token}"`);

    } catch (error: any) {
        console.error('❌ ERRO AO OBTER TOKEN:', error.response?.data || error.message);
    }
};

// ======================
// USO do Script:
// ======================

getAuthURL();
// getAccessToken('seu_codigo_aqui');
