/**
 * ============================================================
 *  PARQUE
 * ============================================================
 *
 * A classe Parque é o "cérebro" do sistema. Ela é o ponto único
 * de armazenamento e de regras de negócio. Tudo o que o server.js
 * faz é chamar métodos dela e repassar os resultados.
 *
 * ------------------------------------------------------------
 * O QUE ELA GUARDA
 * ------------------------------------------------------------
 *
 *   1. LISTAS ENCADEADAS
 *      - visitantes  → ListaVisitantes
 *      - atracoes    → ListaAtracoes
 *      - historico   → ListaHistorico (todas as reservas)
 *
 *   2. CONTADORES
 *      - contadorVisitante, contadorAtracao, contadorReserva
 *      - Cada um gera IDs sequenciais. Substituem o AUTOINCREMENT
 *        do SQLite (a issue #5 pede isso).
 *
 *   3. RELÓGIO
 *      - Injetável. Em modo demo (npm run demo), fica "parado"
 *        para as sessões estarem sempre abertas.
 *      - Nenhuma classe lê a hora direto: sempre usa o relógio.
 *
 * ------------------------------------------------------------
 * O QUE ELA FAZ
 * ------------------------------------------------------------
 *
 *   - cadastrarVisitante(dados)
 *   - cadastrarAtracao(dados)
 *   - entrarNaFila(visitanteId, atracaoId, horario)
 *   - embarcar(atracaoId)
 *   - sairDaFila(visitanteId, atracaoId, horario)
 *   - trocarHorario(visitanteId, atracaoId, horarioAtual, novoHorario)
 *   - stats()  → total do dia, comuns, VIP, top atração, top visitante
 */
class Parque {
  // Listas encadeadas (substituem o SQLite)
  #visitantes = new (require('./ListaVisitantes'))();
  #atracoes = new (require('./ListaAtracoes'))();
  #historico = new (require('./ListaHistorico'))();

  // Contadores de IDs
  #contadorVisitante = new (require('./Contador'))();
  #contadorAtracao = new (require('./Contador'))();
  #contadorReserva = new (require('./Contador'))();

  // Relógio injetável
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

    if (this.#visitantes.buscarPorCpf(dados.cpf)) {
      throw new Error('CPF já cadastrado.');
    }
    if (this.#visitantes.buscarPorEmail(dados.email)) {
      throw new Error('E-mail já cadastrado.');
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
  //  ESTATÍSTICAS
  // ==========================================================

  stats() {
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

    const topA = this.#top(contAtracao, id => this.buscarAtracao(id)?.nome);
    const topV = this.#top(contVisitante, id => this.buscarVisitante(id)?.nome);

    return { total, vip, comuns: total - vip, topA, topV };
  }

  #top(contagem, nomeDe) {
    let melhorId = null, melhorN = 0;
    for (const [id, n] of contagem) {
      if (n > melhorN) { melhorId = id; melhorN = n; }
    }
    return melhorId === null ? null : { nome: nomeDe(melhorId), n: melhorN };
  }
}

// Singleton: uma instância única para todo o projeto.
module.exports = new Parque();