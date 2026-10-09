const path = require('path');
const express = require('express');
const db = require('./db');
const f = require('./filas');

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
  const d = req.body, cpf = (d.cpf || '').trim(), num = (d.cartao_numero || '').replace(/\D/g, '');
  const vip = d.ingresso === 'vip';
  let erro = null;
  if (!d.nome?.trim() || !d.email?.includes('@') || !d.nascimento) erro = 'Preencha nome, e-mail e data de nascimento.';
  else if (d.nascimento > f.agora().slice(0, 10)) erro = 'A data de nascimento não pode ser no futuro.';
  else if (!/^\d{11}$/.test(cpf)) erro = 'O CPF deve ter exatamente 11 dígitos.';
  else if (vip && !/^\d{13,19}$/.test(num)) erro = 'O ingresso VIP exige um cartão de crédito.';
  if (!erro) {
    try {
      const r = db.prepare(`INSERT INTO visitantes (nome, cpf, email, nascimento, ingresso, cartao_bandeira, cartao_final)
        VALUES (?,?,?,?,?,?,?)`).run(d.nome.trim(), cpf, d.email.trim(), d.nascimento, vip ? 'vip' : 'normal',
        num ? ({ 4: 'Visa', 5: 'Mastercard' }[num[0]] || 'Outro') : null, num ? num.slice(-4) : null); // só os 4 últimos dígitos
      res.cookie('visitante', r.lastInsertRowid);
      return res.redirect('/visitantes/painel?ok=1');
    } catch { erro = 'CPF ou e-mail já cadastrado.'; }
  }
  res.render('visitantes/cadastro', { aba: 'visitantes', sub: 'cadastro', erro, d });
});

app.get('/visitantes/painel', (req, res) => {
  if (req.query.visitante !== undefined) res.cookie('visitante', req.query.visitante);
  const id = req.query.visitante ?? cookies(req).visitante;
  const v = id ? db.prepare('SELECT * FROM visitantes WHERE id = ?').get(id) : null;
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
  const d = req.body, cap = +d.capacidade, idade = +(d.idade_minima || 0);
  const hs = (d.horarios || '').split(',').map(h => h.trim()).filter(Boolean).sort();
  let erro = null;
  if (!d.nome?.trim()) erro = 'Informe o nome da atração.';
  else if (!(cap > 0)) erro = 'A capacidade por sessão deve ser maior que zero.';
  else if (!hs.length || !hs.every(h => /^([01]\d|2[0-3]):[0-5]\d$/.test(h))) erro = 'Horários no formato HH:MM, separados por vírgula (ex.: 09:00, 14:00).';
  if (erro) return res.render('atracoes/cadastro', { aba: 'atracoes', sub: 'cadastro', erro, d, TIPOS });
  db.prepare('INSERT INTO atracoes (nome, tipo, capacidade, idade_minima, horarios, vip) VALUES (?,?,?,?,?,?)')
    .run(d.nome.trim(), d.tipo, cap, idade, hs.join(','), d.vip === 'sim' ? 1 : 0);
  res.redirect('/atracoes/painel?msg=' + encodeURIComponent('Atração cadastrada.'));
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