# Valores das notas no CRM

Correção: o bruto fiscal não deve substituir o líquido na comparação com o Conta Azul.

- `valorBruto` e o sinalizador legado `valorLiquido` permanecem compatíveis com consumidores antigos.
- O endpoint passa a entregar também `valorLiquidoFiscal` e `valorLiquidoContaAzul`, nullable e independentes. CSV e API são deduplicados, não somados como duas notas.
- O importador fiscal só preenche líquido de uma coluna explicitamente identificada no CSV. Não calcula imposto por alíquota. Campo ausente permanece null; arquivo com valor malformado ou colunas conflitantes é rejeitado.
- Líquido da API é vinculado por número da nota + documento do tomador no mesmo Conta Azul RJ. Status cancelado é excluído como antes.
- Notas antigas já importadas não recebem líquido por suposição. Reimportar o CSV original com coluna líquida ou completar o cache de API.

## Complementar histórico da API

`node scripts/completar-nfse-historico.cjs --desde 2025-01-01 --ate 2026-08-21`

Sem `--apply`, consulta/valida e conta, sem escrita. Com `--apply`, faz upsert só do cache local `NotaFiscalServicoApi`; não emite/cancela notas no Conta Azul e não altera o bruto fiscal. Backup SQLite consistente antes de aplicar. Usa access token já vigente; se expirar, aborta sem renovar OAuth em paralelo com o app. Divide por 15 dias, pagina e limita a taxa. Intervalo deve terminar antes da janela recente de 75 dias, para não competir com o sync regular. Mantém marcador próprio, sem fingir que a coleta recente acabou de atualizar.

## Validação

Caso LC ADM: bruto das notas 2431/2358/2301 = R$ 29.709,13; valores retornados pelo Conta Azul = R$ 27.882,01. Diferença não é corrigida aplicando percentuais. Testes cobrem leitura do CSV, identidade da nota, cancelamento e contrato do endpoint com SQLite de QA.

A frequência de coleta permanece a já configurada (2h por padrão); esta alteração corrige a base monetária, não promete atualização instantânea.

## Implantação concluída — 2026-11-05

Autorizada pelo usuário. Código 86a1f06 publicado, ambos os sistemas atualizados e histórico 2025-01-01 a 2026-08-21 completado com 4.158 registros da API. Renovação OAuth feita pela rotina normal do próprio app antes do complemento. Não foram emitidas/canceladas notas nem alterados os valores brutos do arquivo fiscal. Validação de produção confirmou LC ADM: bruto 29.709,13, líquido 27.882,01, três notas, sem duplicatas.

Backup consistente: /root/backups/faturamento-liquidos-20261105/bi-antes.sqlite; imagem anterior ca-bi-dashboard-app:pre-liquidos-20261105. A rotina recente permanece a cada 2h; não se trata de webhooks/tempo real.
