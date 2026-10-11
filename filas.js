const db = require('./db');
const Visitante = require('./models/Visitante');
const Atracao = require('./models/Atracao');
const Reserva = require('./models/Reserva');

// "npm run demo" ignora a hora real
const SEM_HORA = process.argv.includes('--sem-hora');

const agora = () => new Date().toLocaleString('sv');
const hoje = () => agora().slice(0, 10);
const horaAtual = () => agora().slice(11, 16);
const horarioAberto = h => SEM_HORA || h >= horaAtual();

// ---------- Cache de Atracao (para não bater no banco toda hora) ----------

let cacheAtracao = null;
let cacheAtracaoHora = 0;

function atracaoComFila(atracaoId) {
  const agoraMs = Date.now();
  // Recarrega o cache a cada 2 segundos (para refletir mudanças no banco)
  if (!cacheAtracao || cacheAtracao.id !== atracaoId || (agoraMs - cacheAtracaoHora) > 2000) {
    cacheAtracao = Atracao.buscar(atracaoId);
    cacheAtracaoHora = agoraMs;
    // Reconstrói a fila da sessão a partir das reservas aguardando
    if (cacheAtracao) {
      for (const s of cacheAtracao.sessoes()) {
        const reservas = Reserva.porAtracaoEHorario(atracaoId, s.horario);
        for (const r of reservas) {
          s.enfileirar(r);
        }
      }
    }
  }
  return cacheAtracao;
}

// Retorna a fila da Sessao como array (para as views)
function fila(atracaoId, horario) {
  const a = atracaoComFila(atracaoId);
  if (!a) return [];
  const s = a.sessao(horario);
  return s ? s.fila.paraArray() : [];
}

// ---------- Entrar na fila ----------

function entrar(visitanteId, atracaoId, horario) {
  const v = Visitante.buscar(visitanteId);
  const a = atracaoComFila(atracaoId);

  if (!v || !a || !a.horarios().includes(horario)) {
    return 'Selecione um visitante e um horário válido.';
  }
  if (v.idade() < a.idadeMinima) {
    return `Idade mínima para esta atração: ${a.idadeMinima} anos.`;
  }
  if (!horarioAberto(horario)) {
    return 'Esse horário já passou.';
  }

  const s = a.sessao(horario);
  if (s.posicaoDe(v) !== null) {
    return 'Você já está nessa fila.';
  }

  const vip = a.aceitaVip() && v.ingresso.prioridade() > 0;
  const reserva = new Reserva({ visitante: v, atracao: a, horario, vip });
  reserva.salvar();
  s.enfileirar(reserva);
}

// ---------- Sessão e embarque ----------

function sessao(atracaoId) {
  const hs = db.prepare(`
    SELECT DISTINCT horario FROM reservas
    WHERE atracao_id = ? AND status = 'aguardando'
    ORDER BY horario
  `).all(atracaoId).map(r => r.horario);
  return hs.find(horarioAberto) || hs[0] || null;
}

function embarcar(atracaoId) {
  const a = atracaoComFila(atracaoId);
  const h = a && sessao(atracaoId);
  if (!h) return null;

  const s = a.sessao(h);
  const up = db.prepare("UPDATE reservas SET status = 'concluida', embarcou_em = ? WHERE id = ?");
  let total = 0;

  db.transaction(() => {
    for (let r; total < a.capacidade && (r = s.desenfileirar()); total++) {
      up.run(agora(), r.id);
    }
  })();

  return { horario: h, total };
}

// ---------- Painel do visitante ----------

function painelVisitante(v) {
  const atracoes = Atracao.listar().map(a => ({
    id: a.id,
    nome: a.nome,
    tipo: a.tipo,
    capacidade: a.capacidade,
    idade_minima: a.idadeMinima,
    horarios: a.horarios().join(','),
    vip: a.filaVip ? 1 : 0,
    menor: v.idade() < a.idadeMinima,
    horas: a.horarios().map(h => {
      const s = a.sessao(h);
      return {
        h,
        n: s.tamanho,
        ja: s.posicaoDe(v) !== null,
        passou: !horarioAberto(h)
      };
    })
  }));

  const reservas = db.prepare(`
    SELECT r.*, a.nome atracao FROM reservas r
    JOIN atracoes a ON a.id = r.atracao_id
    WHERE r.visitante_id = ?
    ORDER BY r.id DESC
  `).all(v.id);

  const minhas = reservas.filter(r => r.status === 'aguardando').map(r => {
    const a = atracaoComFila(r.atracao_id);
    const s = a ? a.sessao(r.horario) : null;
    return {
      ...r,
      posicao: s ? s.posicaoDe(v) : null
    };
  });

  return { atracoes, minhas, historico: reservas };
}

// ---------- Estatísticas ----------

function stats() {
  const d = hoje();
  const dia = 'substr(r.entrou_em, 1, 10) = ?';
  const t = db.prepare(`
    SELECT COUNT(*) n, COALESCE(SUM(v.ingresso = 'vip'), 0) vip
    FROM reservas r JOIN visitantes v ON v.id = r.visitante_id
    WHERE ${dia}
  `).get(d);
  const topA = db.prepare(`
    SELECT a.nome, COUNT(*) n FROM reservas r
    JOIN atracoes a ON a.id = r.atracao_id
    WHERE ${dia} GROUP BY a.id ORDER BY n DESC LIMIT 1
  `).get(d);
  const topV = db.prepare(`
    SELECT v.nome, COUNT(*) n FROM reservas r
    JOIN visitantes v ON v.id = r.visitante_id
    WHERE ${dia} GROUP BY v.id ORDER BY n DESC LIMIT 1
  `).get(d);
  return { total: t.n, vip: t.vip, comuns: t.n - t.vip, topA, topV };
}

module.exports = { agora, fila, entrar, sessao, embarcar, painelVisitante, stats };