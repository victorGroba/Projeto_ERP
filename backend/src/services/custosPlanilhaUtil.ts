import * as XLSX from 'xlsx';

// Leitura das planilhas de custo do laboratório célula a célula: as fichas
// técnicas dependem do número da linha e das fórmulas, não só dos valores.

export function texto(value: unknown): string {
    return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

export function numero(value: unknown): number | null {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string') return null;
    const limpo = value.replace(/R\$|\s/g, '');
    if (!/^-?[\d.,]+$/.test(limpo)) return null;
    // "1.234,56" (pt-BR) ou "1,234.56" (en)
    const normalizado = limpo.lastIndexOf(',') > limpo.lastIndexOf('.')
        ? limpo.replace(/\./g, '').replace(',', '.')
        : limpo.replace(/,/g, '');
    const n = Number(normalizado);
    return Number.isFinite(n) ? n : null;
}

export function normalizarUnidade(value: unknown): string | null {
    const u = texto(value).toLowerCase();
    if (!u || u === '-') return null;
    if (['un', 'und', 'unid', 'unidade', 'unidades'].includes(u)) return 'un';
    if (u === 'ml') return 'mL';
    if (u === 'l') return 'L';
    return texto(value);
}

export const moeda = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const letraColuna = (coluna: number) => XLSX.utils.encode_col(coluna);

// Linhas em base 1 (como no Excel) e colunas em base 0.
export class Aba {
    private readonly range: XLSX.Range | null;

    constructor(readonly nome: string, private readonly ws: XLSX.WorkSheet) {
        this.range = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : null;
    }

    get linhas(): number[] {
        if (!this.range) return [];
        const linhas: number[] = [];
        for (let r = this.range.s.r; r <= this.range.e.r; r++) linhas.push(r + 1);
        return linhas;
    }

    get ultimaColuna(): number {
        return this.range?.e.c ?? 0;
    }

    private celula(linha: number, coluna: number): XLSX.CellObject | undefined {
        return this.ws[XLSX.utils.encode_cell({ r: linha - 1, c: coluna })];
    }

    valor(linha: number, coluna: number): unknown {
        return this.celula(linha, coluna)?.v ?? null;
    }

    texto(linha: number, coluna: number): string {
        return texto(this.valor(linha, coluna));
    }

    numero(linha: number, coluna: number): number | null {
        return numero(this.valor(linha, coluna));
    }

    formula(linha: number, coluna: number): string {
        // Espaços só são removidos fora das aspas, para manter nomes de abas como 'Insumos MM'.
        return (this.celula(linha, coluna)?.f ?? '').replace(/('[^']*')|\s+/g, (_m, aspas) => aspas ?? '');
    }
}

export function abrirAba(wb: XLSX.WorkBook, nome: string): Aba {
    return new Aba(nome, wb.Sheets[nome]);
}

// Linha referenciada numa fórmula do tipo 'Insumos MM'!B55.
export function linhaReferenciada(formula: string, aba: string): number | null {
    const escapada = aba.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const m = formula.match(new RegExp(`'?${escapada}'?!\\$?[A-Z]+\\$?(\\d+)`, 'i'));
    return m ? Number(m[1]) : null;
}

// Linhas citadas de uma coluna numa fórmula, incluindo intervalos (I2:I16).
export function linhasDaColuna(formula: string, coluna: number): number[] {
    const letra = letraColuna(coluna);
    const linhas = new Set<number>();
    const re = new RegExp(`(?<![A-Z!])\\$?${letra}\\$?(\\d+)(?::\\$?${letra}\\$?(\\d+))?`, 'g');
    for (const m of formula.matchAll(re)) {
        const inicio = Number(m[1]);
        const fim = m[2] ? Number(m[2]) : inicio;
        for (let l = inicio; l <= fim; l++) linhas.add(l);
    }
    return [...linhas];
}
