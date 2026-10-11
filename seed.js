/**
 * ============================================================
 *  SEED — Dados de exemplo
 * ============================================================
 *
 * Popula o Parque com atrações, visitantes e reservas de exemplo.
 * Como o Parque é um singleton EM MEMÓRIA, o seed precisa rodar
 * no MESMO processo que o server.
 *
 * Uso:
 *   node seed.js              → executa o seed (sozinho, não afeta o server)
 *   npm run demo              → sobe o server + seed no mesmo processo
 *
 * O server.js chama este arquivo automaticamente quando em modo demo.
 * ============================================================
 */
const parque = require('./models/Parque');

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
  const cartaoNumero = ingresso === 'vip' ? '4242424242424242' : null;
  parque.cadastrarVisitante({ nome, cpf, email, nascimento, ingresso, cartaoNumero });
});

// ==========================================================
//  RESERVAS (histórico + filas)
// ==========================================================
const HORAS = { 1: '18:00', 2: '18:00', 3: '20:00', 4: '21:00' };

for (let vid = 1; vid <= 9; vid++) {
  const visitante = parque.buscarVisitante(vid);
  if (!visitante) continue;

  const atracoesDoVisitante = [1, 2, 3, 4].filter(a => (vid + a) % 3 !== 0);

  atracoesDoVisitante.forEach((aid, k) => {
    const atracao = parque.buscarAtracao(aid);
    if (!atracao) return;

    const horario = HORAS[aid];
    const feito = k < 1 && vid % 2 === 0;

    const erro = parque.entrarNaFila(vid, aid, horario);
    if (erro) {
      if (!erro.includes('Idade mínima') && !erro.includes('já está')) {
        console.warn(`Aviso: ${visitante.nome} não entrou em ${atracao.nome}: ${erro}`);
      }
      return;
    }

    if (feito) {
      const sessao = atracao.buscarSessao(horario);
      const reserva = sessao.fila.sairDaFila(visitante);
      if (reserva) reserva.concluir(parque.relogio.agora());
    }
  });
}

console.log('Dados de exemplo criados no Parque.');