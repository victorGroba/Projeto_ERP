// Integração do importador/endpoint com SQLite descartável; bloqueia execução fora do QA.
const assert=require('node:assert/strict');const {PrismaClient}=require('@prisma/client');
assert.equal(process.env.DATABASE_URL,'file:/tmp/bi-liquidos-qa.db');
const {importarFaturamentoFiscal}=require('../dist/services/faturamentoFiscalService');
const {getFaturamentoParaCrm}=require('../dist/controllers/integracaoCrmController');
const p=new PrismaClient();
(async()=>{
 await p.notaFiscalServicoApi.deleteMany();
 await p.clienteContaAzul.upsert({where:{id:'qa-lc'},update:{},create:{id:'qa-lc',nome:'LC ADM QA',codigo:'LC ADM',documento:'60691250004720'}});
 const header='Tipo de Registro;Status da Nota Fiscal;Data de Cancelamento;N da Nota Fiscal Eletronica;Data Hora da Emissao da Nota Fiscal;Data de Competencia;Valor dos Servicos;Valor Liquido da Nota Fiscal;CPF CNPJ NIF do Tomador;Razao Social do Tomador;CPF CNPJ do Prestador';
 const rows=[['20','1','','202500000002431','09/12/2025 10:30:18','09/12/2025','2.098,93','1.969,85','60691250004720','LC ADM QA','01519348000152'],['20','1','','202500000002358','25/11/2025 10:30:18','25/11/2025','15.998,50','15.014,59','60691250004720','LC ADM QA','01519348000152'],['20','1','','202500000002301','18/11/2025 10:30:18','18/11/2025','11.611,70','10.897,57','60691250004720','LC ADM QA','01519348000152']];
 const csv=Buffer.from(header+'\n'+rows.map(r=>r.join(';')).join('\n'),'latin1');
 await importarFaturamentoFiscal(csv,'qa-nov-dez.csv');
 for(const [i,r] of rows.entries())await p.notaFiscalServicoApi.create({data:{id:'qa-'+i,numero:r[3],status:'EMITIDA',valorLiquido:[1969.85,15014.59,10897.57][i],dataCompetencia:new Date(i===0?'2025-12-09T12:00:00Z':i===1?'2025-11-25T12:00:00Z':'2025-11-18T12:00:00Z'),clienteNome:'LC ADM QA',clienteDocumento:'60691250004720'}});
 let data;
 await getFaturamentoParaCrm({query:{desde:'2025-01-01'}},{json:v=>{data=v},status:()=>({json:v=>{throw Error(JSON.stringify(v))}})});
 assert.equal(data.notas.length,3);
 assert.equal(Math.round(data.notas.reduce((s,n)=>s+n.valorBruto,0)*100),2970913);
 assert.equal(Math.round(data.notas.reduce((s,n)=>s+n.valorLiquidoContaAzul,0)*100),2788201);
 assert.equal(Math.round(data.notas.reduce((s,n)=>s+n.valorLiquidoFiscal,0)*100),2788201);
 await p.notaFiscalServicoApi.update({where:{id:'qa-0'},data:{status:'CANCELADA'}});
 await getFaturamentoParaCrm({query:{}},{json:v=>{data=v},status:()=>({json:()=>{throw Error('Falha no contrato')}})});
 assert.equal(data.notas.length,2);
 await p.notaFiscalServicoApi.update({where:{id:'qa-0'},data:{status:'EMITIDA'}});
 console.log(JSON.stringify({ok:true,csvLiquido:27882.01,apiLiquido:27882.01,bruto:29709.13,duplicatas:0,canceladaExcluida:true}));
})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(async()=>{await p.$disconnect();process.exit(process.exitCode||0)});
