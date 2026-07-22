import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import './Delta.css';

interface Props {
    /** Variação percentual. `null` significa rubrica nova (sem base de comparação). */
    pct: number | null;
    size?: number;
    /**
     * Em despesa, subir é ruim (padrão). Em receita/resultado a leitura inverte —
     * passe `inverso` para pintar a alta de verde.
     */
    inverso?: boolean;
    rotuloNulo?: string;
}

/** Badge de variação percentual com cor e seta conforme a direção. */
const Delta: React.FC<Props> = ({ pct, size = 13, inverso = false, rotuloNulo = 'Novo' }) => {
    if (pct === null || !isFinite(pct)) return <span className="delta flat">{rotuloNulo}</span>;

    const subiu = pct > 0;
    const neutro = Math.abs(pct) < 0.05;
    const cls = neutro ? 'flat' : (subiu !== inverso ? 'up' : 'down');
    const Icon = neutro ? Minus : subiu ? ArrowUpRight : ArrowDownRight;

    return (
        <span className={`delta ${cls}`}>
            <Icon size={size} />
            {subiu ? '+' : ''}{pct.toFixed(1)}%
        </span>
    );
};

export default Delta;
