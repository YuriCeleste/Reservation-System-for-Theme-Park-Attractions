const test = require('node:test');
const assert = require('node:assert/strict');
const FilaVirtual = require('../models/FilaVirtual');

let contador = 0;
const pessoa = nome => ({ id: ++contador, nome });
const reserva = (visitante, prioritaria) => ({ visitante, prioritaria });

// Cria a fila e devolve também os visitantes pelo nome.
function montar(...itens) {
  const fila = new FilaVirtual(), v = {};
  for (const item of itens) {
    const vip = item.startsWith('V');
    v[item] = pessoa(item);
    fila.enfileirar(reserva(v[item], vip));
  }
  return { fila, v };
}

const nomes = fila => [...fila].map(r => r.visitante.nome);

// Confere o invariante: VIPs antes dos normais e ultimoVip no último VIP.
function conferir(fila) {
  let viuNormal = false, ultimo = null, contagem = 0;
  for (let no = fila.inicio; no; no = no.proximo) {
    contagem++;
    if (no.dado.prioritaria) {
      assert.equal(viuNormal, false, 'VIP depois de um normal');
      ultimo = no;
    } else viuNormal = true;
    assert.equal(no.proximo ? no.proximo.anterior : fila.fim, no);
  }
  assert.equal(fila.ultimoVip, ultimo, 'ultimoVip inconsistente');
  assert.equal(fila.tamanho, contagem);
  return nomes(fila);
}

test('fila vazia não gera erro', () => {
  const fila = new FilaVirtual();
  assert.equal(fila.desenfileirar(), null);
  assert.equal(fila.posicaoDe(pessoa('x')), null);
  assert.equal(fila.buscarPorVisitante(pessoa('x')), null);
  assert.equal(fila.sairDaFila(pessoa('x')), null);
  assert.equal(fila.proximos(3).tamanho, 0);
  assert.deepEqual(conferir(fila), []);
});

test('mistura de VIPs e normais: VIP passa na frente, cada grupo por ordem de chegada', () => {
  const { fila } = montar('N1', 'V1', 'N2', 'V2', 'N3');
  assert.deepEqual(conferir(fila), ['V1', 'V2', 'N1', 'N2', 'N3']);
  assert.equal(fila.ultimoVip.dado.visitante.nome, 'V2');
});

test('só normais, só VIPs e VIP em fila vazia', () => {
  assert.deepEqual(conferir(montar('N1', 'N2', 'N3').fila), ['N1', 'N2', 'N3']);
  assert.deepEqual(conferir(montar('V1', 'V2', 'V3').fila), ['V1', 'V2', 'V3']);
  const { fila } = montar('V1');
  assert.equal(fila.ultimoVip, fila.inicio);
  assert.equal(fila.inicio, fila.fim);
});

test('desenfileirar: ultimoVip acompanha a saída dos VIPs', () => {
  const { fila } = montar('N1', 'V1', 'V2', 'N2');
  assert.equal(fila.desenfileirar().visitante.nome, 'V1');
  assert.equal(fila.ultimoVip.dado.visitante.nome, 'V2');
  assert.equal(fila.desenfileirar().visitante.nome, 'V2');
  assert.equal(fila.ultimoVip, null);                       // não sobrou VIP
  assert.deepEqual(conferir(fila), ['N1', 'N2']);
  fila.enfileirar(reserva(pessoa('V3'), true));             // VIP novo vai para o início
  assert.deepEqual(conferir(fila), ['V3', 'N1', 'N2']);
  while (fila.desenfileirar());
  assert.deepEqual(conferir(fila), []);
});

test('sairDaFila: normal do meio, VIP do meio, último VIP e único VIP', () => {
  const { fila, v } = montar('V1', 'V2', 'V3', 'N1', 'N2', 'N3');
  assert.equal(fila.sairDaFila(v.N2).visitante.nome, 'N2');
  assert.deepEqual(conferir(fila), ['V1', 'V2', 'V3', 'N1', 'N3']);
  fila.sairDaFila(v.V2);                                    // VIP do meio: ultimoVip não muda
  assert.equal(fila.ultimoVip.dado.visitante.nome, 'V3');
  fila.sairDaFila(v.V3);                                    // último VIP: volta para V1
  assert.equal(fila.ultimoVip.dado.visitante.nome, 'V1');
  assert.deepEqual(conferir(fila), ['V1', 'N1', 'N3']);
  fila.sairDaFila(v.V1);                                    // único VIP
  assert.equal(fila.ultimoVip, null);
  assert.deepEqual(conferir(fila), ['N1', 'N3']);
  assert.equal(fila.sairDaFila(v.V1), null);                // já saiu
});

test('depois de remoções, um novo VIP entra no lugar certo', () => {
  const { fila, v } = montar('V1', 'V2', 'N1');
  fila.sairDaFila(v.V2);
  fila.enfileirar(reserva(pessoa('V4'), true));
  assert.deepEqual(conferir(fila), ['V1', 'V4', 'N1']);
});

test('posicaoDe e buscarPorVisitante (por objeto ou por id)', () => {
  const { fila, v } = montar('N1', 'V1', 'N2');
  assert.equal(fila.posicaoDe(v.V1), 1);
  assert.equal(fila.posicaoDe(v.N1), 2);
  assert.equal(fila.posicaoDe(v.N2), 3);
  assert.equal(fila.posicaoDe({ id: v.N2.id }), 3);
  assert.equal(fila.posicaoDe(pessoa('de fora')), null);
  assert.equal(fila.buscarPorVisitante(v.N1).dado.visitante, v.N1);
  assert.equal(fila.buscarPorVisitante(pessoa('de fora')), null);
});

test('proximos(n) devolve uma lista nova sem tirar ninguém da fila', () => {
  const { fila } = montar('N1', 'V1', 'N2', 'N3');
  assert.deepEqual([...fila.proximos(2)].map(r => r.visitante.nome), ['V1', 'N1']);
  assert.equal(fila.proximos(10).tamanho, 4);
  assert.equal(fila.proximos(0).tamanho, 0);
  assert.equal(fila.tamanho, 4);
  assert.throws(() => fila.proximos(-1), /inteiro/);
});

test('operações que quebrariam a prioridade são bloqueadas', () => {
  const { fila } = montar('V1', 'N1');
  for (const op of ['inserirNoInicio', 'inserirNoFim', 'inserirApos', 'alterar', 'mover', 'ordenar']) {
    assert.throws(() => fila[op](fila.inicio, 1), /FilaVirtual/, op);
  }
  assert.throws(() => fila.enfileirar(null), /reserva/);
  assert.deepEqual(conferir(fila), ['V1', 'N1']);
});

test('remover e removerPrimeiro herdados também mantêm o ultimoVip correto', () => {
  const { fila } = montar('V1', 'V2', 'N1');
  fila.remover(fila.ultimoVip);
  assert.equal(fila.ultimoVip.dado.visitante.nome, 'V1');
  fila.removerPrimeiro();
  assert.equal(fila.ultimoVip, null);
  assert.deepEqual(conferir(fila), ['N1']);
  const outra = montar('V9').fila;
  assert.throws(() => fila.remover(outra.inicio), /não pertence/);
});

test('teste aleatório: a fila sempre bate com um modelo simples', () => {
  let semente = 12345;
  const aleatorio = n => (semente = (semente * 1103515245 + 12345) % 2147483648) % n;
  const fila = new FilaVirtual();
  let vips = [], normais = [];                              // modelo (arrays só aqui, no teste)
  for (let passo = 0; passo < 3000; passo++) {
    const acao = aleatorio(10);
    if (acao < 5) {
      const vip = aleatorio(2) === 0, p = pessoa('p' + passo);
      fila.enfileirar(reserva(p, vip));
      (vip ? vips : normais).push(p);
    } else if (acao < 7) {
      const esperado = vips.length ? vips.shift() : normais.shift();
      const r = fila.desenfileirar();
      assert.equal(r ? r.visitante : undefined, esperado);
    } else {
      const todos = [...vips, ...normais];
      if (!todos.length) continue;
      const alvo = todos[aleatorio(todos.length)];
      assert.equal(fila.sairDaFila(alvo).visitante, alvo);
      vips = vips.filter(p => p !== alvo);
      normais = normais.filter(p => p !== alvo);
    }
    assert.deepEqual([...fila].map(r => r.visitante), [...vips, ...normais]);
    conferir(fila);
  }
});

test('a FilaVirtual não usa estruturas nativas para guardar os dados', () => {
  const fonte = require('node:fs').readFileSync(require.resolve('../models/FilaVirtual'), 'utf8');
  const codigo = fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(codigo, /new (Array|Map|Set|WeakMap)\b|\[\s*\]|\.push\(|\.splice\(|\.sort\(|\.filter\(|\.map\(/);
});