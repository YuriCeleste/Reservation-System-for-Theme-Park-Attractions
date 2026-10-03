// Popula o parque com dados de exemplo: node seed.js  (apaga os dados atuais)
const db = require('./db');
const { agora } = require('./filas');

db.exec('DELETE FROM reservas; DELETE FROM visitantes; DELETE FROM atracoes; DELETE FROM sqlite_sequence;');

const atr = db.prepare('INSERT INTO atracoes (nome, tipo, capacidade, idade_minima, horarios, vip) VALUES (?,?,?,?,?,?)');
[['Trem do Terror', 'trem fantasma', 4, 12, '09:00,14:00,18:00', 1],
 ['Cada Mal Assombrada', 'casa assombrada', 5, 14, '09:00,14:00,18:00', 0],
 ['Montanha-Russa Maldita', 'montanha-russa', 6, 16, '10:00,15:00,20:00', 1],
 ['Labirinto dos Sussurros', 'labirinto', 8, 10, '11:00,16:00,21:00', 0]].forEach(a => atr.run(...a));

const vis = db.prepare(`INSERT INTO visitantes (nome, cpf, email, nascimento, ingresso, cartao_bandeira, cartao_final)
  VALUES (?,?,?,?,?,?,?)`);
[['Ana Souza', '2000-03-14', 'vip'], ['Bruno Lima', '1998-07-02', 'normal'], ['Carla Menezes', '1995-11-23', 'vip'],
 ['Diego Alves', '2001-01-30', 'normal'], ['Elisa Rocha', '1999-09-09', 'normal'], ['Felipe Costa', '2003-05-18', 'vip'],
 ['Gabi Torres', '2007-12-01', 'normal'], ['Hugo Pereira', '1990-04-27', 'normal'], ['Iris Duarte', '2016-06-15', 'normal']]
  .forEach(([n, nasc, ing], i) => vis.run(n, String(11122233300 + i), n.split(' ')[0].toLowerCase() + '@email.com', nasc, ing,
    ing === 'vip' ? 'Visa' : null, ing === 'vip' ? '4242' : null));

// Algumas reservas: as 2 primeiras de cada visitante já embarcaram (histórico), as demais aguardam.
const res = db.prepare(`INSERT INTO reservas (visitante_id, atracao_id, horario, vip, status, entrou_em, embarcou_em)
  VALUES (?,?,?,?,?,?,?)`);
const vipDe = id => db.prepare('SELECT ingresso FROM visitantes WHERE id = ?').get(id).ingresso === 'vip';
const horas = { 1: '18:00', 2: '18:00', 3: '20:00', 4: '21:00' };
for (let v = 1; v <= 9; v++) {
  [1, 2, 3, 4].filter(a => (v + a) % 3 !== 0).forEach((a, k) => {
    const feito = k < 1 && v % 2 === 0;
    const vip = [1, 3].includes(a) && vipDe(v) ? 1 : 0;
    res.run(v, a, horas[a], vip, feito ? 'concluida' : 'aguardando', agora(), feito ? agora() : null);
  });
}
console.log('Dados de exemplo criados.');
