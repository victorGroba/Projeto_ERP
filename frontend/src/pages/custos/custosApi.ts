export interface InsumoPreco {
    id: string;
    precoEmbalagem: number;
    qtdEmbalagem: number;
    precoUnitario: number;
    vigencia: string;
    fornecedor: string | null;
    origem: string | null;
    createdAt: string;
}

export interface Insumo {
    id: string;
    nome: string;
    unidade: string | null;
    categoria: string | null;
    setor: string | null;
    ativo: boolean;
    pendencia: string | null;
    observacao: string | null;
    precoAtual: InsumoPreco | null;
    qtdPrecos?: number;
    precos?: InsumoPreco[];
}

export interface Equipamento {
    id: string;
    nome: string;
    tipo: 'EQUIPAMENTO' | 'CALIBRACAO';
    setor: string | null;
    valor: number | null;
    vidaUtilMeses: number | null;
    diasUsoMes: number | null;
    ativo: boolean;
    pendencia: string | null;
    observacao: string | null;
}

export const SETORES = [
    { value: 'FQ', label: 'Físico-Química' },
    { value: 'MICRO', label: 'Microbiologia' },
];

export const CATEGORIAS_INSUMO = [
    'Reagente',
    'Padrão / Material de referência',
    'Meio de cultura',
    'Cepa padrão',
    'Consumível',
];

export const UNIDADES = ['g', 'mg', 'kg', 'mL', 'L', 'un'];

export const labelSetor = (setor: string | null) => SETORES.find(s => s.value === setor)?.label ?? '—';

export async function custosApi<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
    const token = localStorage.getItem('@ContaAzul:token');
    const isForm = options.body instanceof FormData;
    const res = await fetch(`/api/custos${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            ...(options.body && !isForm ? { 'Content-Type': 'application/json' } : {}),
            ...options.headers,
        },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Não foi possível concluir a operação.');
    return data as T;
}

export const formatBRL = (valor: number | null | undefined, casas = 2) => {
    if (valor === null || valor === undefined) return '—';
    return valor.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: casas,
        maximumFractionDigits: casas,
    });
};

// Preço por g/mL costuma ser fração de centavo; mostra casas suficientes.
export const formatPrecoUnitario = (valor: number | null | undefined) => {
    if (valor === null || valor === undefined) return '—';
    return formatBRL(valor, valor >= 1 ? 2 : 4);
};

export const formatData = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';

export const hojeISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const normalizar = (texto: string) =>
    texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
