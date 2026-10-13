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
    tipo: 'EQUIPAMENTO' | 'CALIBRACAO' | 'MANUTENCAO';
    setor: string | null;
    valor: number | null;
    vidaUtilMeses: number | null;
    diasUsoMes: number | null;
    ativo: boolean;
    pendencia: string | null;
    observacao: string | null;
}

export type TipoItem = 'ATIVIDADE' | 'INSUMO' | 'EQUIPAMENTO';

export interface ItemFicha {
    id?: string;
    tipo: TipoItem;
    descricao?: string | null;
    grupo?: string | null;
    minutos?: number | null;
    insumoId?: string | null;
    quantidade?: number | null;
    equipamentoId?: string | null;
    vidaUtilMeses?: number | null;
    rendimento: number;
}

export interface ItemCalculado extends ItemFicha {
    nome: string;
    unidade: string | null;
    precoUnitario: number | null;
    custo: number | null;
    aviso: string | null;
}

export interface CalculoFicha {
    itens: ItemCalculado[];
    maoDeObra: number;
    materiais: number;
    equipamentos: number;
    subtotal: number;
    controleQualidade: number;
    total: number;
    avisos: string[];
}

export interface EnsaioResumo {
    id: string;
    nome: string;
    codigoLims: string | null;
    metodologia: string | null;
    setor: string | null;
    percentualCQ: number;
    custoPlanilha: number | null;
    origem: string | null;
    ativo: boolean;
    pendencia: string | null;
    observacao: string | null;
    qtdItens: number;
    custo: {
        maoDeObra: number;
        materiais: number;
        equipamentos: number;
        controleQualidade: number;
        total: number;
        qtdAvisos: number;
    };
}

export type EnsaioDetalhe = Omit<EnsaioResumo, 'custo' | 'qtdItens'> & { calculo: CalculoFicha };

export interface Parametro {
    chave: 'custoMinutoTecnico' | 'diasUteisMes';
    valor: number;
    descricao: string;
}

export interface GrupoMargem {
    custoDireto: number;
    imposto: number;
    margemContribuicao: number;
    percentualMargem: number | null;
    qtdAvisos: number;
    avisos: string[];
}

export interface GrupoAnalitico {
    id: string;
    servicoId: string;
    nome: string;
    setor: string | null;
    precoVenda: number;
    nomeAllims: string | null;
    pendencia: string | null;
    ensaios: { ensaioId: string; ensaio: { nome: string; ativo: boolean } }[];
    margem: GrupoMargem;
}

export interface GrupoInput {
    nome: string;
    setor: string | null;
    precoVenda: number;
    nomeAllims: string | null;
    pendencia: string | null;
    ensaioIds: string[];
}

export interface Servico {
    id: string;
    nome: string;
    codigo: string | null;
    observacao: string | null;
    ativo: boolean;
    grupos: GrupoAnalitico[];
}

export const grupoParaInput = (g: GrupoAnalitico): GrupoInput => ({
    nome: g.nome,
    setor: g.setor,
    precoVenda: g.precoVenda,
    nomeAllims: g.nomeAllims,
    pendencia: g.pendencia,
    ensaioIds: g.ensaios.map(e => e.ensaioId),
});

export const TIPOS_EQUIPAMENTO = [
    { value: 'EQUIPAMENTO', label: 'Equipamento' },
    { value: 'CALIBRACAO', label: 'Calibração / qualificação' },
    { value: 'MANUTENCAO', label: 'Manutenção / contrato' },
];

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
