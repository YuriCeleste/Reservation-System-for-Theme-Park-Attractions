  // ==========================================================
  //  ESTATÍSTICAS
  // ==========================================================
  stats() {
    const ListaDuplamenteEncadeada = require('./ListaDuplamenteEncadeada');
    const hoje = this.#relogio.hoje();

    const doDia = [];
    for (const r of this.#historico) {
      if (r.entrouEm.slice(0, 10) === hoje) doDia.push(r);
    }

    let total = 0, vip = 0;
    const contAtracao = new Map();
    const contVisitante = new Map();

    for (const r of doDia) {
      total++;
      if (r.prioritaria) vip++;
      contAtracao.set(r.atracao.id, (contAtracao.get(r.atracao.id) || 0) + 1);
      contVisitante.set(r.visitante.id, (contVisitante.get(r.visitante.id) || 0) + 1);
    }

    const rankingAtracoes = new ListaDuplamenteEncadeada();
    for (const [id, n] of contAtracao) {
      rankingAtracoes.inserirNoFim({ id, n, nome: this.buscarAtracao(id)?.nome });
    }
    rankingAtracoes.ordenar((a, b) => b.n - a.n);

    const rankingVisitantes = new ListaDuplamenteEncadeada();
    for (const [id, n] of contVisitante) {
      rankingVisitantes.inserirNoFim({ id, n, nome: this.buscarVisitante(id)?.nome });
    }
    rankingVisitantes.ordenar((a, b) => b.n - a.n);

    const arrA = []; for (const r of rankingAtracoes) arrA.push(r);
    const arrV = []; for (const r of rankingVisitantes) arrV.push(r);

    return {
      total, vip, comuns: total - vip,
      rankingAtracoes: arrA,
      rankingVisitantes: arrV,
      topA: arrA[0] || null,
      topV: arrV[0] || null
    };
  }
}   ← fecha a classe

module.exports = new Parque();/**
 * ============================================================
 *  PARQUE
 * ============================================================
 * A classe Parque é o "cérebro" do sistema.
 * Ela guarda as listas encadeadas, os contadores de IDs, o relógio
 * e todas as regras de negócio. O server.js só repassa dados.
 */
class Parque {
  #visitantes = new (require('./ListaVisitantes'))();
  #atracoes = new (require('./ListaAtracoes'))();
  #historico = new (require('./ListaHistorico'))();

  #contadorVisitante = new (require('./Contador'))();
  #contadorAtracao = new (require('./Contador'))();
  #contadorReserva = new (require('./Contador'))();

  #relogio;

  constructor(relogio) {
    const Relogio = require('./Relogio');
    this.#relogio = relogio || new Relogio({ semHora: process.argv.includes('--sem-hora') });
  }

  // ==========================================================
  //  GETTERS
  // ==========================================================
  get relogio()    { return this.#relogio; }
  get visitantes() { return this.#visitantes; }
  get atracoes()   { return this.#atracoes; }
  get historico()  { return this.#historico; }

  // ==========================================================
  //  CADASTROS
  // ==========================================================
  cadastrarVisitante(dados) {
    const Visitante = require('./Visitante');
    if (this.#visitantes.buscarPorCpf(dados.cpf) || this.#visitantes.buscarPorEmail(dados.email)) {
      throw new Error('CPF ou e-mail já cadastrado.');
    }
    const v = new Visitante({
      id: this.#contadorVisitante.proximoId(),
      nome: dados.nome,
      cpf: dados.cpf,
      email: dados.email,
      nascimento: dados.nascimento,
      ingresso: dados.ingresso || 'normal',
      cartao: { numero: dados.cartaoNumero },
      hoje: this.#relogio.hoje()
    });
    this.#visitantes.inserirNoFim(v);
    return v;
  }

  cadastrarAtracao(dados) {
    const Atracao = require('./Atracao');
    const a = new Atracao({
      id: this.#contadorAtracao.proximoId(),
      nome: dados.nome,
      tipo: dados.tipo,
      capacidade: dados.capacidade,
      idadeMinima: dados.idadeMinima || 0,
      horarios: dados.horarios,
      filaVip: dados.filaVip
    });
    this.#atracoes.inserirNoFim(a);
    return a;
  }

  // ==========================================================
  //  CONSULTAS
  // ==========================================================
  buscarVisitante(id)        { const no = this.#visitantes.buscar(v => v.id === id); return no ? no.dado : null; }
  buscarVisitantePorCpf(cpf) { return this.#visitantes.buscarPorCpf(cpf); }
  buscarVisitantePorEmail(e) { return this.#visitantes.buscarPorEmail(e); }
  buscarAtracao(id)          { const no = this.#atracoes.buscar(a => a.id === id); return no ? no.dado : null; }

  listarVisitantes() {
    const arr = [];
    for (const v of this.#visitantes) arr.push(v);
    return arr.sort((a, b) => a.nome.localeCompare(b.nome));
  }

  listarAtracoes() {
    const arr = [];
    for (const a of this.#atracoes) arr.push(a);
    return arr.sort((a, b) => a.nome.localeCompare(b.nome));
  }

  // ==========================================================
  //  FILA VIRTUAL
  // ==========================================================
  entrarNaFila(visitanteId, atracaoId, horario) {
    const Reserva = require('./Reserva');
    const v = this.buscarVisitante(visitanteId);
    const a = this.buscarAtracao(atracaoId);

    if (!v || !a) return 'Visitante ou atração não encontrados.';

    const sessao = a.buscarSessao(horario);
    if (!sessao) return 'Horário inválido para esta atração.';
    if (v.idade(this.#relogio.hoje()) < a.idadeMinima) {
      return `Idade mínima para esta atração: ${a.idadeMinima} anos.`;
    }
    if (!this.#relogio.horarioAberto(horario)) return 'Esse horário já passou.';
    if (sessao.fila.posicaoDe(v) !== null) return 'Você já está nessa fila.';

    const prioritaria = a.concedePrioridadeA(v);
    const r = new Reserva({
      id: this.#contadorReserva.proximoId(),
      visitante: v,
      atracao: a,
      horario,
      prioritaria,
      entrouEm: this.#relogio.agora()
    });
    this.#historico.inserirNoFim(r);
    sessao.fila.enfileirar(r);
    return null;
  }

  embarcar(atracaoId) {
    const a = this.buscarAtracao(atracaoId);
    if (!a) return null;

    let horario = null;
    for (const s of a.sessoes) {
      if (!s.fila.estaVazia() && this.#relogio.horarioAberto(s.horario)) {
        horario = s.horario;
        break;
      }
    }
    if (!horario) return null;

    const sessao = a.buscarSessao(horario);
    let total = 0;
    while (total < a.capacidade && !sessao.fila.estaVazia()) {
      const r = sessao.fila.desenfileirar();
      r.concluir(this.#relogio.agora());
      total++;
    }
    return { horario, total };
  }

  sairDaFila(visitanteId, atracaoId, horario) {
    const v = this.buscarVisitante(visitanteId);
    const a = this.buscarAtracao(atracaoId);
    if (!v || !a) return null;
    const sessao = a.buscarSessao(horario);
    if (!sessao) return null;
    return sessao.fila.sairDaFila(v);
  }

  trocarHorario(visitanteId, atracaoId, horarioAtual, novoHorario) {
    const v = this.buscarVisitante(visitanteId);
    const a = this.buscarAtracao(atracaoId);
    if (!v || !a) return 'Visitante ou atração não encontrados.';

    const sessaoAtual = a.buscarSessao(horarioAtual);
    if (!sessaoAtual || sessaoAtual.fila.posicaoDe(v) === null) {
      return 'Você não está na fila do horário atual.';
    }

    const sessaoNova = a.buscarSessao(novoHorario);
    if (!sessaoNova) return 'Horário inválido.';
    if (sessaoNova.fila.posicaoDe(v) !== null) return 'Você já está nessa fila.';

    if (v.idade(this.#relogio.hoje()) < a.idadeMinima) {
      return `Idade mínima para esta atração: ${a.idadeMinima} anos.`;
    }
    if (!this.#relogio.horarioAberto(novoHorario)) return 'Esse horário já passou.';

    sessaoAtual.fila.sairDaFila(v);
    const Reserva = require('./Reserva');
    const nova = new Reserva({
      id: this.#contadorReserva.proximoId(),
      visitante: v,
      atracao: a,
      horario: novoHorario,
      prioritaria: a.concedePrioridadeA(v),
      entrouEm: this.#relogio.agora()
    });
    this.#historico.inserirNoFim(nova);
    sessaoNova.fila.enfileirar(nova);
    return null;
  }

  // ==========================================================
  //  ESTRUTURA DA FILA (para desenhar como lista encadeada)
  // ==========================================================
  estruturaDaFila(atracaoId, horario) {
    const a = this.buscarAtracao(atracaoId);
    if (!a) return { nos: [], inicio: null, fim: null, ultimoVip: null, tamanho: 0 };
    const sessao = a.buscarSessao(horario);
    if (!sessao) return { nos: [], inicio: null, fim: null, ultimoVip: null, tamanho: 0 };

    const fila = sessao.fila;
    const nos = [];
    for (const r of fila) {
      nos.push({ nome: r.visitante.nome, vip: r.prioritaria, id: r.id });
    }

    return {
      nos,
      inicio: fila.inicio ? fila.inicio.dado.visitante.nome : null,
      fim: fila.fim ? fila.fim.dado.visitante.nome : null,
      ultimoVip: fila.ultimoVip ? fila.ultimoVip.dado.visitante.nome : null,
      tamanho: fila.tamanho
    };
  }

  // ==========================================================
  //  ESTATÍSTICAS
  // ==========================================================
  stats() {
    const ListaDuplamenteEncadeada = require('./ListaDuplamenteEncadeada');
    const hoje = this.#relogio.hoje();

    const doDia = [];
    for (const r of this.#historico) {
      if (r.entrouEm.slice(0, 10) === hoje) doDia.push(r);
    }

    let total = 0, vip = 0;
    const contAtracao = new Map();
    const contVisitante = new Map();

    for (const r of doDia) {
      total++;
      if (r.prioritaria) vip++;
      contAtracao.set(r.atracao.id, (contAtracao.get(r.atracao.id) || 0) + 1);
      contVisitante.set(r.visitante.id, (contVisitante.get(r.visitante.id) || 0) + 1);
    }

    const rankingAtracoes = new ListaDuplamenteEncadeada();
    for (const [id, n] of contAtracao) {
      rankingAtracoes.inserirNoFim({ id, n, nome: this.buscarAtracao(id)?.nome });
    }
    rankingAtracoes.ordenar((a, b) => b.n - a.n);

    const rankingVisitantes = new ListaDuplamenteEncadeada();
    for (const [id, n] of contVisitante) {
      rankingVisitantes.inserirNoFim({ id, n, nome: this.buscarVisitante(id)?.nome });
    }
    rankingVisitantes.ordenar((a, b) => b.n - a.n);

    const arrA = []; for (const r of rankingAtracoes) arrA.push(r);
    const arrV = []; for (const r of rankingVisitantes) arrV.push(r);

    return {
      total, vip, comuns: total - vip,
      rankingAtracoes: arrA,
      rankingVisitantes: arrV,
      topA: arrA[0] || null,
      topV: arrV[0] || null
    };
  }
}

// Singleton
module.exports = new Parque();