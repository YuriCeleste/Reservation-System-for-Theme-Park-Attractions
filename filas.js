const db = require('./db');
const FilaEncadeada = require('./fila-encadeada');
const Visitante = require('./models/Visitante');
const Atracao = require('./models/Atracao');
const Reserva = require('./models/Reserva');

// "npm run demo" ignora a hora real (útil para apresentar fora do horário das sessões)
const SEM_HORA = process.argv.includes('--sem-hora');

const agora = () => new Date().toLocaleString('sv');
const hoje = () => agora().slice(0, 10);
const horaAtual = () => agora().slice(11, 16);
const horarioAberto = h => SEM_HORA || h >= horaAtual();
const horarios = a => a.horarios;   // agora o horarios é array, não string

// Uma FilaEncadeada em memória para cada atração + horário.
const filas = new Map();

function getFila(atracaoId, horario) {
  const chave = `${atracaoId}|${horario}`;
  if (!filas.has(chave)) {
    const q = new FilaEncadeada();
    db.prepare(`SELECT r.id, r.visitante_id, r.vip, v.nome FROM reservas r
      JOIN visitantes v ON v.id = r.visitante_id
      WHERE r.atracao_id = ? AND r.horario = ? AND r.status = 'aguardando'
      ORDER BY r.id`).all(atracaoId, horario).forEach(r => q.enfileirar(r));
    filas.set(chave, q);
  }
  return filas.get(chave);
}

const fila = (atracaoId, horario) => getFila(atracaoId, horario).paraArray();

function entrar(visitanteId, atracaoId, horario) {
  const v = Visitante.buscar(visitanteId);
  const a = Atracao.buscar(atracaoId);
  if (!v || !a || !horarios(a).includes(horario)) return 'Selecione um visitante e um horário válido.';
  if (v.idade() < a.idadeMinima) return `Idade mínima para esta atração: ${a.idadeMinima} anos.`;
  if (!horarioAberto(horario)) return 'Esse horário já passou.';
  if (fila(a.id, horario).some(r => r.visitante_id === v.id)) return 'Você já está nessa fila.';

  const vip = a.aceitaVip() && v.ingresso.prioridade() > 0;
  const r = new Reserva({ visitante: v, atracao: a, horario, vip });
  r.salvar();
  getFila(a.id, horario).enfileirar({
    id: r.id, visitante_id: v.id, nome: v.nome, vip: vip ? 1 : 0
  });
}

function sessao(atracaoId) {
  const hs = db.prepare(`SELECT DISTINCT horario FROM reservas
    WHERE atracao_id = ? AND status = 'aguardando' ORDER BY horario`).all(atracaoId).map(r => r.horario);
  return hs.find(horarioAberto) || hs[0] || null;
}

function embarcar(atracaoId) {
  const a = Atracao.buscar(atracaoId);
  const h = a && sessao(atracaoId);
  if (!h) return null;
  const q = getFila(atracaoId, h);
  const up = db.prepare("UPDATE reservas SET status = 'concluida', embarcou_em = ? WHERE id = ?");
  let total = 0;
  db.transaction(() => {
    for (let r; total < a.capacidade && (r = q.desenfileirar()); total++) up.run(agora(), r.id);
  })();
  return { horario: h, total };
}

function painelVisitante(v) {
  const atracoes = Atracao.listar().map(a => ({
    id: a.id,
    nome: a.nome,
    tipo: a.tipo,
    capacidade: a.capacidade,
    idade_minima: a.idadeMinima,
    horarios: a.horarios.join(','),
    vip: a.filaVip ? 1 : 0,
    menor: v.idade() < a.idadeMinima,
    horas: a.horarios.map(h => {
      const q = fila(a.id, h);
      return { h, n: q.length, ja: q.some(r => r.visitante_id === v.id), passou: !horarioAberto(h) };
    })
  }));

  const reservas = db.prepare(`SELECT r.*, a.nome atracao FROM reservas r
    JOIN atracoes a ON a.id = r.atracao_id WHERE r.visitante_id = ? ORDER BY r.id DESC`).all(v.id);

  const minhas = reservas.filter(r => r.status === 'aguardando').map(r => ({
    ...r,
    posicao: fila(r.atracao_id, r.horario).findIndex(x => x.visitante_id === v.id) + 1
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