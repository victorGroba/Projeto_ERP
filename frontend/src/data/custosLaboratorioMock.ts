export interface CustoEnsaio {
  ensaio: string;
  setor: string;
  tempoGasto: number;
  custoHoraAnalista: number;
  custoReagente: number;
  custoCQ: number;
}

export const mockCustosEnsaio: CustoEnsaio[] = [
  { ensaio: 'Nitrito MM', setor: 'Inorgânicos', tempoGasto: 10, custoHoraAnalista: 25.0, custoReagente: 1.5, custoCQ: 1.0 },
  { ensaio: 'Sulfato MM', setor: 'Inorgânicos', tempoGasto: 15, custoHoraAnalista: 25.0, custoReagente: 2.5, custoCQ: 1.5 },
  { ensaio: 'Sulfeto MM', setor: 'Inorgânicos', tempoGasto: 12, custoHoraAnalista: 25.0, custoReagente: 1.8, custoCQ: 1.0 },
  { ensaio: 'DBO MM', setor: 'Físico-Química', tempoGasto: 30, custoHoraAnalista: 25.0, custoReagente: 5.0, custoCQ: 2.5 },
  { ensaio: 'DQO MM', setor: 'Físico-Química', tempoGasto: 40, custoHoraAnalista: 25.0, custoReagente: 8.0, custoCQ: 3.5 },
  { ensaio: 'Alcalinidade', setor: 'Físico-Química', tempoGasto: 5, custoHoraAnalista: 25.0, custoReagente: 0.5, custoCQ: 0.5 },
  { ensaio: 'Ferro Total', setor: 'Metais', tempoGasto: 20, custoHoraAnalista: 30.0, custoReagente: 3.0, custoCQ: 2.0 },
  { ensaio: 'Cobre', setor: 'Metais', tempoGasto: 18, custoHoraAnalista: 30.0, custoReagente: 2.8, custoCQ: 2.0 },
  { ensaio: 'Zinco', setor: 'Metais', tempoGasto: 15, custoHoraAnalista: 30.0, custoReagente: 2.5, custoCQ: 1.8 }
];

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export const getCustoTotal = (ensaio: CustoEnsaio) => {
  const custoTempo = (ensaio.tempoGasto / 60) * ensaio.custoHoraAnalista;
  return custoTempo + ensaio.custoReagente + ensaio.custoCQ;
};
