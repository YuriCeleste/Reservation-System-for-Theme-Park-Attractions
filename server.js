const path = require('path');
const express = require('express');
const db = require('./db');
const f = require('./filas');
const Ingresso = require('./models/Ingresso');
const Visitante = require('./models/Visitante');
const Atracao = require('./models/Atracao');

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
app.get('/', (req, res) => res.render('index', { aba: '' }));
app.get('/metricas', (req, res) => res.render('metricas', { aba: 'metricas', s: f.stats() }));
app.get('/creditos', (req, res) => res.render('creditos', { aba: 'creditos' }));

// ---------- Visitantes ----------
app.get('/visitantes', (req, res) =>
  res.render('visitantes/cadastro', { aba: 'visitantes', sub: 'cadastro', erro: null, d: {} }));

app.post('/visitantes', (req, res) => {
  const d = req.body;
  try {
    const v = new Visitante({
      nome: d.nome,
      cpf: d.cpf,
      email: d.email,
      nascimento: d.nascimento,
      ingresso: d.ingresso || 'normal',
      cartao: { numero: d.cartao_numero }
    });
    v.salvar();
    res.cookie('visitante', v.id);
    return res.redirect('/visitantes/painel?ok=1');
  } catch (e) {
    const erro = e.message.includes('UNIQUE') ? 'CPF ou e-mail já cadastrado.' : e.message;
    res.render('visitantes/cadastro', { aba: 'visitantes', sub: 'cadastro', erro, d });
  }
});

app.get('/visitantes/painel', (req, res) => {
  if (req.query.visitante !== undefined) res.cookie('visitante', req.query.visitante);
  const id = req.query.visitante ?? cookies(req).visitante;
  const v = id ? Visitante.buscar(id) : null;
  res.render('visitantes/painel', {
    aba: 'visitantes', sub: 'painel', ok: req.query.ok, erro: req.query.erro, v,
    visitantes: db.prepare('SELECT id, nome FROM visitantes ORDER BY nome').all(),
    atracoes: [], minhas: [], historico: [], ...(v ? f.painelVisitante(v) : {})
  });
});

app.post('/visitantes/fila', (req, res) => {
  const erro = f.entrar(cookies(req).visitante, +req.body.atracao_id, req.body.horario);
  res.redirect('/visitantes/painel?' + (erro ? 'erro=' + encodeURIComponent(erro) : 'ok=fila'));
});

// ---------- Atrações ----------
const TIPOS = ['montanha-russa', 'trem fantasma', 'casa assombrada', 'labirinto', 'simulador', 'teatro'];

app.get('/atracoes', (req, res) =>
  res.render('atracoes/cadastro', { aba: 'atracoes', sub: 'cadastro', erro: null, d: {}, TIPOS }));

app.post('/atracoes', (req, res) => {
  const d = req.body;
  try {
    const a = new Atracao({
      nome: d.nome,
      tipo: d.tipo,
      capacidade: d.capacidade,
      idadeMinima: d.idade_minima || 0,
      horarios: d.horarios,
      filaVip: d.vip === 'sim'
    });
    a.salvar();
    res.redirect('/atracoes/painel?msg=' + encodeURIComponent('Atração cadastrada.'));
  } catch (e) {
    res.render('atracoes/cadastro', { aba: 'atracoes', sub: 'cadastro', erro: e.message, d, TIPOS });
  }
});

app.get('/atracoes/painel', (req, res) => {
  const linhas = db.prepare('SELECT * FROM atracoes ORDER BY nome').all().map(a => {
    const h = f.sessao(a.id);
    return {
      ...a, sessao: h,
      total: db.prepare("SELECT COUNT(*) n FROM reservas WHERE atracao_id = ? AND status = 'aguardando'").get(a.id).n,
      proximos: h ? f.fila(a.id, h).slice(0, a.capacidade) : []
    };
  });
  res.render('atracoes/painel', { aba: 'atracoes', sub: 'painel', linhas, msg: req.query.msg });
});

app.post('/atracoes/:id/embarcar', (req, res) => {
  const r = f.embarcar(+req.params.id);
  const msg = r ? `Sessão das ${r.horario}: ${r.total} visitante(s) embarcaram.` : 'Ninguém na fila.';
  res.redirect('/atracoes/painel?msg=' + encodeURIComponent(msg));
});

app.listen(3000, () => console.log('Parque no ar: http://localhost:3000'));