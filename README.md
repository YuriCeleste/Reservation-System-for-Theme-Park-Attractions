# 🎡 Parque do Terror

Sistema de reservas e filas virtuais para as atrações de um parque temático de terror. Visitantes se cadastram, escolhem uma atração e um horário e entram em uma fila virtual específica. Quem tem ingresso **VIP** passa na frente dos ingressos normais nas atrações que possuem fila prioritária. A equipe do parque acompanha as filas, chama as sessões e consulta as métricas do dia.

Projeto de **Algoritmos e Estruturas de Dados** (IFPE Campus Igarassu), feito em dupla. O núcleo da aplicação são **listas encadeadas implementadas do zero**; o SQLite cuida apenas da persistência.

## Sumário

- [Arquitetura](#arquitetura)
- [Funcionalidades](#funcionalidades)
- [Tecnologias](#tecnologias)
- [Como executar](#como-executar)
- [Persistência e o "SGBD rodando"](#persistência-e-o-sgbd-rodando)
- [Listas encadeadas](#listas-encadeadas)
- [Regras de negócio](#regras-de-negócio)
- [Telas e rotas](#telas-e-rotas)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Modelo de dados](#modelo-de-dados)
- [Testes](#testes)
- [Decisões de projeto](#decisões-de-projeto)
- [Limitações conhecidas](#limitações-conhecidas)
- [Equipe](#equipe)

## Arquitetura

```
Telas (EJS) ─► server.js (rotas) ─► Parque ─► listas encadeadas   ← núcleo: guardam e operam os dados
                                       │
                                       └──► Repositorio ─► SQLite ← persistência
```

- Os dados principais (atrações, visitantes, histórico, sessões e filas) vivem em **listas duplamente encadeadas** em memória. Buscas, inserções, remoções, movimentações e ordenações são feitas por nós e ponteiros, sem `Array`, `Map` ou `Set` guardando os dados.
- O **`Parque`** concentra as regras de negócio e recebe um `Repositorio` por injeção, como o `Relogio`. Depois de cada mudança, ele avisa o repositório.
- Ao iniciar, o `Parque` **reconstrói as listas e as filas** a partir do banco (`carregar()`).
- Arrays só aparecem na fronteira: ao entregar dados às telas e ao ler as linhas do banco.

## Funcionalidades

- **Cadastro de atrações:** nome, tipo, capacidade por sessão, idade mínima, horários e fila VIP.
- **Cadastro de visitantes:** dados pessoais e ingresso Normal ou VIP (o VIP exige um cartão de crédito).
- **Painel do visitante:** posição em cada fila, atrações com horários e tamanho das filas, entrada na fila e histórico com data/hora de entrada e embarque.
- **Painel do parque:** pessoas na fila por atração, próximos a embarcar com a posição e o botão **EMBARCAR**.
- **Métricas do dia:** reservas (comuns x VIP), atração mais disputada e visitante do dia.
- **Créditos** da equipe.

## Tecnologias

| Camada | Tecnologia |
| --- | --- |
| Servidor | Node.js + Express 4 |
| Páginas | EJS (renderização no servidor, sem build) |
| Persistência | SQLite via `better-sqlite3` |
| Estilo | CSS puro (fontes Cinzel e IBM Plex Sans, via Google Fonts) |
| Dados em memória | Lista duplamente encadeada própria |
| Testes | `node --test` (nativo do Node, sem dependências) |

## Como executar

**Pré-requisitos:** Node.js 22 ou superior (testado nas versões 22 e 24) e npm. As fontes vêm do Google Fonts, então o visual completo precisa de internet.

```bash
npm install
npm run seed      # dados de exemplo (opcional)
npm start         # http://localhost:3000
```

| Comando | O que faz |
| --- | --- |
| `npm start` | Inicia o servidor. Carrega do banco o que estiver gravado. |
| `npm run demo` | Inicia o servidor **ignorando a hora real**: todos os horários ficam abertos. Ideal para apresentar fora do horário das sessões. |
| `npm run seed` | Cria atrações, visitantes e reservas de exemplo **se o banco estiver vazio**. |
| `npm run seed:limpo` | Apaga o banco e cria os dados de exemplo de novo. |
| `npm test` | Roda todos os testes. |

O banco é o arquivo `parque.db`, criado automaticamente. Para usar outro, defina `PARQUE_DB` (por exemplo, `PARQUE_DB=/tmp/teste.db npm start`). A variável `PORT` muda a porta.

**Dados de exemplo:** 4 atrações (Trem do Terror, Cada Mal Assombrada, Montanha-Russa Maldita e Labirinto dos Sussurros) e 9 visitantes, incluindo VIPs e uma criança de 10 anos, para mostrar o botão desabilitado por idade mínima. Parte das reservas já aparece como concluída, para o histórico não ficar vazio.

## Persistência e o "SGBD rodando"

A persistência é feita em **SQLite**, um banco **relacional** embutido. Ele roda **dentro do próprio processo da aplicação**: não há servidor de banco para instalar, configurar ou subir antes da apresentação. Enquanto o `npm start` está rodando, o banco está rodando.

- **Reiniciar o servidor mantém tudo:** visitantes, atrações, filas (com a ordem e a prioridade VIP) e histórico.
- **A troca de banco é isolada:** a interface `Repositorio` esconde o SQLite do resto do sistema. Trocar por MySQL exigiria só uma nova implementação (`RepositorioMysql`), sem mexer no `Parque`.
- **O número do cartão nunca é gravado:** só a bandeira e os 4 últimos dígitos.

## Listas encadeadas

### `ListaDuplamenteEncadeada` (`models/`)

Lista genérica, ligada nó a nó (`No` guarda o dado, o `proximo` e o `anterior`). Atributos privados `#inicio`, `#fim` e `#tamanho`.

| Operação | Métodos |
| --- | --- |
| Inclusão | `inserirNoInicio`, `inserirNoFim`, `inserirApos(no, dado)` |
| Remoção | `remover(no)` (qualquer nó, O(1)), `removerPrimeiro()` |
| Busca | `buscar(predicado)`, `buscarTodos(predicado)`, `noEm(indice)` |
| Alteração | `alterar(no, novoDado)` |
| Movimentação | `mover(no, novaPosicao)` |
| Ordenação | `ordenar(comparador)` (insertion sort estável, religando os próprios nós) |
| Percurso | `percorrer(callback)` e `for...of` |

### `FilaVirtual` (herda da lista)

Fila de uma sessão, com prioridade. Guarda um ponteiro extra, `ultimoVip`:

```
inicio → [V1] → [V2] → [N1] → [N2] → [N3] ← fim
                  ↑
              ultimoVip
```

| Operação | Comportamento | Custo |
| --- | --- | --- |
| `enfileirar` (normal) | Entra no fim da fila. | O(1) |
| `enfileirar` (VIP) | Entra logo depois do último VIP, ou no início se não há VIP. | O(1) |
| `desenfileirar` | Atende o primeiro da fila. | O(1) |
| `sairDaFila(visitante)` | Remove do meio; se era o último VIP, `ultimoVip` volta ao nó anterior. | O(n) para achar, O(1) para remover |
| `posicaoDe`, `proximos(n)` | Posição na fila e as próximas reservas (em uma nova lista). | O(n) |

A fila **protege a própria ordem**: inserção direta, `alterar`, `mover` e `ordenar` lançam erro, porque qualquer um deles poderia colocar um normal na frente de um VIP.

### Onde cada operação aparece no sistema

- **Inclusão:** cadastros e entrada na fila com prioridade.
- **Remoção:** embarcar (do início) e sair da fila (do meio).
- **Busca:** visitante e atração por id, CPF e e-mail únicos, posição na fila.
- **Movimentação:** trocar de horário (o nó sai de uma fila e entra em outra).
- **Ordenação:** atrações e visitantes em ordem alfabética.

## Regras de negócio

**Cadastro**
- O CPF deve ter exatamente 11 dígitos. CPF e e-mail não podem se repetir (o e-mail ignora maiúsculas).
- A data de nascimento não pode estar no futuro.
- O ingresso VIP exige cartão de crédito, **simulado**: nada é cobrado nem validado em operadora.

**Entrada na fila**
- O botão fica desabilitado se o visitante não tem a idade mínima da atração.
- Não dá para entrar duas vezes na mesma fila (mesma atração e horário) enquanto estiver aguardando. Depois de embarcar, pode entrar de novo.
- Horários diferentes da mesma atração são permitidos.
- Horários que já passaram ficam como "horário encerrado" (exceto no modo demo).
- Em uma atração **sem fila VIP**, o visitante VIP entra como um visitante normal.

**Embarque**
- **EMBARCAR** chama, no máximo, a capacidade da sessão.
- A sessão chamada é o próximo horário (a partir da hora atual) que tenha gente aguardando; se todos já passaram, o mais cedo que ainda tem fila.
- Se a fila tem menos gente que a capacidade, todos embarcam.

**Sair da fila e trocar de horário** (no `Parque`)
- Sair da fila apaga a reserva (também do histórico).
- Trocar de horário leva a pessoa para o fim da fila nova, e a data/hora de entrada passa a ser a da troca.

**Métricas**
- "Reservas do dia" conta as entradas na fila feitas hoje; quem desistiu não conta.
- A divisão comum/VIP usa o tipo de ingresso do visitante.

## Telas e rotas

| Rota | Método | Descrição |
| --- | --- | --- |
| `/` | GET | Tela inicial |
| `/visitantes` | GET / POST | Cadastro de visitantes |
| `/visitantes/painel` | GET | Painel do visitante (`?visitante=ID` seleciona a pessoa) |
| `/visitantes/fila` | POST | Entrar na fila de uma atração em um horário |
| `/atracoes` | GET / POST | Cadastro de atrações |
| `/atracoes/painel` | GET | Painel de controle do parque |
| `/atracoes/:id/embarcar` | POST | Chama a próxima sessão da atração |
| `/metricas` | GET | Métricas e estatísticas do dia |
| `/creditos` | GET | Créditos da equipe |

## Estrutura de pastas

```
.
├── server.js              # Express: rotas; entrega às views os dados do Parque
├── parque-instancia.js    # O Parque único: relógio + SQLite + carregar()
├── config.js              # Caminho do banco (PARQUE_DB)
├── dados-exemplo.js       # Seed: cadastra pelo Parque, gravando no banco
├── models/
│   ├── No.js
│   ├── ListaDuplamenteEncadeada.js
│   ├── FilaVirtual.js     # Fila com prioridade VIP
│   ├── Parque.js          # Regras de negócio e dados em listas
│   ├── Atracao.js  Sessao.js  Visitante.js  Reserva.js  Ingresso.js
│   └── Relogio.js         # Hora injetável (modo demo)
├── persistencia/
│   ├── Repositorio.js     # Contrato da persistência
│   ├── SemPersistencia.js # Não grava nada (padrão e testes)
│   └── RepositorioSqlite.js
├── views/                 # Páginas EJS
├── public/                # CSS e imagens
└── test/                  # Testes (node --test)
```

## Modelo de dados

```
atracoes                      visitantes                    reservas
─────────────────────         ─────────────────────         ──────────────────────────
id            PK              id              PK            id            PK
nome                          nome                          visitante_id  FK → visitantes
tipo                          cpf             UNIQUE        atracao_id    FK → atracoes
capacidade                    email           UNIQUE        horario       "HH:MM"
idade_minima                  nascimento                    vip           prioridade da reserva
horarios      "09:00,14:00"   ingresso        normal|vip    status        aguardando|concluida
vip           fila VIP        cartao_bandeira               entrou_em     data e hora
                              cartao_final                  embarcou_em   data e hora
```

As tabelas são só o formato de gravação. Em execução, os dados vivem nas listas, e cada classe tem `paraDados()` para virar um objeto simples antes de ir ao banco.

## Testes

```bash
npm test
```

Cobrem a lista (inserção, remoção, busca, movimentação e ordenação), a fila (inclusive um teste aleatório contra um modelo simples), os modelos, as regras do `Parque`, as estatísticas e a persistência (ida e volta com SQLite, inclusive um banco no esquema antigo).

## Decisões de projeto

- **Listas como núcleo, banco como persistência.** O professor exige listas encadeadas para os dados principais e uma ferramenta de persistência. O `Parque` opera nas listas, e o repositório só grava e recarrega.
- **Orientação a objetos.** Encapsulamento (campos privados com `#`), herança (`FilaVirtual` estende a lista), polimorfismo (`Ingresso`), injeção de dependência (`Relogio` e `Repositorio`) e um invariante protegido pela própria classe (a ordem da fila).
- **SQLite em vez de MySQL.** Banco relacional sem servidor, o que elimina o risco de "levantar uma base" na máquina da apresentação.
- **Seletor no lugar de login.** O painel foi pensado para uso interno de quem trabalha no parque. O visitante escolhido fica em um cookie.
- **Cartão simulado.** Só a bandeira e os 4 últimos dígitos são gravados.
- **Hora real do sistema.** Horários encerrados bloqueiam a entrada e definem a sessão chamada. O modo `demo` desliga isso.

## Limitações conhecidas

- **Sem autenticação.** Qualquer pessoa que acesse o sistema pode escolher qualquer visitante e usar o painel do parque.
- **Um único processo.** As filas vivem na memória do servidor, então não dá para rodar várias instâncias ao mesmo tempo.
- **Falha do banco.** Se a gravação falhar, o erro sobe, mas a memória já mudou. Uma transação resolveria, mas é exagero para este escopo.
- **Pagamento e cartão são simulados.**
- **Sair da fila e trocar de horário** estão no `Parque`, mas ainda não têm botão nas telas.

## Equipe

Projeto desenvolvido em dupla por **Dayvson** e **Yuri Calixto**. Os links de cada integrante estão na tela de Créditos do sistema.