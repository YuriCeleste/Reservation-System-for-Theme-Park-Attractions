/**
 * ============================================================
 *  PARQUE
 * ============================================================
 *
 * A classe Parque é o "cérebro" do sistema. Ponto único de
 * armazenamento e regras de negócio. O server.js só repassa dados.
 *
 * ------------------------------------------------------------
 * O QUE ELA GUARDA
 * ------------------------------------------------------------
 *
 *   1. LISTAS ENCADEADAS
 *      - visitantes  → ListaVisitantes
 *      - atracoes    → ListaAtracoes
 *      - historico   → ListaHistorico
 *
 *   2. CONTADORES
 *      - contadorVisitante, contadorAtracao, contadorReserva
 *      - Substituem o AUTOINCREMENT do SQLite (issue #5).
 *
 *   3. RELÓGIO
 *      - Injetável. Em modo demo (npm run demo), fica parado.
 *      - Nenhuma classe lê a hora direto.
 *
 * ------------------------------------------------------------
 * CONTRATO DOS MÉTODOS QUE LEVANTAM ERRO
 * ------------------------------------------------------------
 *
 *   cadastrarVisitante(dados) → Visitante | lança Error
 *     Erros: 'CPF ou e-mail já cadastrado.'
 *
 *   cadastrarAtracao(dados)   → Atracao | lança Error
 *
 * ------------------------------------------------------------
 * CONTRATO DOS MÉTODOS QUE DEVOLVEM STRING DE ERRO
 * ------------------------------------------------------------
 *
 *   entrarNaFila(visitanteId, atracaoId, horario) → string | null
 *   trocarHorario(...) → string | null
 *
 * ------------------------------------------------------------
 * SOBRE A stats()
 * ------------------------------------------------------------
 *
 * A stats() usa o `ordenar()` da ListaDuplamenteEncadeada (issue
 * #1) para montar o ranking de atrações e visitantes do dia.
 *
 * O fluxo é:
 *   1. Filtra as reservas do dia percorrendo o histórico
 *   2. Conta manualmente (comuns, VIP, por atração, por visitante)
 *   3. Monta duas listas encadeadas (ranking de atrações e ranking
 *      de visitantes) com os contadores
 *   4. Chama `ordenar()` em cada ranking (decrescente por n)
 *   5. Pega o topo (inicio) de cada ranking
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

  /**
   * Cadastra um visitante.
   * @returns {Visitante}
   * @throws {Error} 'CPF ou e-mail já cadastrado.' ou validação da classe
   */
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

  /**
   * Cadastra uma atração.
   * @returns {Atracao}
   * @throws {Error} validação da classe Atracao
   */
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

  /**
   * Coloca o visitante na fila de uma atração + horário.
   * @returns {string|null}
   */
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

  /**
   * Embarca o próximo horário com gente na fila, até a capacidade.
   * @returns {{horario: string, total: number}|null}
   */
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

  /** Tira o visitante da fila (sem embarcar). @returns {Reserva|null} */
  sairDaFila(visitanteId, atracaoId, horario) {
    const v = this.buscarVisitante(visitanteId);
    const a = this.buscarAtracao(atracaoId);
    if (!v || !a) return null;
    const sessao = a.buscarSessao(horario);
    if (!sessao) return null;
    return sessao.fila.sairDaFila(v);
  }

  /**
   * Move o visitante de uma fila para outra.
   * @returns {string|null}
   */
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

  /**
   * Estatísticas do dia, percorrendo o histórico (sem SQL).
   *
   * Usa o `ordenar()` da ListaDuplamenteEncadeada (issue #1) para
   * montar os rankings. Fluxo:
   *
   *   1. Filtra as reservas do dia (percorrendo #historico)
   *   2. Conta manualmente: total, VIP, por atração, por visitante
   *   3. Monta uma lista encadeada para cada ranking
   *   4. Chama `ordenar()` (decrescente por n)
   *   5. Pega o topo (inicio) de cada ranking
   *
   * @returns {{total, vip, comuns, topA, topV}}
   */
  stats() {
    const ListaDuplamenteEncadeada = require('./ListaDuplamenteEncadeada');
    const hoje = this.#relogio.hoje();

    // 1. Filtra as reservas do dia
    const doDia = [];
    for (const r of this.#historico) {
      if (r.entrouEm.slice(0, 10) === hoje) doDia.push(r);
    }

    // 2. Contadores manuais
    let total = 0, vip = 0;
    const contAtracao = new Map();
    const contVisitante = new Map();

    for (const r of doDia) {
      total++;
      if (r.prioritaria) vip++;
      contAtracao.set(r.atracao.id, (contAtracao.get(r.atracao.id) || 0) + 1);
      contVisitante.set(r.visitante.id, (contVisitante.get(r.visitante.id) || 0) + 1);
    }

    // 3. Monta os rankings em listas encadeadas
    const rankingAtracao = new ListaDuplamenteEncadeada();
    for (const [id, n] of contAtracao) {
      rankingAtracao.inserirNoFim({ id, n, nome: this.buscarAtracao(id)?.nome });
    }

    const rankingVisitante = new ListaDuplamenteEncadeada();
    for (const [id, n] of contVisitante) {
      rankingVisitante.inserirNoFim({ id, n, nome: this.buscarVisitante(id)?.nome });
    }

    // 4. Ordena decrescente (maior n primeiro) — usa o `ordenar` da lista
    rankingAtracao.ordenar((a, b) => b.n - a.n);
    rankingVisitante.ordenar((a, b) => b.n - a.n);

    // 5. Pega o topo dos rankings
    const topA = rankingAtracao.inicio ? rankingAtracao.inicio.dado : null;
    const topV = rankingVisitante.inicio ? rankingVisitante.inicio.dado : null;

    return {
      total,
      vip,
      comuns: total - vip,
      topA: topA ? { nome: topA.nome, n: topA.n } : null,
      topV: topV ? { nome: topV.nome, n: topV.n } : null
    };
  }
}

// Singleton: uma instância única para todo o projeto.
module.exports = new Parque();