const test = require('node:test');const assert = require('node:assert/strict');
const { lerLiquidoExplicito, valorApiParaNota } = require('../dist/services/valoresNfseCrm');
test('CSV só fornece líquido de coluna explícita e rejeita valor malformado',()=>{
 assert.equal(lerLiquidoExplicito({valor_dos_servicos:'2.098,93'}),null);
 assert.equal(lerLiquidoExplicito({valor_liquido_da_nota_fiscal:'1.969,85'}),1969.85);
 assert.equal(lerLiquidoExplicito({valor_liquido:'0,00'}),0);
 assert.throws(()=>lerLiquidoExplicito({valor_liquido:'não disponível'}));
 assert.throws(()=>lerLiquidoExplicito({valor_liquido:'10,00',valor_liquido_nfse:'20,00'}));
});
test('líquido da API só é associado pela identidade e por emissão válida',()=>{
 const csv={numero:'202500000002431',clienteDocumento:'60.691.250/0047-20'};
 const api={numero:'202500000002431',clienteDocumento:'60691250004720',status:'EMITIDA',valorLiquido:1969.85};
 assert.equal(valorApiParaNota(csv,api),1969.85);
 assert.equal(valorApiParaNota(csv,{...api,status:'CANCELADA'}),null);
 assert.equal(valorApiParaNota(csv,{...api,clienteDocumento:'outro'}),null);
 assert.equal(valorApiParaNota(csv,{...api,numero:'outra'}),null);
});
