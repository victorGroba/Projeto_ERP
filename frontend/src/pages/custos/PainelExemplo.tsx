import { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line 
} from 'recharts';
import { BarChart3, Beaker, FlaskConical, TestTube2, DollarSign, Calculator } from 'lucide-react';
import { mockCustosEnsaio, formatCurrency, getCustoTotal } from './painelExemploMock';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

// Protótipo com valores fixos. Será substituído pelo custo calculado a partir
// das fichas técnicas (fase 2) e pelo rateio de indiretos (fase 4).
export default function PainelExemplo() {
  const [inflacaoReagente, setInflacaoReagente] = useState<number>(0);
  const [aumentoDemanda, setAumentoDemanda] = useState<number>(0);

  // Visão Macro: Agrupar por Setor
  const dadosSetor = useMemo(() => {
    const agrupado = mockCustosEnsaio.reduce((acc, curr) => {
      if (!acc[curr.setor]) acc[curr.setor] = 0;
      acc[curr.setor] += getCustoTotal(curr);
      return acc;
    }, {} as Record<string, number>);

    return Object.keys(agrupado).map(setor => ({
      name: setor,
      value: agrupado[setor]
    }));
  }, []);

  // Visão Micro: Top 5 Custos de Ensaios
  const topCustos = useMemo(() => {
    return mockCustosEnsaio
      .map(e => ({
        name: e.ensaio,
        custoTempo: (e.tempoGasto / 60) * e.custoHoraAnalista,
        custoReagente: e.custoReagente,
        custoCQ: e.custoCQ,
        total: getCustoTotal(e)
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, []);

  // Predição: Simulador What-If
  const dadosSimulacao = useMemo(() => {
    // Vamos simular a evolução de 6 meses
    const meses = ['Mês 1', 'Mês 2', 'Mês 3', 'Mês 4', 'Mês 5', 'Mês 6'];
    const custoBaseMensal = mockCustosEnsaio.reduce((acc, curr) => acc + (getCustoTotal(curr) * 100), 0); // Supondo 100 amostras/mês

    return meses.map((mes, index) => {
      // Aplica o fator de inflação gradativamente (diluido em 6 meses)
      const fatorInflacao = 1 + ((inflacaoReagente / 100) * (index / 5));
      // Aplica o fator de aumento de demanda
      const fatorDemanda = 1 + ((aumentoDemanda / 100) * (index / 5));
      
      const custoComposto = custoBaseMensal * fatorDemanda;
      
      // Inflaciona apenas a parte de reagentes e CQ (simplificação)
      const propReagentes = 0.4; // 40% do custo é material
      const custoFinal = (custoComposto * (1 - propReagentes)) + (custoComposto * propReagentes * fatorInflacao);

      return {
        mes,
        CustoPrevisto: Math.round(custoFinal),
        CustoBase: Math.round(custoBaseMensal)
      };
    });
  }, [inflacaoReagente, aumentoDemanda]);


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '2rem' }}>
      
      {/* Header KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ backgroundColor: 'var(--primary-light)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
            <DollarSign size={24} color="var(--primary)" />
          </div>
          <div>
            <h3 style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Custo Médio por Análise</h3>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
              {formatCurrency(mockCustosEnsaio.reduce((a,b) => a + getCustoTotal(b), 0) / mockCustosEnsaio.length)}
            </p>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ backgroundColor: 'var(--success-light)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
            <FlaskConical size={24} color="var(--success)" />
          </div>
          <div>
            <h3 style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Setor Mais Oneroso</h3>
            <p style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Físico-Química</p>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ backgroundColor: 'var(--warning-light)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
            <TestTube2 size={24} color="var(--warning)" />
          </div>
          <div>
            <h3 style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Maior Ofensor (Reagente)</h3>
            <p style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>DQO MM</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Gráfico 1: Macro - Setores */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Beaker size={20} color="var(--text-muted)"/>
            <h2>Distribuição de Custos por Setor</h2>
          </div>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dadosSetor}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {dadosSetor.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(val: number | undefined) => formatCurrency(val ?? 0)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Micro - Top 5 Ensaios */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <BarChart3 size={20} color="var(--text-muted)"/>
            <h2>Top 5 Análises mais Custosas (Micro-custeio)</h2>
          </div>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topCustos} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} />
                <Tooltip formatter={(val: number | undefined) => formatCurrency(val ?? 0)} />
                <Legend />
                <Bar dataKey="custoReagente" name="Reagente (R$)" stackId="a" fill="#3b82f6" />
                <Bar dataKey="custoTempo" name="Tempo Analista (R$)" stackId="a" fill="#10b981" />
                <Bar dataKey="custoCQ" name="Controle Qualidade (R$)" stackId="a" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Seção 3: Simulador What-If (Predição) */}
      <div className="card" style={{ borderTop: '4px solid var(--primary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <Calculator size={20} color="var(--primary)"/>
          <h2>Simulador de Cenários Financeiros (What-If)</h2>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '2rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', backgroundColor: 'var(--surface-hover)', padding: '1.5rem', borderRadius: 'var(--radius-md)' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                Inflação de Reagentes (%)
              </label>
              <input 
                type="range" min="0" max="100" step="1" 
                value={inflacaoReagente} 
                onChange={(e) => setInflacaoReagente(Number(e.target.value))}
                style={{ width: '100%', marginBottom: '0.25rem' }}
              />
              <div style={{ textAlign: 'right', fontSize: '1.125rem', fontWeight: 'bold', color: 'var(--danger)' }}>
                +{inflacaoReagente}%
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                Aumento Volume Analítico (%)
              </label>
              <input 
                type="range" min="0" max="50" step="1" 
                value={aumentoDemanda} 
                onChange={(e) => setAumentoDemanda(Number(e.target.value))}
                style={{ width: '100%', marginBottom: '0.25rem' }}
              />
              <div style={{ textAlign: 'right', fontSize: '1.125rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                +{aumentoDemanda}%
              </div>
            </div>
            
            <div style={{ marginTop: 'auto', padding: '1rem', backgroundColor: 'var(--background)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Mova os controles deslizantes para simular o impacto financeiro cumulativo no laboratório nos próximos 6 meses.
              </p>
            </div>
          </div>

          <div style={{ height: 350 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dadosSimulacao} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis tickFormatter={(val) => `R$ ${val/1000}k`} />
                <Tooltip formatter={(val: number | undefined) => formatCurrency(val ?? 0)} />
                <Legend />
                <Line type="monotone" dataKey="CustoBase" name="Projeção Atual (Sem Alterações)" stroke="#94a3b8" strokeDasharray="5 5" strokeWidth={2} />
                <Line type="monotone" dataKey="CustoPrevisto" name="Custo Simulado (Predição)" stroke="#2563eb" strokeWidth={3} dot={{ r: 6 }} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

    </div>
  );
}
