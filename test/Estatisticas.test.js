const test = require('node:test');
const assert = require('node:assert/strict');
const Parque = require('../models/Parque');
const Relogio = require('../models/Relogio');

let agora;
function criar() {
  agora = '2026-10-10 09:00:00';
  const parque = new Parque(new Relogio({ semHora: true, fonte: () => agora }));
  const trem = parque.cadastrarAtracao({ nome: 'Trem do Terror', tipo: 'trem fantasma', capacidade: 2,
    idadeMinima: 12, horarios: '09:00,14:00', filaVip: true });
  const casa = parque.cadastrarAtracao({ nome: 'Cada Mal Assombrada', tipo: 'casa assombrada', capacidade: 3,
    idadeMinima: 14, horarios: '09:00,14:00', filaVip: false });
  const novo = (nome, cpf, extra = {}) => parque.cadastrarVisitante({
    nome, cpf, email: `${nome.toLowerCase()}@email.com`, nascimento: '2000-03-14', ...extra });
  const v = { ana: novo('Ana', '11111111111', { ingresso: 'vip', cartao: { numero: '4242424242424242' } }),
    bruno: novo('Bruno', '22222222222'), carla: novo('Carla', '33333333333') };
  return { parque, trem, casa, v };
}

test('sem reservas: tudo zerado e sem destaques', () => {
  const { parque } = criar();
  assert.deepEqual(parque.estatisticas(), { total: 0, vip: 0, comuns: 0, topA: null, topV: null });
});

test('conta as reservas do dia, separa comuns e VIP e acha os destaques', () => {
  const { parque, trem, casa, v } = criar();
  parque.entrarNaFila(v.ana.id, trem.id, '09:00');
  parque.entrarNaFila(v.ana.id, trem.id, '14:00');
  parque.entrarNaFila(v.ana.id, casa.id, '09:00');
  parque.entrarNaFila(v.bruno.id, trem.id, '09:00');
  parque.entrarNaFila(v.carla.id, trem.id, '14:00');
  assert.deepEqual(parque.estatisticas(), {
    total: 5, vip: 3, comuns: 2,
    topA: { nome: 'Trem do Terror', n: 4 }, topV: { nome: 'Ana', n: 3 }
  });
});

test('quem desiste não conta; reservas de outro dia ficam de fora', () => {
  const { parque, trem, v } = criar();
  parque.entrarNaFila(v.bruno.id, trem.id, '09:00');
  parque.entrarNaFila(v.carla.id, trem.id, '09:00');
  parque.sairDaFila(v.carla.id, trem.id, '09:00');
  assert.equal(parque.estatisticas().total, 1);
  agora = '2026-10-11 09:00:00';                         // virou o dia
  assert.equal(parque.estatisticas().total, 0);
  parque.entrarNaFila(v.carla.id, trem.id, '14:00');
  assert.deepEqual(parque.estatisticas(), { total: 1, vip: 0, comuns: 1,
    topA: { nome: 'Trem do Terror', n: 1 }, topV: { nome: 'Carla', n: 1 } });
});

test('embarcar não tira a reserva da contagem do dia', () => {
  const { parque, trem, v } = criar();
  parque.entrarNaFila(v.bruno.id, trem.id, '09:00');
  parque.embarcar(trem.id);
  assert.equal(parque.estatisticas().total, 1);
});

test('empate: fica o primeiro que apareceu', () => {
  const { parque, trem, casa, v } = criar();
  parque.entrarNaFila(v.bruno.id, casa.id, '09:00');
  parque.entrarNaFila(v.carla.id, trem.id, '09:00');
  const s = parque.estatisticas();
  assert.deepEqual([s.topA.nome, s.topV.nome], ['Cada Mal Assombrada', 'Bruno']);
});