/**
 * ============================================================
 *  SERVER — Camada HTTP
 * ============================================================
 *
 * Este arquivo SÓ faz:
 *   1. Ler a requisição (req.body, req.query, cookies)
 *   2. Chamar o Parque
 *   3. Passar o resultado para a view (res.render)
 *   4. Devolver a resposta (redirect, render)
 *
 * Toda regra de negócio vive nas classes (Parque, Visitante,
 * Atracao, Reserva, Sessao, FilaVirtual). Aqui não tem `if`
 * de validação nem cálculo.
 *
 * ------------------------------------------------------------
 * CONTRATO DAS VIEWS
 * ------------------------------------------------------------
 *
 * Cada `res.render` abaixo documenta o formato dos dados que a
 * view recebe. Listas encadeadas são convertidas em array AQUI,
 * na borda, para a view só percorrer com forEach/map.
 */
const path = require('path');
const express = require('express');
const parque = require('./models/Parque');

// Roda o seed automaticamente quando em modo demo (npm run demo)
if (process.argv.includes('--sem-hora')) {
  require('./seed');
}

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// 12/10/2026 - 13h28
app.locals.fmt = s => s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)} - ${s.slice(11, 16).replace(':', 'h')}` : '—';

// O "login" é só o visitante escolhido no seletor, guardado em cookie.
const cookies = req => Object.fromEntries((req.headers.cookie || '').split('; ').filter(Boolean).map(c => c.split('=')));

// ---------- Início, métricas e créditos ----------

// View 'index': { aba: '' }
app.get('/', (req, res) => res.render('index', { aba: '' }));

// View 'metricas': { aba: 'metricas', s: { total, comuns, vip, topA, topV } }
app.get('/metricas', (req, res) => res.render('metricas', { aba: 'metricas', s: parque.stats() }));

// View 'creditos': { aba: 'creditos' }
app.get('/creditos', (req, res) => res.render('creditos', { aba: 'creditos' }));

// ---------- Visitantes ----------

// View 'visitantes/cadastro': { aba, sub, erro, d }
app.get('/visitantes', (req, res) =>
  res.render('visitantes/cadastro', { aba: 'visitantes', sub: 'cadastro', erro: null, d: {} }));

app.post('/visitantes', (req, res) => {
  const d = req.body;
  try {
    const v = parque.cadastrarVisitante({
      nome: d.nome,
      cpf: d.cpf,
      email: d.email,
      nascimento: d.nascimento,
      ingresso: d.ingresso || 'normal',
      cartaoNumero: d.cartao_numero
    });
    res.cookie('visitante', v.id);
    return res.redirect('/visitantes/painel?ok=1');
  } catch (e) {
    res.render('visitantes/cadastro', { aba: 'visitantes', sub: 'cadastro', erro: e.message, d });
  }
});

/**
 * View 'visitantes/painel': {
 *   aba, sub, ok, erro,
 *   v:          Visitante | null
 *   visitantes: [{ id, nome }]
 *   atracoes:   [{
 *     id, nome, tipo, capacidade, idade_minima, vip, menor,
 *     horas: [{ h, n, ja, passou }]
 *   }]
 *   minhas:     [{ atracao, horario, posicao }]
 *   historico:  [{ id, atracao, horario, status, entrou_em, embarcou_em }]
 * }
 */
app.get('/visitantes/painel', (req, res) => {
  if (req.query.visitante !== undefined) res.cookie('visitante', req.query.visitante);
  const id = req.query.visitante ?? cookies(req).visitante;
  const v = id ? parque.buscarVisitante(+id) : null;

  let painel = { atracoes: [], minhas: [], historico: [] };
  if (v) {
    // Lista de atrações com o estado da fila para esse visitante
    const atracoes = parque.listarAtracoes().map(a => {
      const horas = [];
      for (const s of a.sessoes) {
        horas.push({
          h: s.horario,
          n: s.fila.tamanho,
          ja: s.fila.posicaoDe(v) !== null,
          passou: !parque.relogio.horarioAberto(s.horario)
        });
      }
      return {
        id: a.id,
        nome: a.nome,
        tipo: a.tipo,
        capacidade: a.capacidade,
        idade_minima: a.idadeMinima,
        vip: a.filaVip ? 1 : 0,
        menor: v.idade(parque.relogio.hoje()) < a.idadeMinima,
        horas
      };
    });

    // Histórico de reservas do visitante
    const historico = parque.historico.porVisitante(v.id).map(r => ({
      id: r.id,
      atracao: r.atracao.nome,
      horario: r.horario,
      status: r.status,
      entrou_em: r.entrouEm,
      embarcou_em: r.embarcouEm
    }));

    // Reservas aguardando (com a posição)
    const minhas = [];
    for (const a of parque.listarAtracoes()) {
      for (const s of a.sessoes) {
        const pos = s.fila.posicaoDe(v);
        if (pos !== null) {
          minhas.push({ atracao: a.nome, horario: s.horario, posicao: pos });
        }
      }
    }

    painel = { atracoes, minhas, historico };
  }

  res.render('visitantes/painel', {
    aba: 'visitantes', sub: 'painel', ok: req.query.ok, erro: req.query.erro, v,
    visitantes: parque.listarVisitantes().map(x => ({ id: x.id, nome: x.nome })),
    ...painel
  });
});

// Redireciona sempre, não renderiza nada.
app.post('/visitantes/fila', (req, res) => {
  const erro = parque.entrarNaFila(+cookies(req).visitante, +req.body.atracao_id, req.body.horario);
  res.redirect('/visitantes/painel?' + (erro ? 'erro=' + encodeURIComponent(erro) : 'ok=fila'));
});

// ---------- Atrações ----------

const TIPOS = ['montanha-russa', 'trem fantasma', 'casa assombrada', 'labirinto', 'simulador', 'teatro'];

// View 'atracoes/cadastro': { aba, sub, erro, d, TIPOS }
app.get('/atracoes', (req, res) =>
  res.render('atracoes/cadastro', { aba: 'atracoes', sub: 'cadastro', erro: null, d: {}, TIPOS }));

app.post('/atracoes', (req, res) => {
  const d = req.body;
  try {
    parque.cadastrarAtracao({
      nome: d.nome,
      tipo: d.tipo,
      capacidade: d.capacidade,
      idadeMinima: d.idade_minima || 0,
      horarios: d.horarios,
      filaVip: d.vip === 'sim'
    });
    res.redirect('/atracoes/painel?msg=' + encodeURIComponent('Atração cadastrada.'));
  } catch (e) {
    res.render('atracoes/cadastro', { aba: 'atracoes', sub: 'cadastro', erro: e.message, d, TIPOS });
  }
});

/**
 * View 'atracoes/painel': {
 *   aba, sub, msg,
 *   linhas: [{
 *     id, nome, tipo, capacidade, idade_minima, vip,
 *     horarios: 'string,com,virgulas',
 *     sessao:   'HH:MM' | null,     ← próximo horário com fila (ou o primeiro)
 *     total:    number,
 *     proximos: [Reserva]           ← array (já convertido)
 *   }]
 * }
 */
app.get('/atracoes/painel', (req, res) => {
  const linhas = parque.listarAtracoes().map(a => {
    const sessoes = [...a.sessoes].map(s => ({
      horario: s.horario,
      tamanho: s.fila.tamanho
    }));
    const primeira = sessoes.find(s => s.tamanho > 0) || sessoes[0];

    return {
      id: a.id,
      nome: a.nome,
      tipo: a.tipo,
      capacidade: a.capacidade,
      idade_minima: a.idadeMinima,
      horarios: sessoes.map(s => s.horario).join(','),
      vip: a.filaVip ? 1 : 0,
      sessao: primeira ? primeira.horario : null,
      total: primeira ? primeira.tamanho : 0,
      proximos: primeira
        ? [...a.buscarSessao(primeira.horario).fila.proximos(a.capacidade)]
        : []
    };
  });
  res.render('atracoes/painel', { aba: 'atracoes', sub: 'painel', linhas, msg: req.query.msg });
});

// Redireciona sempre, não renderiza nada.
app.post('/atracoes/:id/embarcar', (req, res) => {
  const r = parque.embarcar(+req.params.id);
  const msg = r ? `Sessão das ${r.horario}: ${r.total} visitante(s) embarcaram.` : 'Ninguém na fila.';
  res.redirect('/atracoes/painel?msg=' + encodeURIComponent(msg));
});

app.listen(3000, () => console.log('Parque no ar: http://localhost:3000'));