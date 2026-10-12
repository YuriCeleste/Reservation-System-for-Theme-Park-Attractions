const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');
const Parque = require('../models/Parque');
const Relogio = require('../models/Relogio');
const Repositorio = require('../persistencia/Repositorio');
const RepositorioSqlite = require('../persistencia/RepositorioSqlite');

let agora;
const novoParque = (repositorio, hora = '08:00:00') => {
  agora = `2026-10-10 ${hora}`;
  return new Parque(new Relogio({ fonte: () => agora }), repositorio);
};

function popular(parque) {
  const trem = parque.cadastrarAtracao({ nome: 'Trem do Terror', tipo: 'trem fantasma', capacidade: 2,
    idadeMinima: 12, horarios: '09:00,14:00,18:00', filaVip: true });
  const casa = parque.cadastrarAtracao({ nome: 'Cada Mal Assombrada', tipo: 'casa assombrada', capacidade: 3,
    idadeMinima: 14, horarios: '09:00,14:00', filaVip: false });
  const novo = (nome, cpf, extra = {}) => parque.cadastrarVisitante({
    nome, cpf, email: `${nome.toLowerCase()}@email.com`, nascimento: '2000-03-14', ...extra });
  const vip = { ingresso: 'vip', cartao: { numero: '4242 4242 4242 4242' } };
  const v = { ana: novo('Ana', '11111111111', vip), bruno: novo('Bruno', '22222222222'),
    carla: novo('Carla', '33333333333', vip), diego: novo('Diego', '44444444444') };
  return { trem, casa, v };
}

function foto(parque) {
  const filas = [];
  parque.atracoes.percorrer(a => a.sessoes.percorrer(s => {
    filas.push(`${a.nome} ${s.horario}: ${[...s.fila].map(r => r.visitante.nome).join(',')}`);
  }));
  return {
    atracoes: [...parque.atracoes].map(a => a.paraDados()),
    visitantes: [...parque.visitantes].map(v => v.paraDados()),
    historico: [...parque.historico].map(r => r.paraDados()),
    filas
  };
}

// Uma sequência com de tudo: VIP e normais, troca de horário, desistência e embarque.
function movimentar(parque, { trem, casa, v }) {
  parque.entrarNaFila(v.diego.id, trem.id, '18:00');
  parque.entrarNaFila(v.bruno.id, trem.id, '14:00');
  parque.entrarNaFila(v.ana.id, trem.id, '18:00');
  parque.entrarNaFila(v.carla.id, trem.id, '14:00');
  parque.entrarNaFila(v.bruno.id, casa.id, '09:00');
  parque.entrarNaFila(v.diego.id, casa.id, '14:00');
  parque.sairDaFila(v.diego.id, casa.id, '14:00');
  agora = '2026-10-10 09:00:00';
  parque.trocarHorario(v.bruno.id, trem.id, '14:00', '18:00');   // Bruno chega depois do Diego
  parque.embarcar(trem.id);                                      // sessão das 14:00: leva a Carla
}

test('é um Repositorio e cria as tabelas; banco vazio devolve listas vazias', () => {
  const repo = new RepositorioSqlite(':memory:');
  assert.ok(repo instanceof Repositorio);
  assert.deepEqual(repo.carregar(), { atracoes: [], visitantes: [], reservas: [] });
  repo.fechar();
});

test('carregar devolve exatamente o formato de paraDados (booleanos e cartão incluídos)', () => {
  const repo = new RepositorioSqlite(':memory:'), parque = novoParque(repo);
  const dados = popular(parque);
  const reserva = parque.entrarNaFila(dados.v.ana.id, dados.trem.id, '14:00');
  const carregado = repo.carregar();
  assert.deepEqual(carregado.atracoes, [dados.trem.paraDados(), dados.casa.paraDados()]);
  assert.deepEqual(carregado.visitantes, [dados.v.ana, dados.v.bruno, dados.v.carla, dados.v.diego].map(v => v.paraDados()));
  assert.deepEqual(carregado.reservas, [reserva.paraDados()]);
  assert.equal(carregado.reservas[0].prioritaria, true);
  assert.equal(carregado.reservas[0].embarcouEm, null);
  assert.deepEqual(carregado.visitantes[0].cartao, { bandeira: 'Visa', final: '4242' });
  assert.equal(carregado.visitantes[1].cartao, null);
  assert.equal(JSON.stringify(carregado).includes('4242424'), false);   // o número completo nunca é gravado
});

test('ida e volta com SQLite: parque novo carregado fica igual ao original', () => {
  const repo = new RepositorioSqlite(':memory:'), a = novoParque(repo);
  const dados = popular(a);
  movimentar(a, dados);
  const b = novoParque(repo, '09:30:00');
  b.carregar();
  assert.deepEqual(foto(b), foto(a));
  assert.deepEqual(foto(b).filas.filter(f => f.includes('Trem do Terror 18:00')),
    ['Trem do Terror 18:00: Ana,Diego,Bruno']);                         // VIP na frente; troca respeitada
  assert.equal(b.posicaoDe(dados.v.bruno.id, dados.trem.id, '18:00'), 3);
  assert.equal(b.historicoDe(dados.v.carla.id).inicio.dado.status, 'concluida');
  const nova = b.entrarNaFila(dados.v.carla.id, dados.casa.id, '14:00');   // continua funcionando e gravando
  assert.equal(repo.carregar().reservas.some(r => r.id === nova.id), true);
});

test('atualizar e remover: o embarque e a desistência chegam ao banco', () => {
  const repo = new RepositorioSqlite(':memory:'), parque = novoParque(repo);
  const { trem, v } = popular(parque);
  parque.entrarNaFila(v.bruno.id, trem.id, '09:00');
  parque.entrarNaFila(v.diego.id, trem.id, '09:00');
  parque.entrarNaFila(v.carla.id, trem.id, '14:00');
  agora = '2026-10-10 08:45:00';                       // a sessão das 09:00 ainda está aberta
  parque.embarcar(trem.id);
  parque.sairDaFila(v.carla.id, trem.id, '14:00');
  const reservas = repo.carregar().reservas;
  assert.deepEqual(reservas.map(r => [r.id, r.status, r.embarcouEm]),
    [[1, 'concluida', '2026-10-10 08:45:00'], [2, 'concluida', '2026-10-10 08:45:00']]);
});

test('o banco recusa dados inconsistentes e avisa quando o parque e o banco divergem', () => {
  const repo = new RepositorioSqlite(':memory:'), parque = novoParque(repo);
  const { trem, v } = popular(parque);
  const reserva = parque.entrarNaFila(v.bruno.id, trem.id, '14:00');
  assert.throws(() => repo.salvarVisitante(v.bruno), /UNIQUE/);                 // CPF repetido
  assert.throws(() => repo.salvarReserva(reserva), /UNIQUE|constraint/i);        // mesmo id
  const outro = novoParque(new RepositorioSqlite(':memory:'));
  const { trem: t2, v: v2 } = popular(outro);
  const fantasma = outro.entrarNaFila(v2.bruno.id, t2.id, '14:00');
  const vazio = new RepositorioSqlite(':memory:');
  assert.throws(() => vazio.salvarReserva(fantasma), /FOREIGN KEY/i);            // visitante e atração não existem
  assert.throws(() => vazio.atualizarReserva(fantasma), /não existe no banco/);
  assert.throws(() => vazio.removerReserva(fantasma), /não existe no banco/);
});

test('fechar encerra a conexão', () => {
  const repo = new RepositorioSqlite(':memory:');
  repo.fechar();
  assert.throws(() => repo.carregar(), /not open|closed|open/i);
});

// ---- Os dois testes abaixo usam um arquivo temporário (apagado no fim): são os únicos que tocam o disco ----

function arquivoTemporario() {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'parque-'));
  return { arquivo: path.join(pasta, 'parque.db'), limpar: () => fs.rmSync(pasta, { recursive: true, force: true }) };
}

test('reiniciar de verdade: fechar o banco, abrir o arquivo de novo e recuperar tudo', () => {
  const { arquivo, limpar } = arquivoTemporario();
  try {
    const repo1 = new RepositorioSqlite(arquivo), a = novoParque(repo1);
    movimentar(a, popular(a));
    const antes = foto(a);
    repo1.fechar();
    const repo2 = new RepositorioSqlite(arquivo), b = novoParque(repo2, '09:30:00');
    b.carregar();
    assert.deepEqual(foto(b), antes);
    repo2.fechar();
  } finally { limpar(); }
});

test('um parque.db do esquema antigo continua valendo', () => {
  const { arquivo, limpar } = arquivoTemporario();
  try {
    const antigo = new Database(arquivo);
    antigo.exec(`
      CREATE TABLE atracoes (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, tipo TEXT NOT NULL,
        capacidade INTEGER NOT NULL, idade_minima INTEGER NOT NULL DEFAULT 0, horarios TEXT NOT NULL, vip INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE visitantes (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, cpf TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE, nascimento TEXT NOT NULL, ingresso TEXT NOT NULL, cartao_bandeira TEXT, cartao_final TEXT);
      CREATE TABLE reservas (id INTEGER PRIMARY KEY AUTOINCREMENT, visitante_id INTEGER NOT NULL REFERENCES visitantes(id),
        atracao_id INTEGER NOT NULL REFERENCES atracoes(id), horario TEXT NOT NULL, vip INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'aguardando', entrou_em TEXT NOT NULL, embarcou_em TEXT);
      INSERT INTO atracoes VALUES (1, 'Trem do Terror', 'trem fantasma', 4, 12, '09:00,18:00', 1);
      INSERT INTO visitantes VALUES (1, 'Ana Souza', '11122233300', 'ana@email.com', '2000-03-14', 'vip', 'Visa', '4242');
      INSERT INTO visitantes VALUES (2, 'Bruno Lima', '11122233301', 'bruno@email.com', '1998-07-02', 'normal', NULL, NULL);
      INSERT INTO reservas VALUES (1, 2, 1, '18:00', 0, 'aguardando', '2026-10-10 08:00:00', NULL);
      INSERT INTO reservas VALUES (2, 1, 1, '18:00', 1, 'aguardando', '2026-10-10 08:05:00', NULL);
      INSERT INTO reservas VALUES (3, 1, 1, '09:00', 1, 'concluida', '2026-10-10 07:00:00', '2026-10-10 07:30:00');
    `);
    antigo.close();
    const repo = new RepositorioSqlite(arquivo), parque = novoParque(repo);
    parque.carregar();
    assert.deepEqual(foto(parque).filas, ['Trem do Terror 09:00: ', 'Trem do Terror 18:00: Ana Souza,Bruno Lima']);   // Ana é VIP
    assert.equal(parque.buscarVisitante(1).cartaoFinal, '4242');
    assert.equal(parque.historico.tamanho, 3);
    const nova = parque.entrarNaFila(2, 1, '09:00');
    assert.equal(nova.id, 4);
    repo.fechar();
  } finally { limpar(); }
});