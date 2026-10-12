/**
 * ============================================================
 *  DADOS DE EXEMPLO
 * ============================================================
 *
 * Popula o Parque com atrações, visitantes e reservas de exemplo,
 * usando só a API pública do Parque (as mesmas regras do sistema).
 *
 * Como o Parque é um singleton EM MEMÓRIA, este arquivo precisa
 * rodar no MESMO processo que o server, e em modo demo: as filas
 * de exemplo usam horários que podem já ter passado.
 *
 * Uso:
 *   npm run demo    → sobe o server + dados-exemplo no mesmo processo
 * ============================================================
 */
const parque = require('./parque-instancia');

if (!parque.relogio.semHora) {
  throw new Error('Os dados de exemplo usam horários que podem já ter passado: rode com "npm run demo" (--sem-hora).');
}

// Regras esperadas nos dados de exemplo (idade mínima, fila repetida) não precisam de aviso.
function tentar(descricao, acao) {
  try {
    return acao();
  } catch (erro) {
    if (!/Idade mínima|já está/.test(erro.message)) console.warn(`Aviso: ${descricao}: ${erro.message}`);
    return null;
  }
}

// ==========================================================
//  ATRAÇÕES
// ==========================================================
const ATRAÇÕES = [
  ['Trem do Terror',          'trem fantasma',    4, 12, '09:00,14:00,18:00', true],
  ['Cada Mal Assombrada',     'casa assombrada',  5, 14, '09:00,14:00,18:00', false],
  ['Montanha-Russa Maldita',  'montanha-russa',   6, 16, '10:00,15:00,20:00', true],
  ['Labirinto dos Sussurros', 'labirinto',        8, 10, '11:00,16:00,21:00', false]
];

for (const [nome, tipo, capacidade, idadeMinima, horarios, filaVip] of ATRAÇÕES) {
  parque.cadastrarAtracao({ nome, tipo, capacidade, idadeMinima, horarios, filaVip });
}

// ==========================================================
//  VISITANTES
// ==========================================================
const VISITANTES = [
  ['Ana Souza',     '2000-03-14', 'vip'],
  ['Bruno Lima',    '1998-07-02', 'normal'],
  ['Carla Menezes', '1995-11-23', 'vip'],
  ['Diego Alves',   '2001-01-30', 'normal'],
  ['Elisa Rocha',   '1999-09-09', 'normal'],
  ['Felipe Costa',  '2003-05-18', 'vip'],
  ['Gabi Torres',   '2007-12-01', 'normal'],
  ['Hugo Pereira',  '1990-04-27', 'normal'],
  ['Iris Duarte',   '2016-06-15', 'normal']
];

VISITANTES.forEach(([nome, nascimento, ingresso], i) => {
  const cpf = String(11122233300 + i);
  const email = nome.split(' ')[0].toLowerCase() + '@email.com';
  const cartao = ingresso === 'vip' ? { numero: '4242424242424242' } : undefined;
  parque.cadastrarVisitante({ nome, cpf, email, nascimento, ingresso, cartao });
});

// ==========================================================
//  RESERVAS (histórico + filas)
// ==========================================================
const MANHA = { 1: '09:00', 2: '09:00', 3: '10:00', 4: '11:00' };
const NOITE = { 1: '18:00', 2: '18:00', 3: '20:00', 4: '21:00' };

// Em quais atrações cada visitante entra (mesma regra de antes).
const atracoesDo = vid => [1, 2, 3, 4].filter(a => (vid + a) % 3 !== 0);

// 1) Histórico: os visitantes de id par já brincaram de manhã na primeira atração deles.
//    Entram na fila da manhã e a atração é chamada (embarcar), como no uso real.
const brincaram = [];
for (let vid = 2; vid <= 9; vid += 2) {
  const aid = atracoesDo(vid)[0];
  if (tentar(`visitante ${vid} na atração ${aid}`, () => parque.entrarNaFila(vid, aid, MANHA[aid]))) {
    if (!brincaram.includes(aid)) brincaram.push(aid);
  }
}
brincaram.forEach(aid => parque.embarcar(aid));

// 2) Filas da noite: todos entram nas filas das suas atrações.
for (let vid = 1; vid <= 9; vid++) {
  for (const aid of atracoesDo(vid)) {
    tentar(`visitante ${vid} na atração ${aid}`, () => parque.entrarNaFila(vid, aid, NOITE[aid]));
  }
}

console.log(`Dados de exemplo criados no Parque (${parque.visitantes.tamanho} visitantes, ${parque.historico.tamanho} reservas).`);