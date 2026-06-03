import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const CLIENT_ID = process.env.CONTA_AZUL_CLIENT_ID_RJ!;
const CLIENT_SECRET = process.env.CONTA_AZUL_CLIENT_SECRET_RJ!;

// Para o app de desenvolvimento, a Conta Azul usa https://contaazul.com como redirect fixo.
// Em produção, trocar pela URL real do servidor (ex: https://seudominio.com/api/auth/callback).
const REDIRECT_URI = 'https://contaazul.com';
const AUTH_BASE = 'https://auth.contaazul.com';
const SCOPE = 'openid profile aws.cognito.signin.user.admin';

const getAuthURL = () => {
    const state = Math.random().toString(36).substring(7);
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        state,
        scope: SCOPE,
    });
    const url = `${AUTH_BASE}/login?${params.toString()}`;
    console.log('\n=== PASSO 1: AUTORIZAÇÃO OAuth 2.0 (API v2) ===');
    console.log('\n1. Abra esta URL em uma aba anônima:');
    console.log('\n' + url + '\n');
    console.log('2. Faça login com as credenciais da conta de teste:');
    console.log('   Usuário: dffa460d-eabc-480a-a1e1-ae41f6479a79@devportal.com');
    console.log('   Senha:   Cdffa460d-eabc-480a-a1e1-ae41f6479a79');
    console.log('\n3. Você será redirecionado para https://contaazul.com?code=XXXX');
    console.log('   Copie o valor do parâmetro "code" da URL e rode:');
    console.log('   npx ts-node scripts/oauthConsent.ts exchange SEU_CODE_AQUI\n');
};

const exchangeCode = async (code: string) => {
    try {
        const basicAuth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
        const params = new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: REDIRECT_URI,
        });

        const response = await axios.post(`${AUTH_BASE}/oauth2/token`, params.toString(), {
            headers: {
                Authorization: `Basic ${basicAuth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        console.log('\n✅ TOKENS OBTIDOS COM SUCESSO!');
        console.log('\nCole estas linhas no seu .env:\n');
        console.log(`CONTA_AZUL_ACCESS_TOKEN_RJ="${response.data.access_token}"`);
        console.log(`CONTA_AZUL_REFRESH_TOKEN_RJ="${response.data.refresh_token}"`);
    } catch (error: any) {
        console.error('\n❌ Erro ao trocar o código:', error.response?.data || error.message);
    }
};

const refreshToken = async () => {
    const currentRefresh = process.env.CONTA_AZUL_REFRESH_TOKEN_RJ;
    if (!currentRefresh) {
        console.error('❌ CONTA_AZUL_REFRESH_TOKEN_RJ não está definido no .env');
        process.exit(1);
    }
    try {
        const basicAuth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
        const params = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: currentRefresh,
        });

        const response = await axios.post(`${AUTH_BASE}/oauth2/token`, params.toString(), {
            headers: {
                Authorization: `Basic ${basicAuth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        console.log('\n✅ TOKEN RENOVADO COM SUCESSO!');
        console.log('\nCole estas linhas no seu .env:\n');
        console.log(`CONTA_AZUL_ACCESS_TOKEN_RJ="${response.data.access_token}"`);
        if (response.data.refresh_token) {
            console.log(`CONTA_AZUL_REFRESH_TOKEN_RJ="${response.data.refresh_token}"`);
        }
    } catch (error: any) {
        console.error('\n❌ Erro ao renovar token:', error.response?.data || error.message);
    }
};

// CLI: npx ts-node scripts/oauthConsent.ts [exchange <code> | refresh | (sem args = gera URL)]
const [,, command, arg] = process.argv;
if (command === 'exchange' && arg) {
    exchangeCode(arg);
} else if (command === 'refresh') {
    refreshToken();
} else {
    getAuthURL();
}
