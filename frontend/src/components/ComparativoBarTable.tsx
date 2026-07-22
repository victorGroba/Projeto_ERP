import React, { useMemo, useState } from 'react';
import './ComparativoBarTable.css';

export interface ComparativoItem {
    categoria: string;
    valorA: number;      // período de comparação
    valorB: number;      // período atual
    variacao: number | null;
}

interface Props {
    itens: ComparativoItem[];
    total?: ComparativoItem;      // coluna "Total" destacada no fim
    labelA: string;               // rótulo do período atual (valorB)
    labelB: string;               // rótulo do período de comparação (valorA)
    colorCurrent: string;
    colorPrevious: string;
    /** Divide os valores exibidos (ex.: 1000 para "em milhares"). */
    escala?: number;
}

/**
 * Gráfico de colunas agrupadas com a tabela de valores alinhada logo abaixo do
 * eixo — o formato usado nas planilhas de diretoria: cada coluna do gráfico tem
 * suas cifras exatas na vertical, então dá para ler a comparação sem tooltip.
 *
 * As larguras são compartilhadas por um único CSS grid, e a coluna da esquerda
 * (escala + nomes das linhas) fica sticky para sobreviver à rolagem horizontal.
 */

const nf = (casas: number) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

/** Arredonda o topo do eixo para um número "redondo" (1, 2, 2,5, 5 ou 10 × 10ⁿ). */
function niceCeil(v: number): number {
    if (v <= 0) return 1;
    const exp = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / exp;
    const passo = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return passo * exp;
}

const ComparativoBarTable: React.FC<Props> = ({
    itens, total, labelA, labelB, colorCurrent, colorPrevious, escala = 1,
}) => {
    const [hover, setHover] = useState<number | null>(null);

    const colunas = useMemo(() => (total ? [...itens, total] : itens), [itens, total]);

    // A escala do eixo ignora a coluna Total (senão as rubricas viram traços).
    const maxCategoria = useMemo(
        () => Math.max(0, ...itens.flatMap(i => [i.valorA || 0, i.valorB || 0])),
        [itens]
    );
    const maxEixo = niceCeil(maxCategoria);
    const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => f * maxEixo);

    const casas = maxEixo / escala >= 100 ? 0 : 1;
    const fmtValor = (v: number) => nf(casas).format(v / escala);
    const fmtTick = (v: number) => nf(maxEixo / escala >= 10 ? 0 : 1).format(v / escala);

    const alturaBarra = (v: number) => `${Math.max(0, Math.min(100, ((v || 0) / maxEixo) * 100))}%`;

    const larguraCol = colunas.length <= 8 ? '1fr' : 'minmax(74px, 1fr)';

    return (
        <div className="cmp">
            {/* Coluna fixa: escala do eixo + nomes das linhas */}
            <div className="cmp-gutter">
                <div className="cmp-gutter-plot">
                    {ticks.map(t => (
                        <span key={t} className="cmp-tick" style={{ bottom: `${(t / maxEixo) * 100}%` }}>
                            {fmtTick(t)}
                        </span>
                    ))}
                </div>
                <div className="cmp-gutter-cat" />
                <div className="cmp-gutter-row">
                    <i style={{ background: colorCurrent }} /><span title={labelA}>{labelA}</span>
                </div>
                <div className="cmp-gutter-row">
                    <i style={{ background: colorPrevious }} /><span title={labelB}>{labelB}</span>
                </div>
                <div className="cmp-gutter-row"><span>VAR %</span></div>
            </div>

            {/* Colunas roláveis */}
            <div className="cmp-scroll">
                <div
                    className="cmp-grid"
                    style={{ gridTemplateColumns: `repeat(${colunas.length}, ${larguraCol})` }}
                    onMouseLeave={() => setHover(null)}
                >
                    <div className="cmp-gridlines">
                        {ticks.map(t => (
                            <div
                                key={t}
                                className={`cmp-gridline${t === 0 ? ' is-base' : ''}`}
                                style={{ bottom: `${(t / maxEixo) * 100}%` }}
                            />
                        ))}
                    </div>

                    {colunas.map((item, i) => {
                        const ehTotal = !!total && i === colunas.length - 1;
                        const varClass = item.variacao === null ? '' : item.variacao > 0 ? ' is-up' : item.variacao < 0 ? ' is-down' : '';
                        return (
                            <div
                                key={`${item.categoria}-${i}`}
                                className={`cmp-col${hover === i ? ' is-hover' : ''}${ehTotal ? ' is-total' : ''}`}
                                onMouseEnter={() => setHover(i)}
                            >
                                <div className="cmp-plot">
                                    <div
                                        className="cmp-bar"
                                        style={{ height: alturaBarra(item.valorB), background: colorCurrent }}
                                        title={`${labelA}: ${fmtValor(item.valorB)}`}
                                    />
                                    <div
                                        className="cmp-bar"
                                        style={{ height: alturaBarra(item.valorA), background: colorPrevious }}
                                        title={`${labelB}: ${fmtValor(item.valorA)}`}
                                    />
                                </div>
                                <div className="cmp-cat" title={item.categoria}>{item.categoria}</div>
                                <div className={`cmp-cell${item.valorB > 0 ? '' : ' is-empty'}`}>
                                    {item.valorB > 0 ? fmtValor(item.valorB) : '—'}
                                </div>
                                <div className={`cmp-cell${item.valorA > 0 ? ' is-muted' : ' is-empty'}`}>
                                    {item.valorA > 0 ? fmtValor(item.valorA) : '—'}
                                </div>
                                <div className={`cmp-cell${varClass}`}>
                                    {item.variacao === null
                                        ? 'novo'
                                        : `${item.variacao > 0 ? '+' : ''}${nf(1).format(item.variacao)}%`}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default ComparativoBarTable;
