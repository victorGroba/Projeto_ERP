import { PrismaClient } from '@prisma/client';
import { ContaAzulAPI } from './contaAzulApi';

const prisma = new PrismaClient();

async function getAPI(): Promise<ContaAzulAPI> {
    const [accessCfg, refreshCfg] = await Promise.all([
        prisma.appConfig.findUnique({ where: { key: 'access_token_rj' } }),
        prisma.appConfig.findUnique({ where: { key: 'refresh_token_rj' } }),
    ]);

    return new ContaAzulAPI(
        accessCfg?.value || process.env.CONTA_AZUL_ACCESS_TOKEN_RJ || '',
        refreshCfg?.value || process.env.CONTA_AZUL_REFRESH_TOKEN_RJ || '',
        process.env.CONTA_AZUL_CLIENT_ID_RJ || '',
        process.env.CONTA_AZUL_CLIENT_SECRET_RJ || '',
    );
}

async function persistTokens(api: ContaAzulAPI): Promise<void> {
    await Promise.all([
        prisma.appConfig.upsert({
            where: { key: 'access_token_rj' },
            update: { value: api.getAccessToken() },
            create: { key: 'access_token_rj', value: api.getAccessToken() },
        }),
        prisma.appConfig.upsert({
            where: { key: 'refresh_token_rj' },
            update: { value: api.getRefreshTokenValue() },
            create: { key: 'refresh_token_rj', value: api.getRefreshTokenValue() },
        }),
    ]);
}

// A API retorna apenas 'RECEBIDO' (pago) e 'EM_ABERTO' (aberto).
// Para EM_ABERTO, usamos a data de vencimento para separar A Vencer / Vencido.
// Bug corrigido: a versão anterior não reconhecia 'RECEBIDO', classificando títulos
// pagos como Vencido por causa da data passada — inflando o total de inadimplência.
function mapStatus(statusTraduzido: string, dataVencimento: Date): string {
    const s = (statusTraduzido || '').toUpperCase();
    if (s === 'RECEBIDO' || s === 'PAGO' || s === 'PAID') return 'Pago';
    // EM_ABERTO: A Vencer se prazo futuro, Vencido se prazo já passou
    return dataVencimento < new Date() ? 'Vencido' : 'A Vencer';
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function paginateAll(fetchFn: (page: number) => Promise<any>): Promise<any[]> {
    const allItems: any[] = [];
    let page = 1;
    let totalRegistros = Infinity;

    while (allItems.length < totalRegistros) {
        // Delay entre páginas para respeitar o rate limit da API (máx ~5 req/burst)
        if (page > 1) await sleep(300);

        const data = await fetchFn(page);
        const items = data?.itens || [];
        if (items.length === 0) break;

        if (page === 1) totalRegistros = data?.itens_totais ?? items.length;

        allItems.push(...items);
        if (allItems.length >= totalRegistros) break;

        page++;
        if (page % 50 === 0) {
            console.log(`[Sync] Paginando... página ${page}, ${allItems.length}/${totalRegistros}`);
        }
    }
    return allItems;
}

function dateStr(d: Date): string {
    return d.toISOString().split('T')[0];
}

// Converte data da API ("2026-01-01" ou ISO completo) para MEIO-DIA UTC.
// Evita o bug de fuso: meia-noite UTC vira dia anterior no Brasil (UTC-3),
// jogando despesas do dia 1º para o mês/ano errado nos controllers que usam getMonth() local.
function parseApiDate(s?: string | null): Date {
    if (!s) return new Date();
    const datePart = s.split('T')[0]; // pega só YYYY-MM-DD
    const [y, m, d] = datePart.split('-').map(Number);
    if (!y || !m || !d) return new Date(s);
    return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

// A API ignora tamanhoPagina e sempre retorna 10 itens por página.
// Usamos itens_totais para controlar a paginação corretamente.
async function syncDespesas(api: ContaAzulAPI, inicio: string, fim: string, replace: boolean): Promise<number> {
    const items = await paginateAll(page =>
        api.getContasAPagar({ dataVencimentoInicio: inicio, dataVencimentoFim: fim, pagina: page, tamanhoPagina: 10 })
    );

    if (items.length === 0) {
        console.log('[Sync] Nenhuma despesa retornada pela API.');
        return 0;
    }

    const records = items
        .map((item: any) => ({
            tipo: 'DESPESA',
            descricao: item.descricao || 'Sem descrição',
            categoria: item.categorias?.[0]?.nome || 'Sem Categoria',
            centroDeCusto: item.centros_de_custo?.[0]?.nome || 'Geral',
            contaBancaria: item.conta_financeira?.nome || 'N/A',
            dataPagamento: parseApiDate(item.data_vencimento || item.data_competencia),
            valor: Math.abs(item.total || item.valor || 0),
            fornecedor: item.fornecedor?.nome || 'Diverso',
        }))
        .filter((r: any) => r.valor > 0);

    if (replace) {
        await prisma.lancamento.deleteMany({ where: { tipo: 'DESPESA' } });
    } else {
        // Incremental: remove só o período buscado antes de re-inserir
        await prisma.lancamento.deleteMany({
            where: { tipo: 'DESPESA', dataPagamento: { gte: new Date(inicio), lte: new Date(fim) } }
        });
    }
    if (records.length > 0) await prisma.lancamento.createMany({ data: records });
    return records.length;
}

async function syncReceitas(api: ContaAzulAPI, inicio: string, fim: string, replace: boolean): Promise<number> {
    const items = await paginateAll(page =>
        api.getContasAReceber({ dataVencimentoInicio: inicio, dataVencimentoFim: fim, pagina: page, tamanhoPagina: 10 })
    );

    if (items.length === 0) {
        console.log('[Sync] Nenhuma receita retornada pela API.');
        return 0;
    }

    const records = items
        .map((item: any) => {
            const dataVenc = parseApiDate(item.data_vencimento);
            return {
                cliente: item.cliente?.nome || 'Sem cliente',
                grupo: item.centros_de_custo?.[0]?.nome || 'Sem Grupo',
                dataCompetencia: item.data_competencia ? parseApiDate(item.data_competencia) : null,
                dataVencimento: dataVenc,
                valor: Math.abs(
                    item.status_traduzido === 'RECEBIDO'
                        ? (item.total ?? 0)
                        : (item.nao_pago ?? item.total ?? 0)
                ),
                status: mapStatus(item.status_traduzido || '', dataVenc),
                descricao: item.descricao || '',
                numeroNotaFiscal: item.numero_nota_fiscal || '',
            };
        })
        .filter((r: any) => r.valor > 0);

    if (replace) {
        await prisma.contaReceber.deleteMany();
    } else {
        await prisma.contaReceber.deleteMany({
            where: { dataVencimento: { gte: new Date(inicio), lte: new Date(fim) } }
        });
    }
    if (records.length > 0) await prisma.contaReceber.createMany({ data: records });
    return records.length;
}

async function syncSaldosBancarios(api: ContaAzulAPI): Promise<number> {
    const data = await api.getContasFinanceiras();
    const items = data?.itens || [];

    if (items.length === 0) {
        console.log('[Sync] Nenhuma conta financeira retornada pela API.');
        return 0;
    }

    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    await prisma.saldoBancario.deleteMany({ where: { data: { gte: inicioMes } } });

    const records = items.map((item: any) => ({
        instituicao: item.nome || item.descricao || 'Conta',
        saldo: item.saldo ?? 0,
        data: hoje,
    }));

    await prisma.saldoBancario.createMany({ data: records });
    return records.length;
}

// Modo incremental: últimos 60 dias + próximos 90 (rápido, ~200-400 registros)
export async function runIncrementalSync(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
        console.log('[Sync] ⚡ Iniciando sincronização incremental...');
        const api = await getAPI();
        await api.tryRefreshToken();

        const hoje = new Date();
        const inicio = dateStr(new Date(hoje.getTime() - 60 * 24 * 60 * 60 * 1000));  // 60 dias atrás
        const fim    = dateStr(new Date(hoje.getTime() + 90 * 24 * 60 * 60 * 1000));  // 90 dias à frente

        const [despesas, receitas, saldos] = await Promise.all([
            syncDespesas(api, inicio, fim, false),
            syncReceitas(api, inicio, fim, false),
            syncSaldosBancarios(api),
        ]);

        await persistTokens(api);
        const details = { despesas, receitas, saldos, modo: 'incremental', janela: `${inicio} → ${fim}` };
        console.log('[Sync] ✅ Incremental concluído:', details);
        return { success: true, message: 'Sincronização incremental concluída!', details };
    } catch (error: any) {
        console.error('[Sync] ❌ Falha:', error.message);
        return { success: false, message: error.message || 'Erro desconhecido' };
    }
}

// Modo full: 2 anos completos (histórico para os relatórios comparativos — pode levar alguns minutos)
export async function runFullSync(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
        console.log('[Sync] 🔄 Iniciando sincronização completa (2 anos)...');
        const api = await getAPI();
        await api.tryRefreshToken();

        const hoje = new Date();
        const inicio = `${hoje.getFullYear() - 1}-01-01`;   // início do ano anterior
        const fim    = `${hoje.getFullYear() + 1}-12-31`;   // fim do próximo ano

        const [despesas, receitas, saldos] = await Promise.all([
            syncDespesas(api, inicio, fim, true),
            syncReceitas(api, inicio, fim, true),
            syncSaldosBancarios(api),
        ]);

        await persistTokens(api);
        const details = { despesas, receitas, saldos, modo: 'full', janela: `${inicio} → ${fim}` };
        console.log('[Sync] ✅ Full concluído:', details);
        return { success: true, message: 'Sincronização completa concluída!', details };
    } catch (error: any) {
        console.error('[Sync] ❌ Falha:', error.message);
        return { success: false, message: error.message || 'Erro desconhecido' };
    }
}
