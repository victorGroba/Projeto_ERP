const test = require('node:test');const assert = require('node:assert/strict');
const { distribuirParcelaPorRateio } = require('../dist/services/rateioDespesas');
// Parcela 4/4 da compra NFe 371355-3 (CAP-LAB, paga 12/11/2026): evento de R$ 20.340,92, parcela de R$ 5.085,23.
const rateio = [
 { nome_categoria:'Custos Insumos - Físico Químico', valor:3998.19, rateio_centro_custo:[{nome_centro_custo:'Laboratório Físico / Químico',valor:3998.19}] },
 { nome_categoria:'Custos Insumos - Microbiologia', valor:15992.77, rateio_centro_custo:[{nome_centro_custo:'Laboratório Microbiologia',valor:15992.77}] },
 { nome_categoria:'Transporte Mats Adquiridos-Microbiologia', valor:349.96, rateio_centro_custo:[{nome_centro_custo:'Laboratório Microbiologia',valor:349.96}] },
];
const soma = linhas => Math.round(linhas.reduce((s,l)=>s+l.valor,0)*100)/100;
test('parcela é distribuída proporcionalmente ao rateio do evento',()=>{
 assert.deepEqual(distribuirParcelaPorRateio(5085.23,rateio),[
  {categoria:'Custos Insumos - Físico Químico',centroDeCusto:'Laboratório Físico / Químico',valor:999.55},
  {categoria:'Custos Insumos - Microbiologia',centroDeCusto:'Laboratório Microbiologia',valor:3998.19},
  {categoria:'Transporte Mats Adquiridos-Microbiologia',centroDeCusto:'Laboratório Microbiologia',valor:87.49},
 ]);
});
test('centavos de arredondamento vão para a última linha',()=>{
 const linhas = distribuirParcelaPorRateio(100,[{nome_categoria:'A',valor:1,rateio_centro_custo:[{nome_centro_custo:'X',valor:1},{nome_centro_custo:'Y',valor:1},{nome_centro_custo:'Z',valor:1}]}]);
 assert.deepEqual(linhas.map(l=>l.valor),[33.33,33.33,33.34]);
 assert.equal(soma(linhas),100);
});
test('categoria sem rateio de CC vira "Sem centro de custo" com o peso da categoria',()=>{
 const linhas = distribuirParcelaPorRateio(50,[{nome_categoria:'A',valor:30,rateio_centro_custo:[{nome_centro_custo:'X',valor:30}]},{nome_categoria:'B',valor:70}]);
 assert.deepEqual(linhas,[{categoria:'A',centroDeCusto:'X',valor:15},{categoria:'B',centroDeCusto:'Sem centro de custo',valor:35}]);
});
test('sem rateio utilizável devolve null (fallback)',()=>{
 assert.equal(distribuirParcelaPorRateio(10,undefined),null);
 assert.equal(distribuirParcelaPorRateio(10,[]),null);
 assert.equal(distribuirParcelaPorRateio(10,[{nome_categoria:'A',valor:0}]),null);
});
