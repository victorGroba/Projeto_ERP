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
const nfMoeda = (casas: number) => new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL',
    minimumFractionDigits: casas, maximumFractionDigits: casas,
});

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
    const [tipPos, setTipPos] = useState({ x: 0, y: 0 });

    const colunas = useMemo(() => (total ? [...itens, total] : itens), [itens, total]);

    // A escala do eixo ignora a coluna Total (senão as rubricas viram traços).
    const maxCategoria = useMemo(
        () => Math.max(0, ...itens.flatMap(i => [i.valorA || 0, i.valorB || 0])),
        [itens]
    );
    const maxEixo = niceCeil(maxCategoria);
    const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => f * maxEixo);

    const casas = maxEixo / escala >= 100 ? 0 : 1;
    const fmtValor = (v: number) => nfMoeda(casas).format(v / escala);
    const fmtTick = (v: number) => nf(maxEixo / escala >= 10 ? 0 : 1).format(v / escala);
    /** No tooltip mostramos o valor cheio, sem a escala de milhares. */
    const fmtExato = (v: number) => nfMoeda(2).format(v);

    const alturaBarra = (v: number) => `${Math.max(0, Math.min(100, ((v || 0) / maxEixo) * 100))}%`;

    const larguraCol = colunas.length <= 7 ? '1fr' : 'minmax(92px, 1fr)';

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
                                onMouseMove={e => setTipPos({ x: e.clientX, y: e.clientY })}
                            >
                                <div className="cmp-plot">
                                    <div className="cmp-bar" style={{ height: alturaBarra(item.valorB), background: colorCurrent }} />
                                    <div className="cmp-bar" style={{ height: alturaBarra(item.valorA), background: colorPrevious }} />
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

            {/* Tooltip: segue o mouse, com os valores cheios */}
            {hover !== null && colunas[hover] && (
                <div
                    className="cmp-tip"
                    style={{
                        left: Math.min(tipPos.x + 16, window.innerWidth - 280),
                        top: Math.max(tipPos.y - 12, 8),
                    }}
                >
                    <div className="cmp-tip-title">{colunas[hover].categoria}</div>
                    <div className="cmp-tip-row">
                        <span><i style={{ background: colorCurrent }} />{labelA}</span>
                        <strong>{fmtExato(colunas[hover].valorB)}</strong>
                    </div>
                    <div className="cmp-tip-row">
                        <span><i style={{ background: colorPrevious }} />{labelB}</span>
                        <strong>{fmtExato(colunas[hover].valorA)}</strong>
                    </div>
                    <div className="cmp-tip-foot">
                        <span>Diferença</span>
                        <strong className={diffClass(colunas[hover])}>
                            {colunas[hover].valorB - colunas[hover].valorA > 0 ? '+' : ''}
                            {fmtExato(colunas[hover].valorB - colunas[hover].valorA)}
                            {colunas[hover].variacao !== null && (
                                <em> ({colunas[hover].variacao! > 0 ? '+' : ''}{nf(1).format(colunas[hover].variacao!)}%)</em>
                            )}
                        </strong>
                    </div>
                </div>
            )}
        </div>
    );
};

const diffClass = (item: ComparativoItem) => {
    const d = item.valorB - item.valorA;
    return d > 0 ? 'is-up' : d < 0 ? 'is-down' : '';
};

export default ComparativoBarTable;
