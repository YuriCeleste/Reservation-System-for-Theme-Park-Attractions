const test = require('node:test');
const assert = require('node:assert/strict');
const Ingresso = require('../models/Ingresso');

test('criar devolve o ingresso certo para cada tipo', () => {
  const normal = Ingresso.criar('normal'), vip = Ingresso.criar('vip');
  assert.equal(normal.tipo, 'normal');
  assert.equal(vip.tipo, 'vip');
  assert.equal(normal.constructor.name, 'IngressoNormal');
  assert.equal(vip.constructor.name, 'IngressoVip');
  assert.ok(normal instanceof Ingresso && vip instanceof Ingresso);
});

test('tipo desconhecido é rejeitado', () => {
  assert.throws(() => Ingresso.criar('anual'), /desconhecido: anual/);
  assert.throws(() => Ingresso.criar(undefined), /desconhecido/);
});

test('polimorfismo: prioridade, preço e exigência de cartão', () => {
  const normal = Ingresso.criar('normal'), vip = Ingresso.criar('vip');
  assert.deepEqual([normal.prioridade(), normal.preco(), normal.exigeCartao()], [0, 100, false]);
  assert.deepEqual([vip.prioridade(), vip.preco(), vip.exigeCartao()], [1, 200, true]);
  assert.ok(vip.prioridade() > normal.prioridade());
});

test('a classe base não implementa prioridade nem preço', () => {
  const base = Object.create(Ingresso.prototype);
  assert.throws(() => base.prioridade(), /subclasse/);
  assert.throws(() => base.preco(), /subclasse/);
});