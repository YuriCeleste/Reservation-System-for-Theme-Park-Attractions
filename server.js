const path = require('path');
const express = require('express');
const parque = require('./models/Parque');

// Roda os dados de exemplo automaticamente quando em modo demo (npm run demo)
if (process.argv.includes('--sem-hora')) {
  require('./dados-exemplo');
}

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// 12/10/2026 - 13h28
app.locals.fmt = s => s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)} - ${s.slice(11, 16).replace(':', 'h')}` : '—';

const cookies = req => Object.fromEntries((req.headers.cookie || '').split('; ').filter(Boolean).map(c => c.split('=')));

// ---------- Início, métricas e créditos ----------
app.get('/', (req, res) => res.render('index', { aba: '' }));
app.get('/metricas', (req, res) => res.render('metricas', { aba: 'metricas', s: parque.stats() }));
app.get('/creditos', (req, res) => res.render('creditos', { aba: 'creditos' }));

// ---------- Visitantes ----------
app.get('/visitantes', (req, res) =>
  res.render('visitantes/cadastro', { aba: 'visitantes', sub: 'cadastro', erro: null, d: {} }));

app.post('/visitantes', (req, res) => {
  const d = req.body;
  try {
    const v = parque.cadastrarVisitante({
      nome: d.nome, cpf: d.cpf, email: d.email, nascimento: d.nascimento,
      ingresso: d.ingresso || 'normal', cartaoNumero: d.cartao_numero
    });
    res.cookie('visitante', v.id);
    return res.redirect('/visitantes/painel?ok=1');
  } catch (e) {
    res.render('visitantes/cadastro', { aba: 'visitantes', sub: 'cadastro', erro: e.message, d });
  }
});

app.get('/visitantes/painel', (req, res) => {
  if (req.query.visitante !== undefined) res.cookie('visitante', req.query.visitante);
  const id = req.query.visitante ?? cookies(req).visitante;
  const v = id ? parque.buscarVisitante(+id) : null;

  let painel = { atracoes: [], minhas: [], historico: [] };
  if (v) {
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
        id: a.id, nome: a.nome, tipo: a.tipo, capacidade: a.capacidade,
        idade_minima: a.idadeMinima, vip: a.filaVip ? 1 : 0,
        menor: v.idade(parque.relogio.hoje()) < a.idadeMinima, horas
      };
    });

    const historico = parque.historico.porVisitante(v.id).map(r => ({
      id: r.id, atracao: r.atracao.nome, horario: r.horario,
      status: r.status, entrou_em: r.entrouEm, embarcou_em: r.embarcouEm
    }));

    const minhas = [];
    for (const a of parque.listarAtracoes()) {
      for (const s of a.sessoes) {
        const pos = s.fila.posicaoDe(v);
        if (pos !== null) minhas.push({ atracao: a.nome, horario: s.horario, posicao: pos });
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

app.post('/visitantes/fila', (req, res) => {
  const erro = parque.entrarNaFila(+cookies(req).visitante, +req.body.atracao_id, req.body.horario);
  res.redirect('/visitantes/painel?' + (erro ? 'erro=' + encodeURIComponent(erro) : 'ok=fila'));
});

// ---------- Atrações ----------
const TIPOS = ['montanha-russa', 'trem fantasma', 'casa assombrada', 'labirinto', 'simulador', 'teatro'];

app.get('/atracoes', (req, res) =>
  res.render('atracoes/cadastro', { aba: 'atracoes', sub: 'cadastro', erro: null, d: {}, TIPOS }));

app.post('/atracoes', (req, res) => {
  const d = req.body;
  try {
    parque.cadastrarAtracao({
      nome: d.nome, tipo: d.tipo, capacidade: d.capacidade,
      idadeMinima: d.idade_minima || 0, horarios: d.horarios, filaVip: d.vip === 'sim'
    });
    res.redirect('/atracoes/painel?msg=' + encodeURIComponent('Atração cadastrada.'));
  } catch (e) {
    res.render('atracoes/cadastro', { aba: 'atracoes', sub: 'cadastro', erro: e.message, d, TIPOS });
  }
});

app.get('/atracoes/painel', (req, res) => {
  const linhas = parque.listarAtracoes().map(a => {
    const sessoes = [...a.sessoes].map(s => ({
      horario: s.horario,
      tamanho: s.fila.tamanho,
      estrutura: parque.estruturaDaFila(a.id, s.horario)
    }));

    return {
      id: a.id, nome: a.nome, tipo: a.tipo, capacidade: a.capacidade,
      idade_minima: a.idadeMinima, vip: a.filaVip ? 1 : 0,
      sessoes
    };
  });
  res.render('atracoes/painel', { aba: 'atracoes', sub: 'painel', linhas, msg: req.query.msg });
});

app.post('/atracoes/:id/embarcar', (req, res) => {
  const r = parque.embarcar(+req.params.id);
  const msg = r ? `Sessão das ${r.horario}: ${r.total} visitante(s) embarcaram.` : 'Ninguém na fila.';
  res.redirect('/atracoes/painel?msg=' + encodeURIComponent(msg));
});

app.listen(3000, () => console.log('Parque no ar: http://localhost:3000'));