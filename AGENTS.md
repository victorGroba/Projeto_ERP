# ca-bi-dashboard — Conta Azul BI (Laboratório Mattos & Mattos)

Dashboard financeiro/BI para o laboratório Mattos & Mattos (LabMattos), consumindo dados do Conta Azul e, para custeio laboratorial, do sistema Allims (LIMS).

## Stack
- Backend: Node/Express/TypeScript, Prisma ORM, SQLite.
- Frontend: Vite/React/TypeScript. Tailwind + shadcn/ui + Radix sendo adotados (fundação pronta, migração por fases — ver "Design system" abaixo).
- **Banco local de dev está sempre vazio.** Qualquer pergunta sobre dados reais se refere à produção na VPS.

## Produção (VPS)
- SSH alias: `vps-mcd` (78.142.242.82).
- Caminho: `/var/www/bi-financeiro-mattos/ca-bi-dashboard`.
- Container: `ca-bi-dashboard`.
- Deploy: `git pull && docker compose up -d --build`. O `Dockerfile` já roda `npx prisma db push --skip-generate && node dist/server.js` no start — schema aplica sozinho, **não existe `prisma/migrations/`**, não há passo manual de migração.
- Volume Docker real do banco: **`ca-bi-dashboard_ca-bi-data`** (prefixo do Compose com o nome da pasta do projeto) — NÃO é `ca-bi-data` puro. Usar o nome errado cria um volume vazio novo silenciosamente e gera backup "bem-sucedido" porém vazio.
- Após deploy, validar via `docker compose logs --tail N` (procurar "database already in sync" ou mensagem de sync, sem erros) e `docker ps --filter name=ca-bi-dashboard --format '{{.Status}}'` (deve mostrar "Up ...").
- Sempre confirmar com o usuário antes de push + deploy — nunca assumir.

## Regras de negócio — custeio laboratorial (módulo em construção, regras do Daniel/LabMattos)
- **Bruto fiscal (NFS-e) vs líquido (Conta Azul) nunca podem ser conflados** — são fontes e naturezas diferentes.
- Rateio de indiretos (Fase 4 do módulo): critério ainda **não definido pelo Daniel** — não inventar um critério, deixar bloqueado até ele decidir.
- Alíquota de imposto: sem fonte automática (nem Allims nem Conta Azul) — entrada manual via `ParametroCusto`, uma taxa geral simples. Não criar taxas por serviço a menos que o Daniel peça.
- Nome de serviço no catálogo Allims **não bate** com a nomenclatura "Serviço NN" usada no docx de precificação do Daniel — não cruzar automaticamente os nomes (decisão explícita do usuário); manter como entradas separadas até existir um de-para manual feito com o Daniel. Campo `nomeAllims` em `GrupoAnalitico` já existe para isso.
- Arquivos de referência do Daniel ficam em `arquivos-referencia-daniel-LabMattos/` (untracked de propósito — `.gitignore` já exclui `*.xlsx`/`*.xls`/`*.csv`).

## Integração Allims (LIMS)
- `Allims_API` (porta 80, servidor 192.168.1.171): binário fechado do fornecedor, sem fonte — não vale reverse-engineering.
- `allims-bi` (porta 3030, público em `https://bi.ti-labmattos.online`): painel interno com fonte legível (`/srv/allims-bi/server.js`), expõe `/api/status-ensaios`, `/api/determinacoes-por-setor`, `/api/financeiro/*`, `/api/crm/*`. Basic Auth (credenciais na nota privada "vps-ip-final-82" do Maestri, não repetir em notas compartilhadas). Números vêm como string, não number — atenção ao consumir.
- Postgres `ALLIMS` em 192.168.1.8 (legado 9.2 porta 5432 + principal 13 porta 5413). Usuário read-only `bi_readonly` existe mas senha pendente com o fornecedor.
- Workspace separado "LabMattos" (`~/projetos/CRM`, projeto `Projeto_GTS_CRM`) é a origem do logo/favicon da marca e pode futuramente reusar `/api/crm/*` do allims-bi — nada disso foi iniciado, só recrutar quando o usuário pedir explicitamente.

## Integração com o CRM (leitura)
- `GET /api/integracao/crm/faturamento?desde=AAAA-MM-DD` entrega o cadastro do Conta Azul (com `codigo` de grupo) e as NFS-e para a conferência "executado no Allims × faturado" do CRM do Laboratório Mattos & Mattos (`~/projetos/CRM/Projeto_GTS_CRM`, módulo Faturamento). Só leitura.
- Autenticação própria por token (`CRM_INTEGRACAO_TOKEN` no `backend/.env`), separada do JWT dos usuários; sem a variável a rota responde 503. O mesmo valor fica no CRM como `CA_BI_TOKEN`. Nunca repetir o valor em documentação.
- O grupo de cada nota é resolvido pela mesma regra da tela Clientes & Grupos (`construirIndiceClientes`, exportada de `clientesController.ts`) — mudar essa regra muda o que o CRM vê.

## Design system (em migração)
- Paleta petrol/graphite real da marca: `--primary:#0b6b76`, `--brand-teal:#3e93a0`, `--brand-graphite:#5b6268`; sinais `--success:#059669`/`--danger:#dc2626`/`--warning:#d97706` (cor de sinal, nunca cor de marca); fundo `--background:#eef3f3`, superfícies `--surface:#fff`; texto `--text-main`/`--text-muted`/`--text-subtle`; raios `--radius-sm:6px`/`--radius-md:10px`/`--radius-lg:14px`. Fontes: Manrope (display/números) + Inter (corpo).
- "Soft-UI": shell com cards flutuantes, hero com gradiente, contadores com count-up (`useCountUp`, respeita `prefers-reduced-motion`), ring de progresso circular, entrada suave de gráfico. Primitivas em `frontend/src/components/softUi.tsx` + `SoftUI.css`. Aplicado em quase todo o sistema — **exceto** Custeio Analítico (Equipamentos/Ensaios/Serviços — é CRUD de formulário/tabela, não dashboard de KPI).
- Tailwind + shadcn/ui + Radix: tokens em `tailwind.config.ts` apontam para as MESMAS custom properties do CSS legado (zero cor nova). Primitivas em `frontend/src/components/ui/`. Migração em fases, uma por vez com aprovação do usuário entre elas — não pular fase sem confirmar.
- `useCountUp` conflita com a animação de entrada própria do recharts (~60 re-renders/s travam o gráfico visualmente) — sempre desabilitar `isAnimationActive` do gráfico quando a mesma página também tem KPI com count-up.

## Convenção de comparação ano a ano
- Sempre que uma tela comparar o ano/período atual com o período correspondente do ano anterior (gráficos, tabelas, KPIs lado a lado), **o ano/período atual fica sempre à esquerda e o ano/período comparado (anterior) fica sempre à direita**. Padronizar em todas as telas que já têm ou vierem a ter esse tipo de comparação (ex.: Visão Geral, Relatório Anual, Clientes & Grupos, FilterBar com "Comparar com período anterior").

## Workflow de equipe (Maestri)
- Time Maestri ativo neste projeto: recrutas especialistas (ex.: backend/Prisma, UX/frontend React) conectados a este terminal.
- Antes de commitar o trabalho de um recruta: validar `git status --porcelain` contra o que ele reportou, rodar `npx tsc --noEmit` + build, inspecionar screenshots de antes/depois quando houver mudança visual.
- Recrutas nunca commitam — sempre o Maestro (eu) commita, com mensagem em português e co-autoria `Codex Sonnet 5 <noreply@anthropic.com>`.
- Push + deploy para a VPS sempre com confirmação explícita do usuário antes, nunca automático.
- Cuidado para não misturar trabalho não commitado de sessões diferentes — conferir diff arquivo a arquivo antes de `git add`, nunca `git add -A` às cegas.

## Manutenção deste arquivo
Manter este AGENTS.md atualizado conforme decisões de arquitetura, regras de negócio e descobertas operacionais relevantes forem surgindo — é a fonte de contexto que qualquer sessão nova do Codex deve conseguir ler sem depender de memória ou de um resumo de conversa longo.
