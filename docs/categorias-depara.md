# De-para de categorias — plano de contas 2025 → 2026

**Status: proposta para revisão. Nada foi aplicado no sistema.**

Entre 2025 e 2026 o plano de contas foi reescrito: nomes abreviados, ponto virou
vírgula (`Honorários Contábeis` → `Honor, Contábeis`), e vários agrupamentos
mudaram. Como os relatórios comparam rubrica contra rubrica pelo nome, hoje a
mesma despesa aparece duas vezes — uma "encerrada" em 2025 e uma "nova" em 2026 —
e o ranking de ofensores fica inutilizável.

## Como esta lista foi montada

Comparei **jan–jul de 2025 contra jan–jul de 2026** (janelas iguais; ver ressalva
no fim). Cruzei as 62 categorias que desapareceram com as 48 que surgiram usando
similaridade de texto, e depois **revisei manualmente** — o algoritmo acertou a
maioria mas errou feio em alguns casos, que estão corrigidos na seção B.

Legenda da coluna decisão: `OK` = pode aplicar · `?` = precisa de confirmação.

---

## A. Renomeações evidentes — recomendo aplicar

| 2025 (antiga) | 2026 (nova) | jan–jul 25 | jan–jul 26 | Decisão |
|---|---|---:|---:|---|
| Salários | Salários Pessoal | 656.274 | 668.371 | OK |
| Vale-Transporte | Vale Transporte | 126.134 | 102.747 | OK |
| Vale-Alimentação | Vale Alimentação | 124.687 | 129.893 | OK |
| Férias | Férias Pessoal | 58.009 | 40.054 | OK |
| Rescisões | Rescisões Pessoal | 35.651 | 9.834 | OK |
| Confraternizações | Confraternizações Divs | 1.770 | 1.593 | OK |
| Pis S/Faturamento - Cod. 8109 | Pis S/Faturamento - Cod, 8109 | 672 | 1.540 | OK |
| Entidades e Associações | Associações/Entidades | 3.616 | 5.264 | OK |
| Cursos e Treinamentos | Treinamentos e Cursos | 18.827 | 1.131 | OK |
| Marketing e Publicidade | Publicidade Marketing | 8.640 | 6.000 | OK |
| Plano de Saúde Colaboradores | Pl, Saúde Colaboradores | 47.001 | 48.876 | OK |
| Plano Odontológico Colaboradores | Pl, Odonto Colaboradores | 9.888 | 10.675 | OK |
| Retenção Contratual - Petrobrás | Retenção Contr, Petrobras | 997 | 207 | OK |
| Taxas e Licenças | Licenças/Taxas | 15.808 | 23.287 | OK |
| Consignados CLT | Consignados Pessoal | 638 | 30.805 | OK |
| Segurança do Trabalho | Seg, do Trabalho | 1.967 | 4.075 | OK |
| Seguro de Vida | Seg, de Vida | 3.916 | 4.301 | OK |
| Honorários Contábeis | Honor, Contábeis | 26.300 | 26.492 | OK |
| Manutenção Predial | Manut, Predial | 11.768 | 58.517 | OK |
| Condomínio | Condomínio/Taxas Pred | 4.703 | 3.084 | OK |
| Honorários Advocatícios | Honor, Advogados | 42.000 | 76.000 | OK |
| Aluguel | Aluguel de Imóveis | 30.329 | 31.195 | OK |
| Consultoria Técnica | Consultoria Técnica Vendas | 98.900 | 135.624 | OK |
| IPTU | I,P,T,U, | 13.388 | 14.085 | OK |
| FGTS e Multa de FGTS | FGTS Pessoal | 78.337 | 68.897 | OK |
| Materiais/Serviços Aplicados - Físico /Químico | Custos Insumos - Físico Químico | 75.279 | 3.370 | OK |
| Materiais/Serviços Aplicados - Operacional | Custos Insumos - Operacional | — | 3.012 | OK |

### Fusões (várias antigas → uma nova)

| 2025 (antigas) | 2026 (nova) | Decisão |
|---|---|---|
| Despesas C/ Coletas - Consultoras · Consultora · **Cunsultora** (typo) | Coletas - Consultoras | OK |
| Despesas C/ Coletas - Custos · Despesas C/ Coletas | Coletas - Custos | OK |
| DARF 2089 (com espaço no fim) · IRPJ - DARF 2372 | IRPJ-DARF-2089 | ? ver seção C |
| Retenção - Darf 5952 - PIS/COFINS/CSLL · PIS/COFINS/CSLL | PIS/COFINS/CSLL-DARF5952 | OK |

---

## B. O algoritmo errou — corrigido por mim

Estes são os casos onde a semelhança de texto enganou. **Os dois primeiros são os
mais importantes da lista inteira**, por causa do valor envolvido.

| 2025 | Palpite errado do algoritmo | Par correto | Valor |
|---|---|---|---:|
| Materiais/Serviços Aplicados - Lab Microbiologia | ~~Transporte Mats Adquiridos-Microbiologia~~ | **Custos Insumos - Microbiologia** | 645.756 → 530.315 |
| INSS sobre Salários - GPS | ~~Salários Pessoal~~ | **INSS Patronal** | 257.085 → 287.835 |
| Viagens e Representações | ~~Associações/Entidades~~ | **Viagens / Hospedagem** | 2.318 → 2.602 |
| Exames Médicos | — | **Exames Admissionais** | 4.840 → 6.428 |
| Compra | — | **Compras a Classificar** | 73.970 → 103.971 |
| Remuneração de Estagiários | — | **Remun, Estágiarios** | 333 → 1.433 |
| Impostos sobre Aplicações | — | **Tribut, Aplic, Financeiras** | 787 → 47 |
| Honorários Consultoria | ~~Coletas - Consultoras~~ | **Consult, Tec, Adm,** | 26.360 → 40.864 |

E estes o algoritmo emparelhou, mas **estão errados e não têm par** — são rubricas
distintas que ele juntou só porque o nome se parece:

- `Seguro de Imóveis` → ~~Aluguel de Imóveis~~ (seguro ≠ aluguel)
- `SEGUROS` → ~~Juros~~
- `Cofins S/Faturamento - Código 2172` → ~~Pis S/Faturamento~~ (COFINS ≠ PIS)
- `IRRF s/ Salários - DARF 0561` → ~~Salários Pessoal~~ (retenção ≠ folha)
- `Tarifas PIX` → ~~Tarifas de Boletos~~

---

## C. Precisam da sua confirmação (ou do financeiro)

| Caso | Pergunta objetiva | Valor em jogo |
|---|---|---:|
| `Fretes pagos` sumiu | Foi absorvido por `Transporte Mats Adquiridos-Microbiologia`? Os valores não batem (156.855 → 3.727), então ou virou outra coisa ou o gasto realmente parou. | 156.855 |
| `DARF 2089` + `IRPJ - DARF 2372` → `IRPJ-DARF-2089` | Os dois códigos de DARF foram unificados numa só rubrica, ou o 2372 virou outra coisa? | 422.817 |
| `Software / Licença de Uso` sumiu | Foi para `Licenças/Taxas` (que já recebe `Taxas e Licenças`), ou parou? | 22.959 |
| `Vigilância e Segurança Patrimonial` | Em 2026 existem **duas**: `Vig, Patrimonial` (203) e `Seg, Patrimonial` (92). A antiga foi dividida? Qual recebe o histórico? | 1.372 |
| `Veículos` sumiu | Virou `Combustíveis`? Os valores não batem (23.100 → 223). | 23.100 |
| `Empréstimo - Carmen Mattos` sumiu | Encerrou ou mudou de nome? | 23.877 |
| `SEGUROS` sumiu | Foi dividido em `Seg, de Vida` / `Seg, do Trabalho` / `Seg, Patrimonial`? | 1.261 |

---

## D. Provavelmente encerradas de verdade (sem par, valor baixo)

`Multas de Trânsito` · `Retenção - ISS pelo Tomador` · `Gratificações` ·
`Descontos incondicionais obtidos` · `Auditoria Iso` · `Outras Imobilizações por
Aquisição` · `Juros Conta Garantida` · `Construções em Andamento - Imóvel
Próprio` · `Telefonia Móvel` · `Seguro Garantia` · `IRRF` · `ISS`

## E. Provavelmente novas de verdade

`ISS - Depósito Judicial` (65.999) · `Pensões Alimentícias` (1.315) ·
`Lanches e Refeições` (45) · `Juros` (69) · `Tarifas de Boletos` (78)

---

## Ressalva importante sobre o período de comparação

Os dados de 2026 vão até **julho**. Comparar "Ano completo 2026" contra "Ano
completo 2025" põe 7 meses contra 12 e distorce tudo:

| Comparação | Resultado |
|---|---|
| Ano cheio 2025 vs "ano cheio" 2026 (7 meses) | despesa **−21,0%** |
| jan–jul 2025 vs jan–jul 2026 (janelas iguais) | despesa **+6,9%** |

São conclusões opostas. A leitura correta é a segunda. A aba `/indices` já abre
em "Ano até hoje", que é comparável; o `/resultados` abre em "Ano completo" e
deveria mudar para o mesmo padrão.