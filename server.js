const path = require('path');
const express = require('express');
const parque = require('./parque-instancia');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// 12/10/2026 - 13h28
app.locals.fmt = s => s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)} - ${s.slice(11, 16).replace(':', 'h')}` : '—';

// O "login" é só o visitante escolhido no seletor, guardado em cookie.
const cookies = req => Object.fromEntries((req.headers.cookie || '').split('; ').filter(Boolean).map(c => c.split('=')));

// As regras vivem no Parque, que lança Error com a mensagem para o usuário.
// Aqui as listas viram arrays só na hora de entregar os dados às views (fronteira da tela).

// ---------- Início, métricas e créditos ----------
app.get('/', (req, res) => res.render('index', { aba: '' }));
app.get('/metricas', (req, res) => res.render('metricas', { aba: 'metricas', s: parque.estatisticas() }));
app.get('/creditos', (req, res) => res.render('creditos', { aba: 'creditos' }));

// ---------- Visitantes ----------
app.get('/visitantes', (req, res) =>
  res.render('visitantes/cadastro', { aba: 'visitantes', sub: 'cadastro', erro: null, d: {} }));

app.post('/visitantes', (req, res) => {
  const d = req.body;
  try {
    const visitante = parque.cadastrarVisitante({
      nome: d.nome, cpf: d.cpf, email: d.email, nascimento: d.nascimento,
      ingresso: d.ingresso === 'vip' ? 'vip' : 'normal',
      cartao: { numero: d.cartao_numero }
    });
    res.cookie('visitante', visitante.id);
    res.redirect('/visitantes/painel?ok=1');
  } catch (erro) {
    res.render('visitantes/cadastro', { aba: 'visitantes', sub: 'cadastro', erro: erro.message, d });
  }
});

app.get('/visitantes/painel', (req, res) => {
  if (req.query.visitante !== undefined) res.cookie('visitante', req.query.visitante);
  const id = req.query.visitante ?? cookies(req).visitante;
  const v = id ? parque.buscarVisitante(id) : null;

  let atracoes = [], minhas = [], historico = [];
  if (v) {
    const relogio = parque.relogio;
    atracoes = [...parque.atracoesPorNome()].map(a => ({
      id: a.id, nome: a.nome, idade_minima: a.idadeMinima, vip: a.filaVip,
      menor: v.idade(relogio.hoje()) < a.idadeMinima,
      horas: [...a.sessoes].map(s => ({
        h: s.horario, n: s.fila.tamanho,
        ja: s.fila.buscarPorVisitante(v) !== null,
        passou: !relogio.horarioAberto(s.horario)
      }))
    }));
    minhas = [...parque.reservasAguardando(v.id)].map(r => ({
      atracao: r.atracao.nome,
      atracao_id: r.atracao.id,
      horario: r.horario,
      posicao: parque.posicaoDe(v.id, r.atracao.id, r.horario),
      outrosHorarios: [...r.atracao.sessoes]
        .map(s => s.horario)
        .filter(h => h !== r.horario)
    }));
    historico = [...parque.historicoDe(v.id)].map(r => ({
      atracao: r.atracao.nome, entrou_em: r.entrouEm, embarcou_em: r.embarcouEm
    }));
  }
  res.render('visitantes/painel', {
    aba: 'visitantes', sub: 'painel', ok: req.query.ok, erro: req.query.erro, v,
    visitantes: [...parque.visitantesPorNome()], atracoes, minhas, historico
  });
});

app.post('/visitantes/fila', (req, res) => {
  try {
    parque.entrarNaFila(cookies(req).visitante, +req.body.atracao_id, req.body.horario);
    res.redirect('/visitantes/painel?ok=fila');
  } catch (erro) {
    res.redirect('/visitantes/painel?erro=' + encodeURIComponent(erro.message));
  }
});

app.post('/visitantes/sair-fila', (req, res) => {
  try {
    parque.sairDaFila(cookies(req).visitante, +req.body.atracao_id, req.body.horario);
    res.redirect('/visitantes/painel?ok=saiu');
  } catch (erro) {
    res.redirect('/visitantes/painel?erro=' + encodeURIComponent(erro.message));
  }
});

app.post('/visitantes/trocar-horario', (req, res) => {
  try {
    parque.trocarHorario(cookies(req).visitante, +req.body.atracao_id, req.body.horario_atual, req.body.novo_horario);
    res.redirect('/visitantes/painel?ok=trocou');
  } catch (erro) {
    res.redirect('/visitantes/painel?erro=' + encodeURIComponent(erro.message));
  }
});

// ---------- Atrações ----------
const TIPOS = ['montanha-russa', 'trem fantasma', 'casa assombrada', 'labirinto', 'simulador', 'teatro'];

app.get('/atracoes', (req, res) =>
  res.render('atracoes/cadastro', { aba: 'atracoes', sub: 'cadastro', erro: null, d: {}, TIPOS }));

app.post('/atracoes', (req, res) => {
  const d = req.body;
  try {
    parque.cadastrarAtracao({
      nome: d.nome, tipo: d.tipo, capacidade: d.capacidade, idadeMinima: d.idade_minima || 0,
      horarios: d.horarios, filaVip: d.vip === 'sim'
    });
    res.redirect('/atracoes/painel?msg=' + encodeURIComponent('Atração cadastrada.'));
  } catch (erro) {
    res.render('atracoes/cadastro', { aba: 'atracoes', sub: 'cadastro', erro: erro.message, d, TIPOS });
  }
});

app.get('/atracoes/painel', (req, res) => {
  const linhas = [...parque.atracoesPorNome()].map(a => {
    const sessao = parque.sessaoDeEmbarque(a.id);
    return {
      id: a.id, nome: a.nome, capacidade: a.capacidade,
      idade_minima: a.idadeMinima, vip: a.filaVip,
      total: parque.totalNaFila(a.id),
      sessao: sessao ? sessao.horario : null,
      proximos: sessao ? [...sessao.fila.proximos(a.capacidade)].map(r => ({ nome: r.visitante.nome })) : [],
      sessoes: [...a.sessoes].map(s => ({
        horario: s.horario,
        tamanho: s.fila.tamanho,
        estrutura: {
          tamanho: s.fila.tamanho,
          nos: [...s.fila].map(r => ({ nome: r.visitante.nome, vip: r.prioritaria })),
          ultimoVip: s.fila.ultimoVip ? s.fila.ultimoVip.dado.visitante.nome : null
        }
      }))
    };
  });
  res.render('atracoes/painel', { aba: 'atracoes', sub: 'painel', linhas, msg: req.query.msg });
});

app.post('/atracoes/:id/embarcar', (req, res) => {
  try {
    const r = parque.embarcar(+req.params.id);
    const msg = r ? `Sessão das ${r.horario}: ${r.total} visitante(s) embarcaram.` : 'Ninguém na fila.';
    res.redirect('/atracoes/painel?msg=' + encodeURIComponent(msg));
  } catch (erro) {
    res.redirect('/atracoes/painel?msg=' + encodeURIComponent(erro.message));
  }
});

const PORTA = process.env.PORT || 3000;
app.listen(PORTA, () => {
  console.log(`Parque no ar: http://localhost:${PORTA}`);
  console.log(`Carregado do banco: ${parque.atracoes.tamanho} atrações, ${parque.visitantes.tamanho} visitantes, ${parque.historico.tamanho} reservas.`);
  if (parque.relogio.semHora) console.log('Modo demo: todos os horários ficam abertos.');
});