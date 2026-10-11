const test = require('node:test');
const assert = require('node:assert/strict');
const Atracao = require('../models/Atracao');
const Sessao = require('../models/Sessao');
const Visitante = require('../models/Visitante');
const Reserva = require('../models/Reserva');

const dadosVisitante = (extra = {}) => ({
  id: 1, nome: ' Ana Souza ', cpf: '111.222.333-44', email: 'ana@email.com',
  nascimento: '2000-03-14', hoje: '2026-10-10', ...extra
});
const dadosAtracao = (extra = {}) => ({
  id: 1, nome: 'Trem do Terror', tipo: 'trem fantasma', capacidade: 4,
  idadeMinima: 12, horarios: '18:00, 09:00,14:00, 09:00', filaVip: true, ...extra
});

test('os modelos não dependem de banco de dados', () => {
  const carregados = Object.keys(require.cache);
  assert.equal(carregados.some(c => /[\\/]db\.js$|better-sqlite3/.test(c)), false);
});

test('Atracao: dados, sessões em ordem e sem horário repetido', () => {
  const a = new Atracao(dadosAtracao());
  assert.deepEqual([a.id, a.nome, a.capacidade, a.idadeMinima, a.filaVip], [1, 'Trem do Terror', 4, 12, true]);
  assert.deepEqual([...a.sessoes].map(s => s.horario), ['09:00', '14:00', '18:00']);
  assert.equal(a.buscarSessao('14:00').horario, '14:00');
  assert.equal(a.buscarSessao('15:00'), null);
  assert.equal(a.buscarSessao('14:00').fila.tamanho, 0);
});

test('Atracao: não altera o array de horários recebido e aceita array', () => {
  const entrada = ['18:00', '09:00'];
  const a = new Atracao(dadosAtracao({ horarios: entrada }));
  assert.deepEqual(entrada, ['18:00', '09:00']);
  assert.deepEqual([...a.sessoes].map(s => s.horario), ['09:00', '18:00']);
});

test('Atracao: validações', () => {
  assert.throws(() => new Atracao(dadosAtracao({ nome: ' ' })), /Nome/);
  assert.throws(() => new Atracao(dadosAtracao({ capacidade: 0 })), /Capacidade/);
  assert.throws(() => new Atracao(dadosAtracao({ idadeMinima: -1 })), /Idade mínima/);
  assert.throws(() => new Atracao(dadosAtracao({ horarios: '9h' })), /HH:MM/);
  assert.throws(() => new Atracao(dadosAtracao({ horarios: '' })), /HH:MM/);
  assert.throws(() => new Atracao(dadosAtracao({ id: undefined })), /Id/);
  assert.equal(new Atracao(dadosAtracao({ idadeMinima: undefined })).idadeMinima, 0);
});

test('Atracao.concedePrioridadeA: precisa de fila VIP e de ingresso com prioridade', () => {
  const vip = new Visitante(dadosVisitante({ ingresso: 'vip', cartao: { numero: '4242 4242 4242 4242' } }));
  const normal = new Visitante(dadosVisitante({ id: 2, cpf: '99999999999' }));
  const comFila = new Atracao(dadosAtracao()), semFila = new Atracao(dadosAtracao({ filaVip: false }));
  assert.equal(comFila.concedePrioridadeA(vip), true);
  assert.equal(comFila.concedePrioridadeA(normal), false);
  assert.equal(semFila.concedePrioridadeA(vip), false);   // VIP entra como normal
});

test('Visitante: cadastro normal', () => {
  const v = new Visitante(dadosVisitante());
  assert.deepEqual([v.id, v.nome, v.cpf, v.ingresso.tipo], [1, 'Ana Souza', '11122233344', 'normal']);
  assert.equal(v.cartaoFinal, null);
});

test('Visitante: VIP guarda só bandeira e 4 últimos dígitos', () => {
  const v = new Visitante(dadosVisitante({ ingresso: 'vip', cartao: { numero: '5555 4444 3333 2222' } }));
  assert.deepEqual([v.ingresso.tipo, v.cartaoBandeira, v.cartaoFinal], ['vip', 'Mastercard', '2222']);
  assert.equal(Object.values(v).join('|').includes('5555'), false);
  assert.throws(() => new Visitante(dadosVisitante({ ingresso: 'vip' })), /exige um cartão/);
});

test('Visitante: validações', () => {
  assert.throws(() => new Visitante(dadosVisitante({ nome: '' })), /Nome/);
  assert.throws(() => new Visitante(dadosVisitante({ email: 'ana' })), /E-mail/);
  assert.throws(() => new Visitante(dadosVisitante({ cpf: '123' })), /11 dígitos/);
  assert.throws(() => new Visitante(dadosVisitante({ nascimento: '14/03/2000' })), /inválida/);
  assert.throws(() => new Visitante(dadosVisitante({ nascimento: '2030-01-01' })), /futuro/);
  assert.throws(() => new Visitante(dadosVisitante({ ingresso: 'anual' })), /desconhecido/);
});

test('Visitante.idade usa a data informada (antes e depois do aniversário)', () => {
  const v = new Visitante(dadosVisitante({ nascimento: '2000-03-14' }));
  assert.equal(v.idade('2026-03-13'), 25);
  assert.equal(v.idade('2026-03-14'), 26);
  assert.equal(v.idade('2026-12-31'), 26);
  assert.equal(new Visitante(dadosVisitante({ nascimento: '2016-06-15' })).idade('2026-10-10'), 10);
});

test('Sessao: horário válido e uma fila própria por sessão', () => {
  assert.throws(() => new Sessao('25:00'), /HH:MM/);
  const a = new Sessao('09:00'), b = new Sessao('09:00');
  assert.notEqual(a.fila, b.fila);
});

test('Reserva: criação, validações e conclusão', () => {
  const visitante = new Visitante(dadosVisitante()), atracao = new Atracao(dadosAtracao());
  const dados = { id: 7, visitante, atracao, horario: '14:00', prioritaria: 1, entrouEm: '2026-10-10 13:00:00' };
  const r = new Reserva(dados);
  assert.deepEqual([r.id, r.horario, r.prioritaria, r.status, r.embarcouEm], [7, '14:00', true, 'aguardando', null]);
  r.concluir('2026-10-10 14:05:00');
  assert.deepEqual([r.status, r.embarcouEm], ['concluida', '2026-10-10 14:05:00']);
  assert.throws(() => r.concluir('2026-10-10 14:06:00'), /já foi concluída/);
  assert.throws(() => new Reserva({ ...dados, visitante: {} }), /Visitante/);
  assert.throws(() => new Reserva({ ...dados, atracao: {} }), /Atracao/);
  assert.throws(() => new Reserva({ ...dados, horario: '2pm' }), /HH:MM/);
  assert.throws(() => new Reserva({ ...dados, entrouEm: 'hoje' }), /entrada/);
});