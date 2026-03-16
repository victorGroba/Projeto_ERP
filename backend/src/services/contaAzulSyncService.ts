import { PrismaClient } from '@prisma/client';
import { ContaAzulAPI } from './contaAzulApi';

const prisma = new PrismaClient();

export class ContaAzulSyncService {

    /**
     * Cria a instância da API com credenciais do banco (prioridade) ou .env
     */
    private static async createAPI(nomeFilial: string = 'Rio de Janeiro'): Promise<ContaAzulAPI> {
        const account = await prisma.gestaoContas.findFirst({ where: { nomeFilial } });

        return new ContaAzulAPI(
            account?.accessToken || process.env.CONTA_AZUL_ACCESS_TOKEN_RJ || '',
            account?.refreshToken || process.env.CONTA_AZUL_REFRESH_TOKEN_RJ || '',
            account?.clientId || process.env.CONTA_AZUL_CLIENT_ID_RJ || '',
            account?.clientSecret || process.env.CONTA_AZUL_CLIENT_SECRET_RJ || ''
        );
    }

    /**
     * Garante que as contas de gestão existam no banco
     */
    static async initAccounts() {
        const rj = await prisma.gestaoContas.findFirst({ where: { nomeFilial: 'Rio de Janeiro' } });
        if (!rj) {
            await prisma.gestaoContas.create({
                data: {
                    nomeFilial: 'Rio de Janeiro',
                    clientId: process.env.CONTA_AZUL_CLIENT_ID_RJ || '',
                    clientSecret: process.env.CONTA_AZUL_CLIENT_SECRET_RJ || '',
                    accessToken: process.env.CONTA_AZUL_ACCESS_TOKEN_RJ || '',
                    refreshToken: process.env.CONTA_AZUL_REFRESH_TOKEN_RJ || '',
                }
            });
        }
        const sp = await prisma.gestaoContas.findFirst({ where: { nomeFilial: 'São Paulo' } });
        if (!sp) {
            await prisma.gestaoContas.create({
                data: {
                    nomeFilial: 'São Paulo',
                    clientId: process.env.CONTA_AZUL_CLIENT_ID_SP || '',
                    clientSecret: process.env.CONTA_AZUL_CLIENT_SECRET_SP || '',
                    accessToken: process.env.CONTA_AZUL_ACCESS_TOKEN_SP || '',
                    refreshToken: process.env.CONTA_AZUL_REFRESH_TOKEN_SP || '',
                }
            });
        }
    }

    /**
     * Sincroniza clientes (Pessoas) da API v2
     * Endpoint: GET /v1/pessoa
     */
    static async syncClients() {
        const accountRJ = await prisma.gestaoContas.findFirst({ where: { nomeFilial: 'Rio de Janeiro' } });
        if (!accountRJ) return;

        const api = await this.createAPI();
        await api.tryRefreshToken();

        let page = 1;
        let totalSynced = 0;

        while (true) {
            const data = await api.getPessoas({ pagina: page, tamanhoPagina: 200 });
            if (!data || !data.itens || data.itens.length === 0) break;

            for (const pessoa of data.itens) {
                const clienteId = pessoa.uuid || pessoa.uuid_legado || String(pessoa.id_legado);
                await prisma.deParaClientes.upsert({
                    where: { clienteIdContaAzul: clienteId },
                    update: { nomeOriginal: pessoa.nome || 'Sem nome' },
                    create: {
                        clienteIdContaAzul: clienteId,
                        nomeOriginal: pessoa.nome || 'Sem nome',
                        segmentoTipo: 'PRI', // Default, pode ser alterado manualmente depois
                    }
                });
                totalSynced++;
            }

            if (data.itens.length < 200) break;
            page++;
        }

        // Salva token atualizado
        await prisma.gestaoContas.update({
            where: { id: accountRJ.id },
            data: {
                accessToken: api.getAccessToken(),
                refreshToken: api.getRefreshTokenValue()
            }
        });

        console.log(`[ETL] ✅ ${totalSynced} clientes sincronizados da API v2.`);
    }

    /**
     * Sincroniza vendas da API v2
     * Endpoint: GET /v1/venda/busca
     */
    static async syncInvoices() {
        const accountRJ = await prisma.gestaoContas.findFirst({ where: { nomeFilial: 'Rio de Janeiro' } });
        if (!accountRJ) return;

        const api = await this.createAPI();
        await api.tryRefreshToken();

        let page = 1;
        let totalSynced = 0;
        const allSales: any[] = [];
        const DATA_CORTE = '2025-01-01';

        // A API de vendas da Conta Azul ignora todos os filtros de data e tamanhoPagina.
        // Retorna sempre 10 itens por página em ordem cronológica.
        // Precisamos paginar por TODAS as vendas e filtrar localmente.
        console.log('[ETL] Buscando todas as vendas da API (pode demorar alguns minutos)...');
        while (true) {
            const data = await api.getVendas({
                pagina: page,
            });
            const items = data?.itens || (Array.isArray(data) ? data : []);
            if (!items || items.length === 0) break;

            // Filtra vendas com data >= 2025-01-01
            for (const item of items) {
                if (item.data && item.data >= DATA_CORTE) {
                    allSales.push(item);
                }
            }

            // Se a última venda da página já passou de 2026, podemos parar
            const lastDate = items[items.length - 1]?.data;
            if (lastDate && lastDate > '2026-12-31') break;

            if (page % 100 === 0) {
                const dates = items.map((v: any) => v.data).filter(Boolean);
                console.log(`[ETL] Paginando vendas... página ${page}, datas: ${dates[0]} a ${dates[dates.length - 1]}, encontradas até agora: ${allSales.length}`);
            }
            page++;
        }
        console.log(`[ETL] Paginação concluída: ${page} páginas percorridas, ${allSales.length} vendas de 2025+ encontradas.`);

        if (allSales.length === 0) {
            console.warn('[ETL] Nenhuma venda retornada pela API v2.');
            return;
        }

        // Limpa vendas antigas para re-sincronizar
        await prisma.invoice.deleteMany({});

        for (const sale of allSales) {
            // Campos reais da API v2: sale.cliente.id, sale.total, sale.numero, sale.data
            const clienteId = sale.cliente?.id;
            const invoiceNumber = String(sale.numero || sale.id_legado || sale.id);
            const issueDate = new Date(sale.data || sale.criado_em);
            const grossValue = sale.total || 0;

            // Garante que o cliente existe no DeParaClientes
            if (clienteId) {
                const existingClient = await prisma.deParaClientes.findUnique({
                    where: { clienteIdContaAzul: String(clienteId) }
                });
                if (!existingClient) {
                    await prisma.deParaClientes.create({
                        data: {
                            clienteIdContaAzul: String(clienteId),
                            nomeOriginal: sale.cliente?.nome || 'Cliente API',
                            segmentoTipo: 'PRI',
                        }
                    });
                }
            }

            try {
                await prisma.invoice.create({
                    data: {
                        invoiceNumber,
                        issueDate,
                        grossValue,
                        clientId: String(clienteId || 'desconhecido'),
                        accountId: accountRJ.id
                    }
                });
                totalSynced++;
            } catch (e: any) {
                // Ignora duplicatas
                if (!e.message?.includes('Unique constraint')) {
                    console.warn(`[ETL] Erro ao salvar venda ${invoiceNumber}:`, e.message);
                }
            }
        }

        await prisma.gestaoContas.update({
            where: { id: accountRJ.id },
            data: {
                accessToken: api.getAccessToken(),
                refreshToken: api.getRefreshTokenValue()
            }
        });

        console.log(`[ETL] ✅ ${totalSynced} vendas/notas fiscais sincronizadas da API v2.`);
    }

    /**
     * Sincroniza Contas a Receber (Receitas) da API v2
     * Endpoint: GET /v1/financeiro/eventos-financeiros/contas-a-receber/buscar
     */
    static async syncAccountsReceivable() {
        const accountRJ = await prisma.gestaoContas.findFirst({ where: { nomeFilial: 'Rio de Janeiro' } });
        if (!accountRJ) return;

        const api = await this.createAPI();
        await api.tryRefreshToken();

        let page = 1;
        let totalSynced = 0;
        const allItems: any[] = [];

        while (true) {
            const data = await api.getContasAReceber({
                dataVencimentoInicio: '2022-01-01',
                dataVencimentoFim: '2026-12-31',
                pagina: page,
                tamanhoPagina: 200
            });
            const items = data?.itens || (Array.isArray(data) ? data : []);
            if (!items || items.length === 0) break;
            allItems.push(...items);

            if (page % 50 === 0) console.log(`[ETL] Paginando contas a receber... página ${page}, total até agora: ${allItems.length}`);
            page++;
        }

        if (allItems.length === 0) {
            console.warn('[ETL] Nenhuma conta a receber retornada pela API v2.');
            return;
        }

        await prisma.accountsReceivable.deleteMany({});

        for (const item of allItems) {
            // Campos reais da API v2: item.cliente.id, item.total, item.data_vencimento
            const clienteId = item.cliente?.id;
            const dueDate = new Date(item.data_vencimento || item.data_competencia);
            const value = item.total || item.nao_pago || 0;
            const statusRaw = item.status_traduzido || item.status;
            const status = statusRaw === 'PAGO' ? 'Pago' : (statusRaw === 'VENCIDO' ? 'Vencido' : 'A Vencer');

            // Garante que o cliente existe
            if (clienteId) {
                const exists = await prisma.deParaClientes.findUnique({
                    where: { clienteIdContaAzul: String(clienteId) }
                });
                if (!exists) {
                    await prisma.deParaClientes.create({
                        data: {
                            clienteIdContaAzul: String(clienteId),
                            nomeOriginal: item.cliente?.nome || 'Cliente Receita',
                            segmentoTipo: 'PRI',
                        }
                    });
                }
            }

            try {
                await prisma.accountsReceivable.create({
                    data: {
                        dueDate,
                        value,
                        status,
                        clientId: String(clienteId || 'desconhecido'),
                        accountId: accountRJ.id
                    }
                });
                totalSynced++;
            } catch (e: any) {
                console.warn('[ETL] Erro ao salvar receita:', e.message);
            }
        }

        console.log(`[ETL] ✅ ${totalSynced} contas a receber sincronizadas da API v2.`);
    }

    /**
     * Sincroniza Contas a Pagar (Despesas) da API v2
     * Endpoint: GET /v1/financeiro/eventos-financeiros/contas-a-pagar/buscar
     */
    static async syncAccountsPayable() {
        const accountRJ = await prisma.gestaoContas.findFirst({ where: { nomeFilial: 'Rio de Janeiro' } });
        if (!accountRJ) return;

        const api = await this.createAPI();
        await api.tryRefreshToken();

        let page = 1;
        let totalSynced = 0;
        const allItems: any[] = [];

        while (true) {
            const data = await api.getContasAPagar({
                dataVencimentoInicio: '2022-01-01',
                dataVencimentoFim: '2026-12-31',
                pagina: page,
                tamanhoPagina: 200
            });
            const items = data?.itens || (Array.isArray(data) ? data : []);
            if (!items || items.length === 0) break;
            allItems.push(...items);

            if (page % 50 === 0) console.log(`[ETL] Paginando contas a pagar... página ${page}, total até agora: ${allItems.length}`);
            page++;
        }

        if (allItems.length === 0) {
            console.warn('[ETL] Nenhuma conta a pagar retornada pela API v2.');
            return;
        }

        await prisma.accountsPayable.deleteMany({});

        for (const item of allItems) {
            const dueDate = new Date(item.data_vencimento || item.data_competencia);
            const value = item.valor || item.valor_parcela || 0;
            const status = item.status === 'PAGO' ? 'PAGO' : 'A_PAGAR';
            const description = item.descricao || item.observacao || 'Sem descrição';

            // Mapeia categoria e centro de custo se existirem
            let categoryId: string | null = null;
            let costCenterId: string | null = null;

            if (item.id_categoria || item.nome_categoria) {
                const catName = item.nome_categoria || item.id_categoria;
                const cat = await prisma.category.upsert({
                    where: { name: catName },
                    update: {},
                    create: { name: catName }
                });
                categoryId = cat.id;
            }

            if (item.id_centro_de_custo || item.nome_centro_de_custo) {
                const ccName = item.nome_centro_de_custo || item.id_centro_de_custo;
                const cc = await prisma.costCenter.upsert({
                    where: { name: ccName },
                    update: {},
                    create: { name: ccName }
                });
                costCenterId = cc.id;
            }

            try {
                await prisma.accountsPayable.create({
                    data: {
                        dueDate,
                        value,
                        status,
                        description,
                        categoryId,
                        costCenterId,
                        accountId: accountRJ.id,
                        isTransfer: false
                    }
                });
                totalSynced++;
            } catch (e: any) {
                console.warn('[ETL] Erro ao salvar despesa:', e.message);
            }
        }

        // Salva token atualizado
        await prisma.gestaoContas.update({
            where: { id: accountRJ.id },
            data: {
                accessToken: api.getAccessToken(),
                refreshToken: api.getRefreshTokenValue()
            }
        });

        console.log(`[ETL] ✅ ${totalSynced} contas a pagar sincronizadas da API v2.`);
    }

    /**
     * Sincroniza Categorias financeiras da API v2
     * Endpoint: GET /v1/categorias
     */
    static async syncCategories() {
        const api = await this.createAPI();
        await api.tryRefreshToken();

        const data = await api.getCategorias();
        if (!data || !data.itens) {
            console.warn('[ETL] Nenhuma categoria retornada.');
            return;
        }

        let synced = 0;
        for (const cat of data.itens) {
            if (cat.tipo === 'DESPESA') {
                await prisma.category.upsert({
                    where: { name: cat.nome },
                    update: {},
                    create: { name: cat.nome }
                });
                synced++;
            }
        }
        console.log(`[ETL] ✅ ${synced} categorias de despesa sincronizadas.`);
    }

    /**
     * Orquestrador do ETL completo
     */
    static async runFullSync() {
        try {
            console.log('[ETL] 🚀 Iniciando sincronização completa via API v2 da Conta Azul...');

            await this.initAccounts();
            console.log('[ETL] ✅ Contas inicializadas.');

            await this.syncCategories();
            await this.syncClients();
            await this.syncInvoices();
            await this.syncAccountsReceivable();
            await this.syncAccountsPayable();

            console.log('[ETL] 🎉 ETL completo via API Oficial da Conta Azul (v2)!');
            return { success: true, message: 'ETL concluído com sucesso via API Oficial v2 da Conta Azul.' };
        } catch (error: any) {
            console.error('[ETL Error]', error);
            return { success: false, error: String(error.message || error) };
        }
    }
}
