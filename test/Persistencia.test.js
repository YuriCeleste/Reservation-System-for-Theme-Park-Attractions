const test = require('node:test');
const assert = require('node:assert/strict');
const Parque = require('../models/Parque');
const Relogio = require('../models/Relogio');
const Visitante = require('../models/Visitante');
const Repositorio = require('../persistencia/Repositorio');
const SemPersistencia = require('../persistencia/SemPersistencia');

// Repositório de teste: guarda objetos simples na memória e registra cada chamada.
class RepositorioDeTeste extends Repositorio {
  atracoes = []; visitantes = []; reservas = []; chamadas = [];
  salvarAtracao(a) { this.chamadas.push('salvarAtracao'); this.atracoes.push(a.paraDados()); }
  salvarVisitante(v) { this.chamadas.push('salvarVisitante'); this.visitantes.push(v.paraDados()); }
  salvarReserva(r) { this.chamadas.push('salvarReserva'); this.reservas.push(r.paraDados()); }
  atualizarReserva(r) {
    this.chamadas.push('atualizarReserva');
    this.reservas = this.reservas.map(d => (d.id === r.id ? r.paraDados() : d));
  }
  removerReserva(r) { this.chamadas.push('removerReserva'); this.reservas = this.reservas.filter(d => d.id !== r.id); }
  carregar() { return JSON.parse(JSON.stringify({ atracoes: this.atracoes, visitantes: this.visitantes, reservas: this.reservas })); }
}

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

// Foto do estado do parque, para comparar antes e depois de restaurar.
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

test('a interface Repositorio exige implementação; SemPersistencia não faz nada', () => {
  const base = new Repositorio();
  for (const metodo of ['salvarAtracao', 'salvarVisitante', 'salvarReserva', 'atualizarReserva', 'removerReserva', 'carregar']) {
    assert.throws(() => base[metodo]({}), /precisa ser implementado/, metodo);
  }
  const vazio = new SemPersistencia();
  vazio.salvarReserva({});
  assert.deepEqual(vazio.carregar(), { atracoes: [], visitantes: [], reservas: [] });
  const parque = new Parque();            // sem repositório: usa SemPersistencia
  parque.carregar();
  assert.equal(parque.atracoes.tamanho, 0);
});

test('cada mudança no parque avisa o repositório', () => {
  const repo = new RepositorioDeTeste(), parque = novoParque(repo);
  const { trem, v } = popular(parque);
  assert.deepEqual(repo.chamadas, ['salvarAtracao', 'salvarAtracao', 'salvarVisitante', 'salvarVisitante', 'salvarVisitante', 'salvarVisitante']);
  repo.chamadas.length = 0;
  parque.entrarNaFila(v.bruno.id, trem.id, '14:00');
  parque.entrarNaFila(v.ana.id, trem.id, '14:00');
  parque.entrarNaFila(v.diego.id, trem.id, '14:00');
  parque.trocarHorario(v.diego.id, trem.id, '14:00', '18:00');
  parque.sairDaFila(v.bruno.id, trem.id, '14:00');
  parque.embarcar(trem.id);
  assert.deepEqual(repo.chamadas, ['salvarReserva', 'salvarReserva', 'salvarReserva', 'atualizarReserva', 'removerReserva', 'atualizarReserva']);
  assert.equal(repo.reservas.length, 2);
});

test('mudanças recusadas não chegam ao repositório', () => {
  const repo = new RepositorioDeTeste(), parque = novoParque(repo);
  const { trem, v } = popular(parque);
  const antes = repo.chamadas.length;
  assert.throws(() => parque.entrarNaFila(v.bruno.id, trem.id, '16:00'));
  assert.throws(() => parque.cadastrarVisitante({ nome: 'X', cpf: '11111111111', email: 'x@x.com', nascimento: '2000-01-01' }));
  assert.throws(() => parque.sairDaFila(v.bruno.id, trem.id, '14:00'));
  assert.equal(repo.chamadas.length, antes);
});

test('ida e volta: um parque novo carregado do repositório fica igual ao original', () => {
  const repo = new RepositorioDeTeste(), a = novoParque(repo);
  const { trem, casa, v } = popular(a);
  a.entrarNaFila(v.bruno.id, trem.id, '14:00');
  a.entrarNaFila(v.diego.id, trem.id, '14:00');
  a.entrarNaFila(v.carla.id, trem.id, '14:00');
  a.entrarNaFila(v.ana.id, trem.id, '18:00');
  a.entrarNaFila(v.bruno.id, casa.id, '09:00');
  a.entrarNaFila(v.ana.id, casa.id, '09:00');
  a.entrarNaFila(v.diego.id, casa.id, '14:00');
  a.sairDaFila(v.diego.id, casa.id, '14:00');             // abre um buraco nos ids das reservas
  a.embarcar(trem.id);                                   // Carla e Bruno embarcam (VIP primeiro)
  const b = novoParque(repo);
  b.carregar();
  assert.deepEqual(foto(b), foto(a));
  assert.equal(b.posicaoDe(v.diego.id, trem.id, '14:00'), 1);
  assert.equal(b.historicoDe(v.carla.id).inicio.dado.status, 'concluida');
  assert.equal(b.buscarVisitante(v.ana.id).cartaoFinal, '4242');
  assert.equal(b.buscarVisitante(v.ana.id).cartaoBandeira, 'Visa');
});

test('ordem da fila restaurada: respeita troca de horário e a prioridade VIP', () => {
  const repo = new RepositorioDeTeste(), a = novoParque(repo);
  const { trem, v } = popular(a);
  a.entrarNaFila(v.diego.id, trem.id, '18:00');
  a.entrarNaFila(v.bruno.id, trem.id, '14:00');
  a.entrarNaFila(v.ana.id, trem.id, '18:00');
  agora = '2026-10-10 09:00:00';
  a.trocarHorario(v.bruno.id, trem.id, '14:00', '18:00');  // Bruno chega depois do Diego
  const b = novoParque(repo, '09:30:00');
  b.carregar();
  assert.deepEqual(foto(b).filas.filter(f => f.includes('18:00')), ['Trem do Terror 18:00: Ana,Diego,Bruno']);
});

test('depois de restaurar, o parque continua funcionando e os ids não se repetem', () => {
  const repo = new RepositorioDeTeste(), a = novoParque(repo);
  const { trem, v } = popular(a);
  a.entrarNaFila(v.bruno.id, trem.id, '14:00');
  a.entrarNaFila(v.diego.id, trem.id, '14:00');
  a.sairDaFila(v.diego.id, trem.id, '14:00');
  const b = novoParque(repo);
  b.carregar();
  const nova = b.entrarNaFila(v.carla.id, trem.id, '14:00');
  const novoVisitante = b.cadastrarVisitante({ nome: 'Eva', cpf: '55555555555', email: 'eva@email.com', nascimento: '1999-01-01' });
  const novaAtracao = b.cadastrarAtracao({ nome: 'Nova', tipo: 'teatro', capacidade: 5, horarios: '10:00' });
  assert.deepEqual([nova.id, novoVisitante.id, novaAtracao.id], [2, 5, 3]);   // sempre o maior id + 1
  assert.deepEqual(foto(b).filas[1], 'Trem do Terror 14:00: Carla,Bruno');
  assert.equal(repo.reservas.length, 2);                                     // e o repositório recebeu a novidade
  assert.equal(b.embarcar(trem.id).total, 2);
});

test('restaurar: só em parque vazio e com dados coerentes', () => {
  const repo = new RepositorioDeTeste(), a = novoParque(repo);
  const { trem, v } = popular(a);
  a.entrarNaFila(v.bruno.id, trem.id, '14:00');
  assert.throws(() => a.restaurar(repo.carregar()), /parque vazio/);
  const dados = repo.carregar();
  const reserva = dados.reservas[0];
  const parque = (extra) => { const p = novoParque(new RepositorioDeTeste()); p.restaurar({ ...dados, ...extra }); };
  assert.throws(() => parque({ reservas: [{ ...reserva, horario: '16:00' }] }), /horário que não existe/);
  assert.throws(() => parque({ reservas: [{ ...reserva, visitanteId: 99 }] }), /Visitante/);
  assert.throws(() => parque({ reservas: [{ ...reserva, atracaoId: 99 }] }), /Atracao/);
});

test('Visitante restaurado com cartão já processado; número completo nunca é guardado', () => {
  const dados = { id: 1, nome: 'Ana', cpf: '11111111111', email: 'ana@email.com', nascimento: '2000-03-14', ingresso: 'vip', hoje: '2026-10-10' };
  const v = new Visitante({ ...dados, cartao: { bandeira: 'Visa', final: '4242' } });
  assert.deepEqual([v.cartaoBandeira, v.cartaoFinal], ['Visa', '4242']);
  assert.deepEqual(v.paraDados().cartao, { bandeira: 'Visa', final: '4242' });
  assert.throws(() => new Visitante({ ...dados, cartao: { bandeira: 'Visa', final: '42' } }), /Cartão salvo inválido/);
  assert.throws(() => new Visitante({ ...dados, cartao: { final: '4242' } }), /Cartão salvo inválido/);
  assert.throws(() => new Visitante({ ...dados, cartao: undefined }), /exige um cartão/);
  assert.equal(JSON.stringify(v.paraDados()).includes('4242424'), false);
  const normal = new Visitante({ ...dados, ingresso: 'normal', cartao: null });
  assert.equal(normal.paraDados().cartao, null);
});

test('paraDados devolve o formato que o construtor aceita (ida e volta)', () => {
  const parque = novoParque(new RepositorioDeTeste());
  const { trem, v } = popular(parque);
  const dadosAtracao = trem.paraDados();
  assert.deepEqual(dadosAtracao, { id: 1, nome: 'Trem do Terror', tipo: 'trem fantasma', capacidade: 2,
    idadeMinima: 12, horarios: '09:00,14:00,18:00', filaVip: true });
  const outro = novoParque(new RepositorioDeTeste());
  assert.deepEqual(outro.cadastrarAtracao(dadosAtracao).paraDados(), { ...dadosAtracao });
  const reserva = parque.entrarNaFila(v.ana.id, trem.id, '14:00');
  assert.deepEqual(reserva.paraDados(), { id: 1, visitanteId: v.ana.id, atracaoId: trem.id, horario: '14:00',
    prioritaria: true, status: 'aguardando', entrouEm: '2026-10-10 08:00:00', embarcouEm: null });
});