import { getAPI } from '../src/services/contaAzulSyncService';

async function test() {
    const api = await getAPI();
    await api.tryRefreshToken();
    
    for (let page = 1; page <= 5; page++) {
        const data = await api.getContasAPagar({
            dataVencimentoInicio: '2026-01-01',
            dataVencimentoFim: '2026-12-31',
            pagina: page,
            tamanhoPagina: 50
        });
        
        const items = data?.itens || [];
        const multi = items.find((i: any) => (i.centros_de_custo?.length || 0) > 1);
        if (multi) {
            console.log('Multi CC:', JSON.stringify(multi.centros_de_custo, null, 2));
            break;
        }
    }
}
test().catch(console.error);
