/* Completa o cache de NFS-e antigas por leitura da API. Não emite/cancela notas.
 * Uso: node scripts/completar-nfse-historico.cjs --desde 2025-01-01 --ate 2026-08-21 [--apply]
 * Sem --apply: consulta e conta; não escreve. Não renova OAuth em processo paralelo.
 */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const arg = name => process.argv[process.argv.indexOf(name) + 1];
const date = s => {
 if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '') || new Date(s).toISOString().slice(0,10) !== s) throw Error('Data inválida');
 return new Date(s + 'T00:00:00Z');
};
(async () => {
 const inicio = date(arg('--desde')), fim = date(arg('--ate'));
 if (fim < inicio || fim > new Date() || (fim-inicio)/86400000 > 1100) throw Error('Intervalo inválido');
 const cfg = await p.appConfig.findUnique({ where: { key: 'access_token_rj' } });
 if (!cfg?.value) throw Error('Credencial de consulta indisponível');
 const itens = new Map();
 for (let de = inicio; de <= fim; de = new Date(+de + 15*86400000)) {
  const ate = new Date(Math.min(+fim, +de + 14*86400000));
  for (let pagina = 1; pagina <= 1000; pagina++) {
   const qs = new URLSearchParams({ data_competencia_de: de.toISOString().slice(0,10), data_competencia_ate: ate.toISOString().slice(0,10), pagina: String(pagina), tamanho_pagina: '100' });
   const res = await fetch('https://api-v2.contaazul.com/v1/notas-fiscais-servico?'+qs, { headers: { Authorization: 'Bearer '+cfg.value, Accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
   if (!res.ok) throw Error('Consulta histórica respondeu HTTP '+res.status+'; nenhuma renovação OAuth solicitada');
   const r = await res.json();
   if (!Array.isArray(r.itens)) throw Error('Resposta histórica incompleta');
   for (const n of r.itens) {
    const valor = Number(n.valor_total_nfse);
    if (!n.id || n.numero_nfse == null || n.valor_total_nfse == null || !Number.isFinite(valor) || valor < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(n.data_competencia || '')) throw Error('Nota com campos inválidos na API');
    const raw = n.informacao_transmissao?.data_inicio_emissao;
    const emissao = raw ? new Date(/Z$|[+-]\d\d:\d\d$/.test(raw) ? raw : raw+'-03:00') : null;
    if (emissao && !Number.isFinite(+emissao)) throw Error('Data de emissão inválida na API');
    itens.set(String(n.id), { numero: String(n.numero_nfse), status: String(n.status || ''), valorLiquido: valor,
     dataCompetencia: new Date(n.data_competencia+'T12:00:00Z'), dataEmissao: emissao,
     clienteNome: String(n.nome_cliente || ''), clienteDocumento: String(n.documento_cliente || '').replace(/\D/g,''),
     numeroVenda: n.numero_venda != null ? String(n.numero_venda) : null, cidadeEmissao: n.cidade_emissao?.nome || null, ufEmissao: n.cidade_emissao?.estado || null });
   }
   await new Promise(r => setTimeout(r, 350));
   if (!r.itens.length || (r.paginacao?.total_paginas != null ? pagina >= r.paginacao.total_paginas : r.itens.length < 100)) break;
   if (pagina === 1000) throw Error('Paginação histórica excedeu o limite');
  }
 }
 const apply = process.argv.includes('--apply');
 if (apply) {
  const todos = [...itens];
  for(let i=0;i<todos.length;i+=100) await p.$transaction(todos.slice(i,i+100).map(([id,data]) => p.notaFiscalServicoApi.upsert({ where:{id}, create:{id,...data}, update:data })));
  const value=JSON.stringify({ em:new Date().toISOString(), desde:arg('--desde'), ate:arg('--ate'), notas:itens.size });
  await p.appConfig.upsert({where:{key:'nfse_api_historico'},create:{key:'nfse_api_historico',value},update:{value}});
 }
 console.log(JSON.stringify({ applied:apply, notas:itens.size, desde:arg('--desde'), ate:arg('--ate'), somenteCacheLocal:true }));
})().catch(e=>{ console.error(e.message);process.exitCode=1 }).finally(()=>p.$disconnect());
