// Distribuição de uma parcela paga entre os pares categoria × centro de custo
// do rateio do evento financeiro (Conta Azul).
//
// A lista /contas-a-pagar/buscar só traz categorias e centros de custo soltos,
// sem vínculo nem valor. O vínculo real vem no detalhe da parcela
// (GET /financeiro/eventos-financeiros/parcelas/{id}) em `evento.rateio`, mas os
// valores ali são do EVENTO inteiro (ex.: compra em 4 parcelas), não da parcela.
// Por isso a parcela é distribuída proporcionalmente ao peso de cada par:
//   valor da linha = valor pago × (valor do par ÷ soma de todos os pares).

export const SEM_CENTRO_DE_CUSTO = 'Sem centro de custo';

export interface LinhaRateio {
    categoria: string;
    centroDeCusto: string;
    valor: number;
}

function numero(v: unknown): number {
    const n = typeof v === 'string' ? Number(v) : (v as number);
    return Number.isFinite(n) ? Math.abs(n) : 0;
}

/**
 * Distribui `valorPago` entre os pares categoria × CC de `rateio` (o array
 * `evento.rateio` do detalhe da parcela). Categoria sem `rateio_centro_custo`
 * vira uma linha "Sem centro de custo" com o peso do valor da categoria.
 *
 * Valores arredondados a 2 casas; a diferença de centavos vai para a última
 * linha, para a soma bater exatamente com o valor pago (arredondado a centavos).
 *
 * Devolve null quando não dá para distribuir (rateio ausente/vazio ou soma 0) —
 * o chamador deve cair no comportamento antigo.
 */
export function distribuirParcelaPorRateio(valorPago: number, rateio: unknown): LinhaRateio[] | null {
    if (!Array.isArray(rateio) || rateio.length === 0) return null;

    const pares: Array<{ categoria: string; centroDeCusto: string; peso: number }> = [];
    for (const cat of rateio) {
        const categoria = cat?.nome_categoria || 'Diversos';
        const ccs = Array.isArray(cat?.rateio_centro_custo) ? cat.rateio_centro_custo : [];
        if (ccs.length === 0) {
            pares.push({ categoria, centroDeCusto: SEM_CENTRO_DE_CUSTO, peso: numero(cat?.valor) });
        } else {
            for (const cc of ccs) {
                pares.push({ categoria, centroDeCusto: cc?.nome_centro_custo || SEM_CENTRO_DE_CUSTO, peso: numero(cc?.valor) });
            }
        }
    }

    // Par com peso 0 não recebe nada — não gera linha de R$ 0,00.
    const comPeso = pares.filter(p => p.peso > 0);
    const somaPesos = comPeso.reduce((s, p) => s + p.peso, 0);
    if (!(somaPesos > 0)) return null;

    // Trabalha em centavos inteiros para não acumular erro de ponto flutuante.
    const totalCentavos = Math.round(numero(valorPago) * 100);
    let distribuido = 0;
    return comPeso.map((p, i) => {
        const centavos = i === comPeso.length - 1
            ? totalCentavos - distribuido
            : Math.round((totalCentavos * p.peso) / somaPesos);
        distribuido += centavos;
        return { categoria: p.categoria, centroDeCusto: p.centroDeCusto, valor: centavos / 100 };
    });
}
