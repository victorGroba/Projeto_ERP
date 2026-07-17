import React, { useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight, Database, Calculator, AlertCircle, CheckCircle } from 'lucide-react';
import './Dashboard.css';

type Status = 'ok' | 'revisar' | 'pendente';

interface KPI {
    nome: string;
    descricao: string;
    formula: string;
    fonteDados: string;
    campoBD: string;
    filtros: string;
    observacao?: string;
    status: Status;
}

interface Modulo {
    titulo: string;
    subtitulo: string;
    cor: string;
    kpis: KPI[];
}

const MODULOS: Modulo[] = [
    {
        titulo: 'Visão Geral',
        subtitulo: 'Página inicial — indicadores de alto nível',
        cor: 'var(--primary)',
        kpis: [
            {
                nome: 'Despesa do Mês Atual',
                descricao: 'Soma de todas as despesas pagas no mês corrente do ano selecionado.',
                formula: 'SOMA(valor) onde tipo = DESPESA e dataPagamento está no mês atual do ano selecionado',
                fonteDados: 'Tabela: lancamento  |  Endpoint: /api/dashboard/despesas/evolucao-mensal',
                campoBD: 'lancamento.valor, lancamento.dataPagamento, lancamento.tipo',
                filtros: 'tipo = "DESPESA", dataPagamento dentro do mês atual',
                observacao: 'A comparação com o mês anterior usa o mesmo mês do ano passado.',
                status: 'ok',
            },
            {
                nome: 'Despesa Acumulada do Ano',
                descricao: 'Total de despesas pagas desde janeiro até o último mês com registro no ano selecionado.',
                formula: 'SOMA(valor) onde tipo = DESPESA e dataPagamento entre 01/01 e 31/12 do ano selecionado',
                fonteDados: 'Tabela: lancamento  |  Endpoint: /api/dashboard/despesas/evolucao-mensal',
                campoBD: 'lancamento.valor, lancamento.dataPagamento',
                filtros: 'tipo = "DESPESA", ano = ano selecionado',
                status: 'ok',
            },
            {
                nome: 'Total Vencido em Atraso',
                descricao: 'Soma de todos os títulos a receber que já venceram e ainda não foram pagos.',
                formula: 'SOMA(valor) onde status = "Vencido" (status NÃO está em: Recebido, Baixado, Pago)',
                fonteDados: 'Tabela: contaReceber  |  Endpoint: /api/dashboard/inadimplencia/aging',
                campoBD: 'contaReceber.valor, contaReceber.status, contaReceber.dataVencimento',
                filtros: 'status não é "Pago", "Recebido" nem "Baixado"',
                observacao: 'É a soma das 4 faixas de atraso: até 30d + 31-60d + 61-90d + mais de 90d.',
                status: 'ok',
            },
            {
                nome: 'Risco Crítico (+90 dias)',
                descricao: 'Títulos vencidos há mais de 90 dias — maior risco de não recebimento.',
                formula: 'SOMA(valor) onde status = "Vencido" e (hoje − dataVencimento) > 90 dias',
                fonteDados: 'Tabela: contaReceber  |  Endpoint: /api/dashboard/inadimplencia/aging',
                campoBD: 'contaReceber.valor, contaReceber.dataVencimento',
                filtros: 'status = "Vencido", diferença em dias > 90',
                observacao: 'Os dias são calculados com arredondamento para cima (Math.ceil).',
                status: 'ok',
            },
            {
                nome: 'Recebido no Ano',
                descricao: 'Total de receitas efetivamente recebidas (pagas) no ano selecionado.',
                formula: 'SOMA(valor) onde status = "Pago" e dataVencimento está no ano selecionado',
                fonteDados: 'Tabela: contaReceber  |  Endpoint: /api/dashboard/despesas/caixa-bancos',
                campoBD: 'contaReceber.valor, contaReceber.status, contaReceber.dataVencimento',
                filtros: 'status = "Pago", ano = ano selecionado',
                observacao: 'Usa dataVencimento como referência de período, não a data do pagamento efetivo.',
                status: 'revisar',
            },
            {
                nome: 'Top 6 Maiores Devedores',
                descricao: 'Lista dos 6 clientes/grupos com maior valor vencido sem pagamento.',
                formula: 'AGRUPA POR cliente ou grupo → SOMA(valor) → ORDENA DESC → LIMITA 6',
                fonteDados: 'Tabela: contaReceber  |  Endpoint: /api/dashboard/inadimplencia/aging',
                campoBD: 'contaReceber.cliente, contaReceber.grupo, contaReceber.valor',
                filtros: 'Mesmos filtros de "Total Vencido em Atraso"',
                observacao: 'Se o registro tem campo "grupo" preenchido, agrupa por grupo; senão usa "cliente".',
                status: 'ok',
            },
        ],
    },
    {
        titulo: 'Custos & Despesas',
        subtitulo: 'Análise de despesas por categoria e centro de custo',
        cor: '#7c3aed',
        kpis: [
            {
                nome: 'Despesa Total Acumulada (ano)',
                descricao: 'Soma de todas as despesas pagas no ano selecionado, independente de categoria ou CC.',
                formula: 'SOMA(totalAnual de todas as linhas) — onde totalAnual = SOMA(valor) por categoria+CC no ano',
                fonteDados: 'Tabela: lancamento  |  Endpoint: /api/dashboard/despesas/agrupado',
                campoBD: 'lancamento.valor, lancamento.dataPagamento, lancamento.tipo',
                filtros: 'tipo = "DESPESA", dataPagamento.year = ano selecionado',
                observacao: 'O cálculo acontece em dois passos: (1) backend agrupa por categoria+CC, (2) frontend soma todos os totalAnual.',
                status: 'ok',
            },
            {
                nome: 'Total Consolidado (ano anterior)',
                descricao: 'Mesmo cálculo acima, mas para o ano anterior — usado como base de comparação.',
                formula: 'SOMA(totalAnterior de todas as linhas) — onde totalAnterior = SOMA(valor) por categoria+CC no ano-1',
                fonteDados: 'Tabela: lancamento  |  Endpoint: /api/dashboard/despesas/agrupado',
                campoBD: 'lancamento.valor, lancamento.dataPagamento',
                filtros: 'tipo = "DESPESA", dataPagamento.year = ano selecionado - 1',
                status: 'ok',
            },
            {
                nome: 'Variação Anual (R$ e %)',
                descricao: 'Diferença entre despesa total do ano atual e do ano anterior.',
                formula: 'R$: totalAtual − totalAnterior\n%: (totalAtual − totalAnterior) ÷ totalAnterior × 100',
                fonteDados: 'Calculado no frontend a partir dos dois KPIs acima',
                campoBD: '—',
                filtros: '—',
                observacao: 'Vermelho = custo inflado (subiu). Verde = redução de custo (caiu). Ao contrário da receita onde verde é subir.',
                status: 'ok',
            },
            {
                nome: 'Curva de Pareto — Maiores Despesas',
                descricao: 'Top 7 categorias com maior gasto no ano, comparadas ao ano anterior.',
                formula: 'AGRUPA POR categoria → SOMA(valor) → ORDENA DESC → LIMITA 7',
                fonteDados: 'Tabela: lancamento  |  Endpoint: /api/dashboard/despesas/agrupado',
                campoBD: 'lancamento.categoria, lancamento.valor',
                filtros: 'tipo = "DESPESA", ano atual e anterior',
                status: 'ok',
            },
            {
                nome: 'Composição Departamental',
                descricao: 'Top 10 centros de custo com maior gasto no ano.',
                formula: 'AGRUPA POR centroDeCusto → SOMA(valor) → ORDENA DESC → LIMITA 10',
                fonteDados: 'Tabela: lancamento  |  Endpoint: /api/dashboard/despesas/agrupado',
                campoBD: 'lancamento.centroDeCusto, lancamento.valor',
                filtros: 'tipo = "DESPESA", ano atual e anterior',
                status: 'ok',
            },
            {
                nome: 'Matriz de Alocação por CC',
                descricao: 'Tabela detalhada com cada par categoria+centroDeCusto, mostrando valor do ano atual, anterior e variação.',
                formula: 'totalAnterior = SOMA(valor) por CC+categoria no ano-1\ntotalAnual = SOMA(valor) por CC+categoria no ano\nevolucaoRS = totalAnual − totalAnterior\nevolucao% = evolucaoRS ÷ totalAnterior × 100',
                fonteDados: 'Tabela: lancamento  |  Endpoint: /api/dashboard/despesas/agrupado',
                campoBD: 'lancamento.categoria, lancamento.centroDeCusto, lancamento.valor, lancamento.dataPagamento',
                filtros: 'tipo = "DESPESA"',
                status: 'ok',
            },
            {
                nome: 'Detalhamento por Centro de Custo (accordion)',
                descricao: 'Lista expandível de cada CC mostrando o breakdown por categoria, com variação.',
                formula: 'Por CC: totalAtual = SOMA(valor), totalAnterior = SOMA(valor ano-1), variacao = (totalAtual−totalAnterior)÷totalAnterior',
                fonteDados: 'Tabela: lancamento  |  Endpoint: /api/dashboard/despesas/detalhe-por-cc',
                campoBD: 'lancamento.centroDeCusto, lancamento.categoria, lancamento.valor, lancamento.dataPagamento',
                filtros: 'tipo = "DESPESA"',
                status: 'ok',
            },
        ],
    },
    {
        titulo: 'Análise Avançada (Evolução Mensal)',
        subtitulo: 'Resultado financeiro, receitas, DRE simplificado e distribuição de lucros',
        cor: 'var(--success)',
        kpis: [
            {
                nome: 'Total Acumulado do Ano (Evolução)',
                descricao: 'Soma de todas as despesas pagas no ano na visão de evolução mensal.',
                formula: 'SOMA(valor) onde tipo = DESPESA e dataPagamento.year = ano selecionado',
                fonteDados: 'Tabela: lancamento  |  Endpoint: /api/dashboard/despesas/evolucao-mensal',
                campoBD: 'lancamento.valor, lancamento.dataPagamento',
                filtros: 'tipo = "DESPESA"',
                status: 'ok',
            },
            {
                nome: 'Média Mensal',
                descricao: 'Média de despesas apenas dos meses que têm ao menos um lançamento registrado.',
                formula: 'totalAcumulado ÷ quantidade de meses com valor > 0',
                fonteDados: 'Calculado no frontend a partir do endpoint /evolucao-mensal',
                campoBD: '—',
                filtros: 'Apenas meses onde anoAtual > 0',
                observacao: 'Evita distorcer a média com meses futuros (sem dados).',
                status: 'ok',
            },
            {
                nome: 'Variação vs Ano Anterior (%)',
                descricao: 'Comparação do total acumulado do ano atual contra o total do ano anterior.',
                formula: '(totalAtual − totalAnterior) ÷ totalAnterior × 100',
                fonteDados: 'Calculado no frontend com dados do /evolucao-mensal',
                campoBD: '—',
                filtros: '—',
                status: 'ok',
            },
            {
                nome: 'Resultado Financeiro Mensal',
                descricao: 'Para cada mês: receitas recebidas menos despesas operacionais. Mostra se o mês teve lucro ou prejuízo.',
                formula: 'resultado_mês = receitas_mês − despesas_operacionais_mês\nreceitas = SOMA(contaReceber.valor) do mês\ndespesas_operacionais = SOMA(lancamento.valor) do mês, excluindo categorias não operacionais',
                fonteDados: 'Tabelas: contaReceber + lancamento  |  Endpoint: /api/dashboard/resultado/mensal',
                campoBD: 'contaReceber.valor, contaReceber.dataVencimento | lancamento.valor, lancamento.dataPagamento, lancamento.categoria',
                filtros: 'Despesas operacionais EXCLUEM: "Depósito Judicial", "Imobilizações", "Distribuição de Lucros"',
                observacao: 'IMPORTANTE: Despesas de distribuição de lucros, imobilizações e depósitos judiciais são excluídas do resultado operacional para não distorcer o lucro.',
                status: 'revisar',
            },
            {
                nome: 'Resultado do Ano',
                descricao: 'Soma de todos os resultados mensais do ano — indica o lucro/prejuízo total operacional.',
                formula: 'SOMA(resultado de cada mês) = totalReceitas − totalDespesasOperacionais',
                fonteDados: 'Tabelas: contaReceber + lancamento  |  Endpoint: /api/dashboard/resultado/mensal',
                campoBD: 'Mesmos do Resultado Financeiro Mensal',
                filtros: 'Mesmos do Resultado Financeiro Mensal',
                status: 'revisar',
            },
            {
                nome: 'Receitas por Status (Caixa & Bancos)',
                descricao: 'Quebra das contas a receber do ano por status: recebido, a vencer e vencido.',
                formula: 'Recebido = SOMA(valor) onde status = "Pago"\nA Vencer = SOMA(valor) onde status = "A Vencer"\nVencido = SOMA(valor) onde status = "Vencido"',
                fonteDados: 'Tabela: contaReceber  |  Endpoint: /api/dashboard/despesas/caixa-bancos',
                campoBD: 'contaReceber.valor, contaReceber.status, contaReceber.dataVencimento',
                filtros: 'dataVencimento.year = ano selecionado',
                status: 'ok',
            },
            {
                nome: 'Saldo Líquido (Receitas − Despesas)',
                descricao: 'Diferença entre o total recebido e o total de despesas pagas no ano.',
                formula: 'saldoLíquido = totalRecebido − totalDespesas\ntotalRecebido = SOMA(contaReceber.valor WHERE status = "Pago")\ntotalDespesas = SOMA(lancamento.valor WHERE tipo = "DESPESA")',
                fonteDados: 'Tabelas: contaReceber + lancamento  |  Endpoint: /api/dashboard/despesas/caixa-bancos',
                campoBD: 'contaReceber.valor | lancamento.valor',
                filtros: 'ano selecionado',
                status: 'ok',
            },
            {
                nome: 'Receitas por Tipo',
                descricao: 'Distribuição das receitas por categoria, com percentual sobre o total.',
                formula: 'AGRUPA POR contaReceber.categoria → SOMA(valor) → percentual = valor ÷ totalReceitas × 100',
                fonteDados: 'Tabela: contaReceber  |  Endpoint: /api/dashboard/resultado/receitas-tipo',
                campoBD: 'contaReceber.categoria, contaReceber.valor, contaReceber.dataVencimento',
                filtros: 'dataVencimento.year = ano selecionado',
                status: 'ok',
            },
            {
                nome: 'DRE Cascata (Outras Saídas)',
                descricao: 'Demonstrativo de resultado simplificado em cascata: parte das receitas e vai subtraindo cada grupo de saída.',
                formula: '1. Receitas = SOMA(contaReceber.valor)\n2. (−) Despesas Operacionais = SOMA(lancamento.valor) excluindo especiais\n3. = Lucro Financeiro Operacional\n4. (−) Depósito Judicial\n5. (−) Imobilizações\n6. (−) Distribuição de Lucros\n7. = Resultado do Exercício',
                fonteDados: 'Tabelas: contaReceber + lancamento  |  Endpoint: /api/dashboard/resultado/outras-saidas',
                campoBD: 'lancamento.categoria, lancamento.valor | contaReceber.valor',
                filtros: 'Depósito Judicial: categoria contém "depósito judicial"\nImobilizações: categoria contém "imobiliz" ou "máquinas, equipamentos"\nDistribuição: categoria contém "antecipação de lucros", "distrib. l." ou "distribuição de lucro"',
                observacao: 'As categorias são identificadas por expressão regular (busca parcial no texto). Se a nomenclatura das categorias mudar, o filtro pode falhar.',
                status: 'revisar',
            },
            {
                nome: 'Distribuição de Lucros por Sócio',
                descricao: 'Mostra quanto cada sócio recebeu de retirada/distribuição/pró-labore no ano.',
                formula: 'FILTRA lancamentos onde categoria OU descrição OU fornecedor contém palavras-chave → AGRUPA POR fornecedor → SOMA(valor)',
                fonteDados: 'Tabela: lancamento  |  Endpoint: /api/dashboard/despesas/distribuicao-lucros',
                campoBD: 'lancamento.categoria, lancamento.descricao, lancamento.fornecedor, lancamento.valor',
                filtros: 'Palavras-chave: "distribuicao de lucro", "lucro", "pro-labore", "prolabore", "retirada", "dividendo"',
                observacao: 'O agrupamento por sócio usa o campo "fornecedor". Se o nome do sócio variar entre lançamentos, pode aparecer duplicado.',
                status: 'revisar',
            },
        ],
    },
    {
        titulo: 'Inadimplência',
        subtitulo: 'Risco de crédito, aging e devedores',
        cor: 'var(--danger)',
        kpis: [
            {
                nome: 'Total Vencido em Atraso',
                descricao: 'Soma de todos os títulos em aberto que já passaram da data de vencimento.',
                formula: 'SOMA(valor) onde status = "Vencido"\n= Até 30d + 31 a 60d + 61 a 90d + Mais de 90d',
                fonteDados: 'Tabela: contaReceber  |  Endpoint: /api/dashboard/inadimplencia/aging',
                campoBD: 'contaReceber.valor, contaReceber.status',
                filtros: 'status NÃO está em: "Recebido", "Baixado", "Pago"',
                status: 'ok',
            },
            {
                nome: 'A Vencer (Saudável)',
                descricao: 'Títulos que ainda não venceram — carteira saudável futura.',
                formula: 'SOMA(valor) onde status = "A Vencer"',
                fonteDados: 'Tabela: contaReceber  |  Endpoint: /api/dashboard/inadimplencia/aging',
                campoBD: 'contaReceber.valor, contaReceber.status',
                filtros: 'status = "A Vencer"',
                status: 'ok',
            },
            {
                nome: 'Risco Crítico (> 90 dias)',
                descricao: 'Parte do atraso com maior risco real de perda — títulos velhos sem pagamento.',
                formula: 'SOMA(valor) onde (hoje − dataVencimento) > 90 dias e status = "Vencido"',
                fonteDados: 'Tabela: contaReceber  |  Endpoint: /api/dashboard/inadimplencia/aging',
                campoBD: 'contaReceber.valor, contaReceber.dataVencimento',
                filtros: 'Dias calculados: teto((hoje.ms − dataVencimento.ms) ÷ 86400000)',
                status: 'ok',
            },
            {
                nome: 'Taxa de Inadimplência (%)',
                descricao: 'Proporção do que está vencido em relação ao total da carteira (vencido + a vencer).',
                formula: 'percentual = totalAtraso ÷ (totalAtraso + aVencer) × 100',
                fonteDados: 'Calculado no frontend com dados do /inadimplencia/aging',
                campoBD: '—',
                filtros: '—',
                observacao: 'Não inclui títulos já pagos — reflete apenas a carteira ativa.',
                status: 'ok',
            },
            {
                nome: 'Aging Buckets (Distribuição por faixa)',
                descricao: 'Distribui o valor vencido em faixas de dias de atraso para visualizar a maturidade da dívida.',
                formula: 'Até 30 dias: 0 < diasAtraso ≤ 30\n31 a 60 dias: 30 < diasAtraso ≤ 60\n61 a 90 dias: 60 < diasAtraso ≤ 90\nMais de 90 dias: diasAtraso > 90',
                fonteDados: 'Tabela: contaReceber  |  Endpoint: /api/dashboard/inadimplencia/aging',
                campoBD: 'contaReceber.valor, contaReceber.dataVencimento, contaReceber.status',
                filtros: 'status = "Vencido"',
                status: 'ok',
            },
            {
                nome: 'Maiores Devedores por Grupo (Top 15)',
                descricao: 'Lista dos 15 maiores devedores, agrupando empresas do mesmo grupo econômico.',
                formula: 'SE grupo preenchido: chave = "{grupo} (Grupo)"\nSENÃO: chave = cliente\nSOMA(valor) → ORDENA DESC → LIMITA 15',
                fonteDados: 'Tabela: contaReceber  |  Endpoint: /api/dashboard/inadimplencia/aging',
                campoBD: 'contaReceber.cliente, contaReceber.grupo, contaReceber.valor',
                filtros: 'Mesmos de "Total Vencido em Atraso"',
                observacao: 'O campo "grupo" precisa estar preenchido corretamente no CSV para que empresas do mesmo grupo sejam consolidadas.',
                status: 'revisar',
            },
        ],
    },
];

const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    ok:      { label: 'Validado',       color: 'var(--success)', bg: 'var(--success-light)', icon: <CheckCircle size={14} /> },
    revisar: { label: 'Revisar',        color: 'var(--warning)', bg: 'var(--warning-light)', icon: <AlertCircle size={14} /> },
    pendente:{ label: 'A Validar',      color: 'var(--text-muted)', bg: 'var(--background)', icon: <AlertCircle size={14} /> },
};

const KPICard: React.FC<{ kpi: KPI }> = ({ kpi }) => {
    const [open, setOpen] = useState(false);
    const s = STATUS_CONFIG[kpi.status];

    return (
        <div style={{
            border: '1px solid var(--border)',
            borderRadius: '0.75rem',
            overflow: 'hidden',
            background: 'var(--surface)',
            marginBottom: '0.75rem',
        }}>
            <button
                onClick={() => setOpen(o => !o)}
                style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '1rem 1.25rem', background: 'none', border: 'none', cursor: 'pointer',
                    gap: '1rem',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, textAlign: 'left' }}>
                    {open ? <ChevronDown size={16} color="var(--text-muted)" /> : <ChevronRight size={16} color="var(--text-muted)" />}
                    <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-main)' }}>{kpi.nome}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>{kpi.descricao}</span>
                </div>
                <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                    padding: '0.25rem 0.65rem', borderRadius: '2rem',
                    fontSize: '0.75rem', fontWeight: 700,
                    color: s.color, background: s.bg, whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                    {s.icon}{s.label}
                </span>
            </button>

            {open && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '1.25rem 1.5rem', background: 'var(--background)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                <Calculator size={13} /> Fórmula de Cálculo
                            </p>
                            <pre style={{
                                background: 'var(--surface)', border: '1px solid var(--border)',
                                borderRadius: '0.5rem', padding: '0.75rem 1rem',
                                fontSize: '0.8125rem', color: 'var(--text-main)', lineHeight: 1.7,
                                whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0,
                                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                            }}>
                                {kpi.formula}
                            </pre>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div>
                                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                    <Database size={13} /> Fonte de Dados
                                </p>
                                <p style={{ fontSize: '0.8125rem', color: 'var(--text-main)', lineHeight: 1.5, margin: 0 }}>{kpi.fonteDados}</p>
                            </div>
                            <div>
                                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Campos do Banco</p>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'ui-monospace, monospace', margin: 0 }}>{kpi.campoBD}</p>
                            </div>
                            {kpi.filtros !== '—' && (
                                <div>
                                    <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Filtros Aplicados</p>
                                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-main)', margin: 0 }}>{kpi.filtros}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {kpi.observacao && (
                        <div style={{
                            marginTop: '0.875rem', padding: '0.75rem 1rem',
                            background: kpi.status === 'revisar' ? 'var(--warning-light)' : 'var(--surface)',
                            border: `1px solid ${kpi.status === 'revisar' ? 'var(--warning-border)' : 'var(--border)'}`,
                            borderRadius: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start',
                        }}>
                            <AlertCircle size={15} color={kpi.status === 'revisar' ? 'var(--warning)' : 'var(--text-muted)'} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                            <p style={{ fontSize: '0.8125rem', color: kpi.status === 'revisar' ? 'var(--warning)' : 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                                <strong>Obs:</strong> {kpi.observacao}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const DocumentacaoKPIs: React.FC = () => {
    const [modulosAbertos, setModulosAbertos] = useState<Set<number>>(new Set([0]));

    const toggleModulo = (idx: number) =>
        setModulosAbertos(prev => {
            const next = new Set(prev);
            next.has(idx) ? next.delete(idx) : next.add(idx);
            return next;
        });

    const totalKpis = MODULOS.reduce((a, m) => a + m.kpis.length, 0);
    const totalRevisar = MODULOS.reduce((a, m) => a + m.kpis.filter(k => k.status === 'revisar').length, 0);
    const totalOk = MODULOS.reduce((a, m) => a + m.kpis.filter(k => k.status === 'ok').length, 0);

    return (
        <div className="module-page fade-in">
            <header className="page-header">
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <BookOpen size={22} />
                    Documentação de KPIs
                </h2>
                <p>Como cada indicador é calculado — para validação pela equipe financeira</p>
            </header>

            {/* Resumo */}
            <div className="metrics-grid" style={{ marginBottom: '2rem' }}>
                <div className="kpi-card highlight">
                    <div className="kpi-icon" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>
                        <CheckCircle size={26} />
                    </div>
                    <div className="kpi-content">
                        <h4>KPIs Validados</h4>
                        <h2>{totalOk}</h2>
                        <span style={{ fontSize: '0.8rem', color: 'var(--success)' }}>de {totalKpis} KPIs mapeados</span>
                    </div>
                </div>
                <div className="kpi-card warning">
                    <div className="kpi-icon" style={{ background: 'var(--warning-light)', color: 'var(--warning)' }}>
                        <AlertCircle size={26} />
                    </div>
                    <div className="kpi-content">
                        <h4>Para Revisar</h4>
                        <h2>{totalRevisar}</h2>
                        <span style={{ fontSize: '0.8rem', color: 'var(--warning)' }}>precisam de confirmação</span>
                    </div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-icon" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
                        <Database size={26} />
                    </div>
                    <div className="kpi-content">
                        <h4>Total de KPIs</h4>
                        <h2>{totalKpis}</h2>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>em {MODULOS.length} módulos</span>
                    </div>
                </div>
            </div>

            {/* Legenda */}
            <div style={{
                display: 'flex', gap: '1rem', marginBottom: '1.75rem',
                padding: '0.75rem 1.25rem', background: 'var(--surface)',
                border: '1px solid var(--border)', borderRadius: '0.75rem',
                flexWrap: 'wrap', alignItems: 'center',
            }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Legenda:</span>
                {Object.entries(STATUS_CONFIG).map(([, cfg]) => (
                    <span key={cfg.label} style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                        padding: '0.2rem 0.6rem', borderRadius: '2rem', fontSize: '0.8rem',
                        fontWeight: 600, color: cfg.color, background: cfg.bg,
                    }}>
                        {cfg.icon} {cfg.label}
                    </span>
                ))}
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                    Clique em cada KPI para ver a fórmula completa
                </span>
            </div>

            {/* Módulos */}
            {MODULOS.map((modulo, idx) => {
                const isOpen = modulosAbertos.has(idx);
                const contRevisar = modulo.kpis.filter(k => k.status === 'revisar').length;
                return (
                    <div key={modulo.titulo} style={{
                        border: '1px solid var(--border)', borderRadius: '1rem',
                        overflow: 'hidden', marginBottom: '1.25rem',
                        background: 'var(--surface)',
                    }}>
                        <button
                            onClick={() => toggleModulo(idx)}
                            style={{
                                width: '100%', display: 'flex', alignItems: 'center',
                                justifyContent: 'space-between', padding: '1.25rem 1.5rem',
                                background: 'none', border: 'none', cursor: 'pointer',
                                borderLeft: `4px solid ${modulo.cor}`,
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', textAlign: 'left' }}>
                                {isOpen ? <ChevronDown size={18} color="var(--text-muted)" /> : <ChevronRight size={18} color="var(--text-muted)" />}
                                <div>
                                    <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>{modulo.titulo}</p>
                                    <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{modulo.subtitulo}</p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                {contRevisar > 0 && (
                                    <span style={{
                                        padding: '0.2rem 0.6rem', borderRadius: '2rem', fontSize: '0.75rem',
                                        fontWeight: 700, color: 'var(--warning)', background: 'var(--warning-light)',
                                        display: 'flex', alignItems: 'center', gap: '0.3rem',
                                    }}>
                                        <AlertCircle size={12} /> {contRevisar} para revisar
                                    </span>
                                )}
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                                    {modulo.kpis.length} KPIs
                                </span>
                            </div>
                        </button>

                        {isOpen && (
                            <div style={{ padding: '0.5rem 1.5rem 1.5rem', borderTop: '1px solid var(--border)' }}>
                                {modulo.kpis.map(kpi => (
                                    <KPICard key={kpi.nome} kpi={kpi} />
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Rodapé informativo */}
            <div style={{
                marginTop: '1rem', padding: '1rem 1.5rem',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '0.75rem',
            }}>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    <strong style={{ color: 'var(--text-main)' }}>Como usar esta página:</strong> Revise cada KPI marcado como "Revisar" e confirme se a fórmula e os filtros aplicados estão corretos para a sua realidade. Se algum cálculo estiver errado, informe ao time técnico com o nome do KPI e qual seria o comportamento esperado.
                </p>
            </div>
        </div>
    );
};

export default DocumentacaoKPIs;
