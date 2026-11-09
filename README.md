# Central Amparo · RJ-143

Portal cívico para Quatis–Amparo e Amparo–São José do Turvo. A [auditoria documental](docs/auditoria-rj143/README.md) fundamenta as informações públicas.

## Rodar localmente

Requer Node.js 24. A aplicação usa Node HTTP e SQLite nativos.

```sh
export ADMIN_KEY="$(openssl rand -hex 32)"
npm start
```

Abra http://localhost:3000 e entre em /admin com a chave gerada. Para mudar o endereço, ajuste PORT e PUBLIC_ORIGIN juntos. O banco local fica em data/. Rode `npm test` para verificar o ciclo de vida dos relatos e compromissos.

## Deploy

O Dockerfile e railway.toml definem o serviço e a verificação em /health. Use uma réplica, HTTPS e um volume persistente montado em /data. Configure:

| Variável | Valor |
| --- | --- |
| NODE_ENV | production |
| DATA_DIR | /data |
| PUBLIC_ORIGIN | URL HTTPS canônica, sem barra no fim |
| ADMIN_KEY | Segredo forte, com pelo menos 32 caracteres |
| PRIVACY_CONTACT | Canal institucional de privacidade, opcional. O próprio portal aceita pedidos de remoção pelo protocolo. |
| TRUST_PROXY | Use 1 somente se o proxy confiável acrescenta o IP do cliente ao fim de X-Forwarded-For e não há acesso direto ao servidor. |

Mantenha a chave em um gerenciador de segredos. A troca da chave invalida sessões. Sessões expiram em 30 minutos. Faça backups com a API de backup do SQLite ou com o serviço parado e teste restauração. A aplicação usa WAL e guarda o banco e arquivos auxiliares no volume. Antes de divulgar a URL, teste o fluxo em HTTPS e exclua os registros de teste.

## Operação

1. O formulário gera protocolo aleatório e registra separadamente versão do aviso de privacidade, permissão de encaminhamento e aceite de atualizações.
2. Em /admin, confira o relato bruto. Para publicar, redija título, descrição e referência pública, revise o link e marque a confirmação de que removeu dados pessoais. O protocolo, o texto bruto e o contato ficam fora da API pública.
3. Registre encaminhamentos somente depois do envio manual e com autorização registrada. O portal apenas grava status e nota.
4. Registre pedidos como reivindicações. Para compromisso assumido, informe responsável, fonte pública HTTPS e data. Informe prazo somente se documentado. A interface mostra o histórico de alterações de registros ativos. Arquivar retira o item e seu histórico do painel público e preserva a trilha interna.
5. Pedidos de remoção aparecem no histórico da moderação. Confira o protocolo e use a exclusão no relato. A exclusão remove também a ficha pública e o histórico do relato no banco ativo. Restrinja exportações e backups a operadores autorizados.

O modelo tem tabelas de relatos privados, compromissos, histórico e rate limiting. A projeção pública de um relato é armazenada separadamente dos campos originais. O SQLite atende o MVP com uma réplica e volume. O mapa inicial é esquemático e localiza pontos por trecho e referência textual. A base da auditoria tem geometria nula e ainda não sustenta pinos georreferenciados. A semente usa fatos e uma reivindicação editorial documentada. Pontos críticos aguardam relatos e revisão.

Upload, envio de notificações, contas individuais de moderador e um mapa georreferenciado ficam para uma próxima etapa. O campo de evidência recebe links públicos revisados.

## Vídeo de campanha · 40 s

| Tempo | Quadro | Narração |
| --- | --- | --- |
| 0–8 s | Placa RJ-143 e imagens documentais autorizadas, com data e local na tela | A estrada precisa avançar. As respostas também. |
| 8–17 s | Trajeto esquemático Quatis, Amparo e Turvo | Quem usa essa estrada para trabalhar, estudar ou buscar atendimento precisa de passagem segura. |
| 17–30 s | Recorte do dossiê com a distinção entre contratos amplos e o trecho local | Existem registros de gastos estaduais e regionais. Quanto chegou a estes trechos? A documentação ainda não permite responder. |
| 30–40 s | Formulário, protocolo e painel de prazos | Registre o problema, guarde seu protocolo e acompanhe as respostas. Queremos passagem segura, solução duradoura e prazos públicos. |

A ilustração vetorial do hero e o esquema de trechos servem de base para motion graphics. Cenas sintéticas, se usadas, devem receber indicação de conteúdo ilustrativo na tela. Imagens documentais devem passar por revisão de origem, local, data e dados identificáveis.
