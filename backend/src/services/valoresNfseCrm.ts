/** Valores de fontes distintas nunca são substituídos por cálculo de alíquota. */
export function lerLiquidoExplicito(row: Record<string, string>): number | null {
    const campos = ['valor_liquido_da_nota_fiscal', 'valor_liquido_da_nota_fiscal_eletronica', 'valor_liquido_nfs_e', 'valor_liquido_da_nfs_e', 'valor_liquido_da_nfse', 'valor_liquido_da_nota', 'valor_liquido_nfse', 'valor_liquido'];
    const valores = campos.filter(c => row[c] != null && String(row[c]).trim() !== '').map(c => {
        const raw = String(row[c]).trim().replace(/R\$\s?/gi, '').replace(/\s/g, '');
        const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
        if (!/^[+]?\d+(?:\.\d+)?$/.test(normalized)) throw new Error(`Valor líquido inválido na coluna ${c}`);
        const n = Number(normalized);
        if (!Number.isFinite(n) || n < 0) throw new Error(`Valor líquido inválido na coluna ${c}`);
        return Math.round(n * 100) / 100;
    });
    if (!valores.length) return null;
    if (valores.some(v => v !== valores[0])) throw new Error('Colunas de valor líquido divergentes no arquivo; confira o layout');
    return valores[0];
}
export const numeroFiscal = (n: string | number) => String(n).replace(/^0+/, '');
export const documentoFiscal = (n: string) => n.replace(/\D/g, '');
export function valorApiParaNota(csv: { numero: string; clienteDocumento: string }, api?: { numero: string; clienteDocumento: string; status: string; valorLiquido: number }): number | null {
    if (!api || !['EMITIDA', 'CORRIGIDA_SUCESSO'].includes(api.status) || numeroFiscal(csv.numero) !== numeroFiscal(api.numero) || documentoFiscal(csv.clienteDocumento) !== documentoFiscal(api.clienteDocumento)) return null;
    return Number.isFinite(api.valorLiquido) && api.valorLiquido >= 0 ? api.valorLiquido : null;
}
