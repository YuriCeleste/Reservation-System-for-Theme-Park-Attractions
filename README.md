# 🎡 Parque do Terror

Sistema de reservas e filas virtuais para as atrações de um parque temático de terror. Visitantes se cadastram, escolhem uma atração e um horário e entram em uma fila virtual específica. Quem tem ingresso **VIP** passa na frente dos ingressos normais nas atrações que possuem fila prioritária. A equipe do parque acompanha as filas, chama as sessões e consulta as métricas do dia.

O projeto foi feito em dupla, com Node.js e uma stack leve, pensada para instalar e rodar em segundos.

## Sumário

- [Funcionalidades](#funcionalidades)
- [Tecnologias](#tecnologias)
- [Como executar](#como-executar)
- [Telas e rotas](#telas-e-rotas)
- [Regras de negócio](#regras-de-negócio)
- [Fila encadeada com prioridade](#fila-encadeada-com-prioridade)
- [Modelo de dados](#modelo-de-dados)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Decisões de projeto](#decisões-de-projeto)
- [Limitações conhecidas](#limitações-conhecidas)
- [Equipe](#equipe)

## Funcionalidades

**Cadastro de atrações**
- Nome, tipo, capacidade máxima por sessão, idade mínima e horários disponíveis.
- Define se a atração possui fila prioritária (fila VIP).

**Cadastro de visitantes**
- Nome, e-mail, CPF, data de nascimento e tipo de ingresso (Normal ou VIP).
- O ingresso VIP só é liberado depois de adicionar um cartão de crédito.
- Mensagem de confirmação e redirecionamento ao painel do visitante depois do cadastro.

**Painel do visitante**
- Escolha do visitante em um seletor (não há login).
- Posição atual em cada fila em que está aguardando.
- Lista de atrações com os horários do dia e quantas pessoas já estão em cada fila.
- Botão **entrar na fila** por horário.
- Histórico com a data/hora de entrada na fila e a de embarque.

**Painel de controle do parque**
- Quantidade de pessoas na fila de cada atração.
- Próximos a embarcar, com a posição de cada um.
- Botão **EMBARCAR**, que chama a sessão e faz a fila andar.

**Métricas do dia**
- Total de reservas, separado entre comuns e VIP (gráfico de pizza).
- Atração mais disputada.
- Visitante que mais usou o sistema.

**Créditos**
- Tela com a equipe e as tecnologias usadas.

## Tecnologias

| Camada | Tecnologia |
| --- | --- |
| Servidor | Node.js + Express 4 |
| Páginas | EJS (renderização no servidor, sem build) |
| Banco de dados | SQLite via `better-sqlite3` (um único arquivo, sem servidor) |
| Estilo | CSS puro, fontes Cinzel e IBM Plex Sans (Google Fonts) |
| Fila | Lista encadeada própria (`fila-encadeada.js`) |

Não há framework de front-end nem etapa de compilação: edite um arquivo, salve e recarregue a página.

## Como executar

**Pré-requisitos:** Node.js 22 ou superior (testado nas versões 22 e 24) e npm. As fontes são carregadas do Google Fonts, então o visual completo precisa de internet.

```bash
# 1. Instalar as dependências
npm install

# 2. (Opcional) Popular o banco com atrações e visitantes de exemplo
npm run seed

# 3. Iniciar o servidor
npm start
```

Acesse **http://localhost:3000**.

### Scripts

| Comando | O que faz |
| --- | --- |
| `npm start` | Inicia o servidor na porta 3000. |
| `npm run demo` | Inicia o servidor **ignorando a hora real**: todos os horários ficam abertos. Ideal para apresentar fora do horário das sessões. |
| `npm run seed` | Apaga os dados atuais e cria atrações e visitantes de exemplo. Pode ser executado várias vezes. |

### Dados de exemplo (seed)

- **Atrações:** Trem do Terror, Cada Mal Assombrada, Montanha-Russa Maldita e Labirinto dos Sussurros.
- **Visitantes:** 9 pessoas, incluindo VIPs e uma criança de 10 anos, para mostrar o botão desabilitado por idade mínima.
- Algumas reservas já nascem aguardando e outras já concluídas, para o histórico não ficar vazio.

> O banco fica no arquivo `parque.db`, criado automaticamente na primeira execução. Para começar do zero, pare o servidor e apague esse arquivo.

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

## Regras de negócio

**Cadastro**
- O CPF deve ter exatamente 11 dígitos numéricos. CPF e e-mail não podem se repetir.
- A data de nascimento não pode estar no futuro.
- O ingresso VIP exige um cartão de crédito, que é **simulado**: nada é cobrado nem validado em operadora.
- Apenas a **bandeira e os 4 últimos dígitos** do cartão são gravados no banco.

**Entrada na fila**
- O botão fica desabilitado se o visitante não tem a idade mínima da atração.
- Não é possível entrar duas vezes na mesma fila (mesma atração e horário) enquanto estiver aguardando. Depois de embarcar, pode entrar de novo.
- É possível entrar em horários diferentes da mesma atração.
- Horários que já passaram ficam como "horário encerrado" (a menos que o servidor rode com `npm run demo`).
- Se a atração **não tem fila VIP**, o visitante VIP entra como um visitante normal.

**Embarque**
- O botão **EMBARCAR** chama, no máximo, a capacidade da sessão.
- A sessão chamada é o próximo horário (a partir da hora atual) que tenha gente aguardando. Se todos já passaram, usa o mais cedo que ainda tem fila.
- Se a fila tem menos gente que a capacidade, todos embarcam.
- Quem embarca sai da fila e a data/hora do embarque entra no histórico.

**Métricas**
- "Reservas do dia" conta as **entradas na fila** feitas hoje.
- A divisão comum/VIP usa o **tipo de ingresso** do visitante.

## Fila encadeada com prioridade

Cada combinação **atração + horário** tem a sua própria fila, implementada como uma **lista encadeada simples** em [`fila-encadeada.js`](fila-encadeada.js).

```
inicio → [V1] → [V2] → [N1] → [N2] → [N3] ← fim
                  ↑
              ultimoVip
```

A fila guarda três ponteiros: `inicio` (próximo a ser atendido), `fim` (último da fila) e `ultimoVip` (último nó VIP).

| Operação | Comportamento | Custo |
| --- | --- | --- |
| `enfileirar` (normal) | Entra no fim da fila, ligando-se ao nó apontado por `fim`. | O(1) |
| `enfileirar` (VIP) | Entra logo depois do último VIP, ou no início se não há VIP. Passa na frente de todos os normais. | O(1) |
| `desenfileirar` | Remove e devolve o nó do início. Se era o último VIP, `ultimoVip` volta a `null`. | O(1) |
| `paraArray` | Percorre os nós e devolve os itens na ordem da fila. | O(n) |

Como a posição de cada visitante é a ordem na lista, ela se atualiza sozinha quando alguém entra (inclusive um VIP) ou embarca.

**Integração com o banco** (`filas.js`)
- As filas ficam em memória, em um `Map` indexado por `atracao|horario`.
- Na primeira vez que uma fila é usada, ela é **reconstruída a partir das reservas `aguardando`** do SQLite, na ordem de chegada. Assim os dados continuam existindo depois de reiniciar o servidor.
- O SQLite guarda visitantes, atrações e todo o histórico. A lista encadeada cuida da ordem e da prioridade.
- Entrar na fila grava a reserva e depois chama `enfileirar`. Embarcar chama `desenfileirar` e marca a reserva como concluída.

## Modelo de dados

```
atracoes                      visitantes                    reservas
─────────────────────         ─────────────────────         ──────────────────────────
id            PK              id              PK            id            PK
nome                          nome                          visitante_id  FK → visitantes
tipo                          cpf             UNIQUE        atracao_id    FK → atracoes
capacidade                    email           UNIQUE        horario       "HH:MM"
idade_minima                  nascimento                    vip           0 ou 1
horarios      "09:00,14:00"   ingresso        normal|vip    status        aguardando|concluida
vip           0 ou 1          cartao_bandeira               entrou_em     data e hora
                              cartao_final                  embarcou_em   data e hora
```

Os horários de cada atração ficam em um único campo de texto separado por vírgula, o que evita uma quarta tabela.

## Estrutura de pastas

```
.
├── server.js              # Express: rotas e validações dos formulários
├── db.js                  # Conexão com o SQLite e criação das tabelas
├── filas.js               # Regras de fila: entrar, embarcar, posições e métricas
├── fila-encadeada.js      # Lista encadeada com prioridade VIP
├── seed.js                # Dados de exemplo
├── package.json
├── public/                # Arquivos estáticos
│   ├── style.css
│   └── *.png              # Imagens de fundo, logomarca, troféus e avatares
└── views/                 # Páginas EJS
    ├── index.ejs
    ├── metricas.ejs
    ├── creditos.ejs
    ├── partials/          # head.ejs (menu) e foot.ejs
    ├── atracoes/          # cadastro.ejs e painel.ejs
    └── visitantes/        # cadastro.ejs e painel.ejs
```

## Decisões de projeto

- **SQLite em vez de JSON.** As métricas viram consultas com `GROUP BY` e `COUNT`, e o banco já resolve as gravações simultâneas. Não exige instalar nem configurar servidor de banco.
- **Seletor no lugar de login.** O painel foi pensado para uso interno de quem trabalha no parque. O visitante escolhido fica guardado em um cookie.
- **Cartão simulado.** Mesmo em um projeto acadêmico, não se guarda o número completo do cartão. Só a bandeira e os 4 últimos dígitos.
- **Lógica separada da interface.** Rotas em `server.js`, regras em `filas.js`, a estrutura de dados em `fila-encadeada.js`. As views só exibem os dados que recebem.
- **Hora real do sistema.** Os horários encerrados bloqueiam a entrada e definem qual sessão o EMBARCAR chama. O modo `demo` desliga isso para apresentações.

## Limitações conhecidas

- **As filas ficam em memória.** Se o `npm run seed` for executado com o servidor ligado, as filas ficam desatualizadas: reinicie o servidor depois do seed.
- **Não há autenticação.** Qualquer pessoa que acesse o sistema pode escolher qualquer visitante e usar o painel do parque.
- **Pagamento e cartão são simulados.**
- **Um único processo.** Como as filas vivem na memória do processo, não dá para rodar várias instâncias do servidor ao mesmo tempo.

## Equipe

Projeto desenvolvido em dupla por **Dayvson** e **Yuri Calixto**. Os links de cada integrante estão na tela de Créditos do sistema.
