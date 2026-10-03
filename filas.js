const db = require('./db');

// "npm run demo" ignora a hora real (útil para apresentar fora do horário das sessões)
const SEM_HORA = process.argv.includes('--sem-hora');

const agora = () => new Date().toLocaleString('sv'); // 2026-10-03 19:18:28 (hora local)
const hoje = () => agora().slice(0, 10);
const horaAtual = () => agora().slice(11, 16);
const horarioAberto = h => SEM_HORA || h >= horaAtual();
const horarios = a => a.horarios.split(',').map(h => h.trim());

function idade(nasc) {
  const [y, m, d] = nasc.split('-').map(Number), t = new Date();
  return t.getFullYear() - y - (t < new Date(t.getFullYear(), m - 1, d) ? 1 : 0);
}

// Fila de uma atração em um horário: VIP primeiro, depois ordem de chegada.
const fila = (atracaoId, horario) => db.prepare(`
  SELECT r.id, r.visitante_id, v.nome FROM reservas r
  JOIN visitantes v ON v.id = r.visitante_id
  WHERE r.atracao_id = ? AND r.horario = ? AND r.status = 'aguardando'
  ORDER BY r.vip DESC, r.id`).all(atracaoId, horario);

// Retorna uma mensagem de erro, ou undefined se deu certo.
function entrar(visitanteId, atracaoId, horario) {
  const v = db.prepare('SELECT * FROM visitantes WHERE id = ?').get(visitanteId);
  const a = db.prepare('SELECT * FROM atracoes WHERE id = ?').get(atracaoId);
  if (!v || !a || !horarios(a).includes(horario)) return 'Selecione um visitante e um horário válido.';
  if (idade(v.nascimento) < a.idade_minima) return `Idade mínima para esta atração: ${a.idade_minima} anos.`;
  if (!horarioAberto(horario)) return 'Esse horário já passou.';
  if (fila(a.id, horario).some(r => r.visitante_id === v.id)) return 'Você já está nessa fila.';
  const vip = a.vip && v.ingresso === 'vip' ? 1 : 0; // sem fila VIP, o VIP entra como normal
  db.prepare('INSERT INTO reservas (visitante_id, atracao_id, horario, vip, entrou_em) VALUES (?,?,?,?,?)')
    .run(v.id, a.id, horario, vip, agora());
}

// Sessão que o botão EMBARCAR vai chamar: o próximo horário (a partir de agora) com gente esperando.
function sessao(atracaoId) {
  const hs = db.prepare(`SELECT DISTINCT horario FROM reservas
    WHERE atracao_id = ? AND status = 'aguardando' ORDER BY horario`).all(atracaoId).map(r => r.horario);
  return hs.find(horarioAberto) || hs[0] || null;
}

function embarcar(atracaoId) {
  const a = db.prepare('SELECT * FROM atracoes WHERE id = ?').get(atracaoId);
  const h = a && sessao(atracaoId);
  if (!h) return null;
  const quem = fila(atracaoId, h).slice(0, a.capacidade);
  const up = db.prepare("UPDATE reservas SET status = 'concluida', embarcou_em = ? WHERE id = ?");
  db.transaction(() => quem.forEach(r => up.run(agora(), r.id)))();
  return { horario: h, total: quem.length };
}

function painelVisitante(v) {
  const atracoes = db.prepare('SELECT * FROM atracoes ORDER BY nome').all().map(a => ({
    ...a,
    menor: idade(v.nascimento) < a.idade_minima,
    horas: horarios(a).map(h => {
      const q = fila(a.id, h);
      return { h, n: q.length, ja: q.some(r => r.visitante_id === v.id), passou: !horarioAberto(h) };
    })
  }));
  const reservas = db.prepare(`SELECT r.*, a.nome atracao FROM reservas r
    JOIN atracoes a ON a.id = r.atracao_id WHERE r.visitante_id = ? ORDER BY r.id DESC`).all(v.id);
  const minhas = reservas.filter(r => r.status === 'aguardando').map(r => ({
    ...r, posicao: fila(r.atracao_id, r.horario).findIndex(x => x.visitante_id === v.id) + 1
  }));
  return { atracoes, minhas, historico: reservas };
}

function stats() {
  const d = hoje(), dia = 'substr(r.entrou_em, 1, 10) = ?';
  const t = db.prepare(`SELECT COUNT(*) n, COALESCE(SUM(v.ingresso = 'vip'), 0) vip FROM reservas r
    JOIN visitantes v ON v.id = r.visitante_id WHERE ${dia}`).get(d);
  const topA = db.prepare(`SELECT a.nome, COUNT(*) n FROM reservas r JOIN atracoes a ON a.id = r.atracao_id
    WHERE ${dia} GROUP BY a.id ORDER BY n DESC LIMIT 1`).get(d);
  const topV = db.prepare(`SELECT v.nome, COUNT(*) n FROM reservas r JOIN visitantes v ON v.id = r.visitante_id
    WHERE ${dia} GROUP BY v.id ORDER BY n DESC LIMIT 1`).get(d);
  return { total: t.n, vip: t.vip, comuns: t.n - t.vip, topA, topV };
}

module.exports = { agora, horarios, fila, entrar, sessao, embarcar, painelVisitante, stats };
