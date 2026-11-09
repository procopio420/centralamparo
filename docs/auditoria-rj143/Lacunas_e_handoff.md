# RJ-143 · Lacunas e reprodução

Data de referência: 09/11/2026. As lacunas abaixo descrevem o alcance desta coleta. A investigação pública permanece aberta.

| Questão em aberto | Documento e custodiante | Caminho já testado e resultado |
|---|---|---|
| Quanto foi pago por ano, com centavos? | DER e SEFAZ/RJ, extratos de NE, NL e OB, pagamentos e cancelamentos, inclusive restos a pagar de 2021–2026 | TFE Consulta Livre retornou página de bloqueio. A exportação CKAN do DER tem apenas o exercício 2024 no catálogo consultado, por NE e em reais inteiros. Ela não traz datas de OB. |
| Onde se gastou cada real? | DER DOC III, 5ª e 12ª ROC, boletins e memórias por item, ordens de serviço e coordenadas/estacas, notas fiscais, atestos e vínculos com NE/NL/OB | Cruzamento pelo processo de origem no CSV oficial. Não havia localização de itens ou ordens bancárias. Históricos de empenho são regionais ou estaduais. |
| As dívidas Terrasa foram pagas? | DER, SEI-330002/017350/2025, 018366/2025 e 017367/2025, decisões, NL e OB do exercício posterior | DOERJ 25/06/2025 p. 22 confirma três reconhecimentos. A consulta detalhada ao SEI e a conciliação bancária ficaram em aberto. |
| Onde ficam A/B e os 44,70 km pavimentados? | DER, SRE com eixo oficial, referência linear e histórico de superfície, revisões 2010–2026 | PDF estadual p. 3 é agregado. PDF DOC III p. 2 oferece divisões municipais, com diferença de 200 m. A consulta ArcGIS retornou coleção vazia e as requisições OSM não renderam cópia útil nesta rodada. |
| Pontes Multicon foram entregues e pagas? | DER, E-17/203.068/2012 e E-17/003.002167/2013, medições, termos de recebimento, empenhos e pagamentos | DOERJ 24/06/2013 p. 6 identifica as pontes e o aditivo. Faltam o contrato integral e o atesto. |
| Houve escória cedida e execução direta? | DER e municípios de Barra Mansa, Quatis e Barra do Piraí, termos de cessão, vales de pesagem, saídas de frota, ordens de serviço, combustível, apontamentos e horas de máquina | Imprensa de 12/09/2017 identifica cooperação estadual e três pontos recuperados. Portais municipais indexados trouxeram planos, mapas e referências ao corredor, sem os apontamentos. Mobilização de 2023 permanece pendente. |
| Quem assinou os serviços e quais eram os preços? | DER, contratos integrais, ART, designações subsequentes, assinaturas nos boletins, planilha de quantidades e BDI | Diário e CSV DOC III confirmam empresas, objetos e designações pontuais. Faltam documentos por serviço. Comparar com SICRO-RJ/EMOP/SINAPI apenas após obter código, unidade, data-base, BDI e transporte. |
| 036/2019 e possíveis financiamentos paralelos | DER, municípios, TCE-RJ, PNCP, Transferegov e ALERJ, instrumentos e planos de trabalho | Buscas indexadas combinando o número, EKO, RJ-143 e localidades não produziram vínculo verificável nesta rodada. Portal transacional e exportações municipais/federais ainda precisam de consulta sistemática. |

## Minutas para uso eventual

**DER-RJ.** Solicito cópia em formato aberto dos boletins de medição analíticos, ordens de serviço, memórias de cálculo e atestos dos contratos 037/2021, 012/2019 e 090/2022 referentes à RJ-143 entre o entroncamento com a RJ-159 em Quatis, Nossa Senhora do Amparo e o entroncamento com a RJ-141 em São José do Turvo, para 01/01/2021 a 09/11/2026. Informar, para cada item, serviço, unidade, quantidade, preço, km/estacas, data, fiscal, nota fiscal, NE, NL e OB, distinguindo glosas e reajustes. Solicito a série de versões do eixo calibrado da RJ-143 e do cadastro de revestimento por subtrecho de 2010 a 2026, com alterações documentadas, e a documentação do contrato 076/2012 relativa às duas pontes.

**SEFAZ/DER.** Solicito os registros contábeis de NE, NL e OB associados aos processos de origem SEI-330026/000006/2021, E-16/002/000841/2019 e SEI-160002/000258/2022 e aos três reconhecimentos da Terrasa de junho de 2025. Informar datas, valores brutos e líquidos, retenções, estornos e restos a pagar, preservando as chaves de ligação e omitindo dados bancários pessoais.

**Municípios e DER.** Solicito o histórico de intervenções diretas, cessões de material, convênios, máquinas e pessoal no corredor indicado. Para cada intervenção, informar local, data, ordem de serviço, quantidade, origem do material e custo registrado. Incluir os três pontos noticiados em setembro de 2017 e a mobilização relatada em fevereiro de 2023, se houver registros.

## Reprodução

1. Use o índice de evidências para recuperar as fontes originais. O SHA-256 identifica a cópia local quando disponível. Alguns espelhos foram consultados pela web e aparecem apenas por URL ou em extratos de consulta.
2. A API pública do CKAN foi consultada em `/api/3/action/package_show?id=situacao-da-rede-estadual` e `/api/3/action/package_search?fq=organization:der&rows=100`. O manifesto `fontes_download.tsv` enumera os recursos testados. Os PDFs foram extraídos com `pdftotext -layout`.
3. No CSV de execução do DER, filtre `processo_ne` pelos sufixos `000006/2021`, `000841/2019` e `000258/2022`. Confira `ne` única no exercício e some `despesas_pagas` conforme publicada. A coluna `registro_csv` é o número lógico do registro incluindo o cabeçalho.
4. O CSV contém NE agregadas. A coluna de data de pagamento permanece vazia. O zero publicado em NE individual não permite inferir gasto zero no trecho. Os atos com valores são mantidos em outra tabela e nunca somados às NE.
5. Execute `gerar.py` com Python e ReportLab, com a pasta de evidências ao lado. Para gerar o XLSX, execute `workbook.mjs` com o diretório de saída como argumento, em ambiente com `@oai/artifact-tool`. Abra `dashboard.html` diretamente no navegador para filtrar offline.
6. Retome pelo empenho RPX 2024NE01470, que menciona as medições 26–30 de reajuste, e pelos três processos Terrasa com relatórios conclusivos identificados. São os vínculos públicos mais específicos obtidos entre atos financeiros e grupos de medições.
