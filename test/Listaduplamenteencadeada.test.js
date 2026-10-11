const test = require('node:test');
const assert = require('node:assert/strict');
const Lista = require('../models/ListaDuplamenteEncadeada');

// Cria uma lista a partir de valores (nos testes é permitido usar arrays).
const criar = (...valores) => {
  const l = new Lista();
  valores.forEach(v => l.inserirNoFim(v));
  return l;
};

// Confere a integridade: ida e volta pelos ponteiros dão a mesma sequência e o tamanho bate.
function conferir(lista) {
  const ida = [], volta = [];
  for (let no = lista.inicio; no; no = no.proximo) ida.push(no.dado);
  for (let no = lista.fim; no; no = no.anterior) volta.push(no.dado);
  assert.deepEqual(ida, volta.reverse(), 'ida e volta devem coincidir');
  assert.equal(lista.tamanho, ida.length, 'tamanho deve bater com a contagem dos nós');
  if (ida.length === 0) { assert.equal(lista.inicio, null); assert.equal(lista.fim, null); }
  else { assert.equal(lista.inicio.anterior, null); assert.equal(lista.fim.proximo, null); }
  return ida;
}

test('lista vazia', () => {
  const l = new Lista();
  assert.equal(l.estaVazia(), true);
  assert.equal(l.removerPrimeiro(), null);
  assert.equal(l.buscar(() => true), null);
  assert.equal(l.noEm(0), null);
  l.ordenar((a, b) => a - b);
  assert.deepEqual(conferir(l), []);
});

test('inserções no início, no fim e após um nó', () => {
  const l = new Lista();
  const b = l.inserirNoFim('B');
  l.inserirNoInicio('A');
  l.inserirNoFim('D');
  l.inserirApos(b, 'C');
  assert.deepEqual(conferir(l), ['A', 'B', 'C', 'D']);
  l.inserirApos(l.fim, 'E');
  assert.deepEqual(conferir(l), ['A', 'B', 'C', 'D', 'E']);
});

test('remoção do início, do meio e do fim', () => {
  const l = criar(1, 2, 3, 4, 5);
  assert.equal(l.removerPrimeiro(), 1);
  assert.equal(l.remover(l.noEm(1)), 3);
  assert.equal(l.remover(l.fim), 5);
  assert.deepEqual(conferir(l), [2, 4]);
  l.removerPrimeiro(); l.removerPrimeiro();
  assert.deepEqual(conferir(l), []);
});

test('lista com um único elemento', () => {
  const l = criar('X');
  assert.equal(l.inicio, l.fim);
  l.mover(l.inicio, 5);
  l.ordenar(() => 0);
  assert.deepEqual(conferir(l), ['X']);
  l.remover(l.inicio);
  assert.deepEqual(conferir(l), []);
});

test('nó de outra lista ou já removido é rejeitado', () => {
  const a = criar(1, 2), b = criar(3);
  assert.throws(() => a.remover(b.inicio), /não pertence/);
  const no = a.inicio;
  a.remover(no);
  assert.throws(() => a.remover(no), /não pertence/);
  assert.throws(() => a.alterar({}, 1), /não pertence/);
  assert.deepEqual(conferir(a), [2]);
});

test('busca: buscar, buscarTodos e noEm', () => {
  const l = criar(5, 8, 12, 7, 20);
  assert.equal(l.buscar(x => x > 10).dado, 12);
  assert.equal(l.buscar(x => x > 100), null);
  assert.deepEqual([...l.buscarTodos(x => x % 2 === 0)], [8, 12, 20]);
  assert.deepEqual([0, 1, 2, 3, 4].map(i => l.noEm(i).dado), [5, 8, 12, 7, 20]);
  assert.equal(l.noEm(5), null);
  assert.equal(l.noEm(-1), null);
});

test('alterar troca o dado e mantém o nó', () => {
  const l = criar('a', 'b', 'c');
  const no = l.noEm(1);
  assert.equal(l.alterar(no, 'B'), no);
  assert.deepEqual(conferir(l), ['a', 'B', 'c']);
});

test('mover: início, fim, meio e posições fora do intervalo', () => {
  const l = criar('A', 'B', 'C', 'D', 'E');
  l.mover(l.noEm(3), 0);  assert.deepEqual(conferir(l), ['D', 'A', 'B', 'C', 'E']);
  l.mover(l.noEm(0), 4);  assert.deepEqual(conferir(l), ['A', 'B', 'C', 'E', 'D']);
  l.mover(l.noEm(4), 2);  assert.deepEqual(conferir(l), ['A', 'B', 'D', 'C', 'E']);
  l.mover(l.noEm(1), 99); assert.deepEqual(conferir(l), ['A', 'D', 'C', 'E', 'B']);
  l.mover(l.noEm(2), -7); assert.deepEqual(conferir(l), ['C', 'A', 'D', 'E', 'B']);
  assert.throws(() => l.mover(l.inicio, 1.5), /inteiro/);
});

test('ordenar: ordena, é estável e preserva os nós', () => {
  const l = criar({ n: 'x', k: 3 }, { n: 'y', k: 1 }, { n: 'z', k: 3 }, { n: 'w', k: 2 }, { n: 'v', k: 1 });
  const noZ = l.buscar(d => d.n === 'z');
  l.ordenar((a, b) => a.k - b.k);
  assert.deepEqual([...l].map(d => d.n), ['y', 'v', 'w', 'x', 'z']);   // empates na ordem original
  assert.equal(l.buscar(d => d.n === 'z'), noZ);                        // mesmo nó
  conferir(l);
  const numeros = criar(9, 4, 7, 1, 8, 2);
  numeros.ordenar((a, b) => b - a);
  assert.deepEqual(conferir(numeros), [9, 8, 7, 4, 2, 1]);
});

test('percorrer e for...of', () => {
  const l = criar('a', 'b', 'c');
  const vistos = [];
  l.percorrer((dado, i) => vistos.push(`${i}:${dado}`));
  assert.deepEqual(vistos, ['0:a', '1:b', '2:c']);
  assert.deepEqual([...l], ['a', 'b', 'c']);
});

test('a classe não guarda os dados em estruturas nativas', () => {
  const fonte = require('node:fs').readFileSync(require.resolve('../models/ListaDuplamenteEncadeada'), 'utf8');
  const codigo = fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(codigo, /new (Array|Map|Set|WeakMap)\b|\[\s*\]|\.push\(|\.splice\(|\.sort\(/);
});