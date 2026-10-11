const test = require('node:test');
const assert = require('node:assert/strict');
const Relogio = require('../models/Relogio');

test('relógio fixo devolve data, dia e hora', () => {
  const r = Relogio.fixo('2026-10-10 14:30:05');
  assert.equal(r.agora(), '2026-10-10 14:30:05');
  assert.equal(r.hoje(), '2026-10-10');
  assert.equal(r.horaAtual(), '14:30');
});

test('horário aberto: só dali em diante, e sempre no modo semHora', () => {
  const r = Relogio.fixo('2026-10-10 14:30:00');
  assert.equal(r.horarioAberto('09:00'), false);
  assert.equal(r.horarioAberto('14:30'), true);
  assert.equal(r.horarioAberto('18:00'), true);
  const demo = Relogio.fixo('2026-10-10 14:30:00', true);
  assert.equal(demo.horarioAberto('09:00'), true);
  assert.equal(demo.semHora, true);
});

test('relógio real devolve o formato esperado', () => {
  assert.match(new Relogio().agora(), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
});