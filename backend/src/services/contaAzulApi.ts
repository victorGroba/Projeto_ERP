import axios from 'axios';

/**
 * Cliente HTTP para chamadas à API v2 da Conta Azul.
 * Base URL: https://api-v2.contaazul.com
 * Suporta auto-refresh de tokens via OAuth2 Cognito.
 */
export class ContaAzulAPI {
    private baseURL = 'https://api-v2.contaazul.com/v1';
    private authURL = 'https://auth.contaazul.com';
    private accessToken: string;
    private refreshToken: string;
    private clientId: string;
    private clientSecret: string;

    constructor(accessToken: string, refreshToken: string = '', clientId: string = '', clientSecret: string = '') {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.clientId = clientId;
        this.clientSecret = clientSecret;
    }

    private getHeaders() {
        return {
            'Authorization': `Bearer ${this.accessToken}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };
    }

    /**
     * Tenta renovar o Access Token usando o Refresh Token
     */
    async tryRefreshToken(): Promise<boolean> {
        if (!this.refreshToken || !this.clientId || !this.clientSecret) {
            console.warn('[ContaAzulAPI] Sem credenciais completas para refresh.');
            return false;
        }
        try {
            const basicAuth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
            const params = new URLSearchParams();
            params.append('grant_type', 'refresh_token');
            params.append('refresh_token', this.refreshToken);

            const response = await axios.post(`${this.authURL}/oauth2/token`, params.toString(), {
                headers: {
                    'Authorization': `Basic ${basicAuth}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            if (response.data.access_token) {
                this.accessToken = response.data.access_token;
                if (response.data.refresh_token) {
                    this.refreshToken = response.data.refresh_token;
                }
                console.log('[ContaAzulAPI] ✅ Token renovado com sucesso!');
                return true;
            }
            return false;
        } catch (error: any) {
            console.error('[ContaAzulAPI] ❌ Falha ao renovar token:', error.response?.data || error.message);
            return false;
        }
    }

    getAccessToken() { return this.accessToken; }
    getRefreshTokenValue() { return this.refreshToken; }

    /**
     * GET com retry automático (refresh se 401)
     */
    private async getWithRetry(url: string): Promise<any> {
        try {
            const response = await axios.get(url, { headers: this.getHeaders() });
            return response.data;
        } catch (error: any) {
            if (error.response?.status === 401) {
                console.log('[ContaAzulAPI] Token expirado, tentando refresh...');
                const refreshed = await this.tryRefreshToken();
                if (refreshed) {
                    const retryResponse = await axios.get(url, { headers: this.getHeaders() });
                    return retryResponse.data;
                }
            }
            console.warn('[ContaAzulAPI] Erro:', url, error.response?.status, error.response?.data?.error || error.message);
            return null;
        }
    }

    // ============================================
    // FINANCEIRO
    // ============================================

    /** Categorias financeiras (Receita/Despesa) */
    async getCategorias(page: number = 1, size: number = 200): Promise<any> {
        return this.getWithRetry(`${this.baseURL}/categorias?pagina=${page}&tamanhoPagina=${size}`);
    }

    /** Categorias DRE */
    async getCategoriasDRE(): Promise<any> {
        return this.getWithRetry(`${this.baseURL}/financeiro/categorias-dre`);
    }

    /** Centros de custo */
    async getCentrosDeCusto(page: number = 1, size: number = 200): Promise<any> {
        return this.getWithRetry(`${this.baseURL}/centro-de-custo?pagina=${page}&tamanhoPagina=${size}`);
    }

    /** Contas financeiras (bancárias) */
    async getContasFinanceiras(): Promise<any> {
        return this.getWithRetry(`${this.baseURL}/conta-financeira`);
    }

    /** Contas a RECEBER (receitas) - com filtros */
    async getContasAReceber(params: {
        dataVencimentoInicio?: string;
        dataVencimentoFim?: string;
        dataCompetenciaInicio?: string;
        dataCompetenciaFim?: string;
        pagina?: number;
        tamanhoPagina?: number;
    } = {}): Promise<any> {
        const queryParams = new URLSearchParams();
        if (params.dataVencimentoInicio) queryParams.append('data_vencimento_de', params.dataVencimentoInicio);
        if (params.dataVencimentoFim) queryParams.append('data_vencimento_ate', params.dataVencimentoFim);
        if (params.dataCompetenciaInicio) queryParams.append('data_competencia_de', params.dataCompetenciaInicio);
        if (params.dataCompetenciaFim) queryParams.append('data_competencia_ate', params.dataCompetenciaFim);
        queryParams.append('pagina', String(params.pagina || 1));
        queryParams.append('tamanhoPagina', String(params.tamanhoPagina || 200));

        return this.getWithRetry(
            `${this.baseURL}/financeiro/eventos-financeiros/contas-a-receber/buscar?${queryParams.toString()}`
        );
    }

    /** Contas a PAGAR (despesas) - com filtros */
    async getContasAPagar(params: {
        dataVencimentoInicio?: string;
        dataVencimentoFim?: string;
        dataCompetenciaInicio?: string;
        dataCompetenciaFim?: string;
        pagina?: number;
        tamanhoPagina?: number;
    } = {}): Promise<any> {
        const queryParams = new URLSearchParams();
        if (params.dataVencimentoInicio) queryParams.append('data_vencimento_de', params.dataVencimentoInicio);
        if (params.dataVencimentoFim) queryParams.append('data_vencimento_ate', params.dataVencimentoFim);
        if (params.dataCompetenciaInicio) queryParams.append('data_competencia_de', params.dataCompetenciaInicio);
        if (params.dataCompetenciaFim) queryParams.append('data_competencia_ate', params.dataCompetenciaFim);
        queryParams.append('pagina', String(params.pagina || 1));
        queryParams.append('tamanhoPagina', String(params.tamanhoPagina || 200));

        return this.getWithRetry(
            `${this.baseURL}/financeiro/eventos-financeiros/contas-a-pagar/buscar?${queryParams.toString()}`
        );
    }

    // ============================================
    // VENDAS
    // ============================================

    /** Buscar vendas com filtros */
    async getVendas(params: {
        dataInicio?: string;
        dataFim?: string;
        pagina?: number;
        tamanhoPagina?: number;
    } = {}): Promise<any> {
        const queryParams = new URLSearchParams();
        if (params.dataInicio) queryParams.append('emissao_de', params.dataInicio);
        if (params.dataFim) queryParams.append('emissao_ate', params.dataFim);
        queryParams.append('pagina', String(params.pagina || 1));
        queryParams.append('tamanhoPagina', String(params.tamanhoPagina || 200));

        return this.getWithRetry(`${this.baseURL}/venda/busca?${queryParams.toString()}`);
    }

    /** Detalhes de uma venda por ID */
    async getVendaById(id: string): Promise<any> {
        return this.getWithRetry(`${this.baseURL}/venda/${id}`);
    }

    /** Vendedores */
    async getVendedores(): Promise<any> {
        return this.getWithRetry(`${this.baseURL}/venda/vendedores`);
    }

    // ============================================
    // PESSOAS (Clientes/Fornecedores)
    // ============================================

    /** Buscar pessoas com filtros */
    async getPessoas(params: {
        pagina?: number;
        tamanhoPagina?: number;
        busca?: string;
    } = {}): Promise<any> {
        const queryParams = new URLSearchParams();
        queryParams.append('pagina', String(params.pagina || 1));
        queryParams.append('tamanhoPagina', String(params.tamanhoPagina || 200));
        if (params.busca) queryParams.append('busca', params.busca);

        return this.getWithRetry(`${this.baseURL}/pessoa?${queryParams.toString()}`);
    }

    // ============================================
    // NOTAS FISCAIS
    // ============================================

    /** Buscar notas fiscais */
    async getNotasFiscais(params: {
        tipo?: string;
        pagina?: number;
        tamanhoPagina?: number;
    } = {}): Promise<any> {
        const queryParams = new URLSearchParams();
        if (params.tipo) queryParams.append('tipo', params.tipo);
        queryParams.append('pagina', String(params.pagina || 1));
        queryParams.append('tamanhoPagina', String(params.tamanhoPagina || 200));

        return this.getWithRetry(`${this.baseURL}/notas-fiscais?${queryParams.toString()}`);
    }
}
