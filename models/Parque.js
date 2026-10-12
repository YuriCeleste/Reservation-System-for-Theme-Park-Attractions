const ListaDuplamenteEncadeada = require('./ListaDuplamenteEncadeada');
const Relogio = require('./Relogio');
const Atracao = require('./Atracao');
const Visitante = require('./Visitante');
const Reserva = require('./Reserva');
const SemPersistencia = require('../persistencia/SemPersistencia');

const SELECIONE = 'Selecione um visitante e um horário válido.';

/**
 * O parque: guarda os dados principais em listas encadeadas e aplica as regras de negócio.
 * Substitui o antigo filas.js e não usa banco de dados.
 *
 * - atracoes, visitantes e historico são listas duplamente encadeadas;
 * - cada Atracao guarda suas Sessao em lista, e cada Sessao tem a sua FilaVirtual;
 * - os ids vêm de contadores; a hora vem do Relogio (injetável);
 * - os métodos recebem ids (como chegam da web) e lançam Error com a mensagem para o usuário;
 * - a persistência é um Repositorio injetado: depois de cada mudança o parque avisa o repositório,
 *   e carregar() reconstrói as listas a partir dele. Se o repositório falhar, o erro sobe para quem
 *   chamou (o estado em memória já mudou: para este projeto isso é suficiente).
 */
class Parque {
  #relogio;
  #repositorio;
  #atracoes = new ListaDuplamenteEncadeada();
  #visitantes = new ListaDuplamenteEncadeada();
  #historico = new ListaDuplamenteEncadeada(); // todas as reservas, da mais antiga para a mais nova
  #proximoIdAtracao = 1;
  #proximoIdVisitante = 1;
  #proximoIdReserva = 1;

  constructor(relogio = new Relogio(), repositorio = new SemPersistencia()) {
    this.#relogio = relogio;
    this.#repositorio = repositorio;
  }

  get relogio() { return this.#relogio; }

  // ---------- Cadastros ----------

  cadastrarAtracao(dados) {
    const atracao = new Atracao({ ...dados, id: this.#proximoIdAtracao }); // valida os dados
    this.#atracoes.inserirNoFim(atracao);
    this.#proximoIdAtracao++; // o id só é consumido se o cadastro deu certo
    this.#repositorio.salvarAtracao(atracao);
    return atracao;
  }

  cadastrarVisitante(dados) {
    const visitante = new Visitante({ ...dados, id: this.#proximoIdVisitante, hoje: this.#relogio.hoje() });
    const email = visitante.email.toLowerCase();
    const repetido = this.#visitantes.buscar(v => v.cpf === visitante.cpf || v.email.toLowerCase() === email);
    if (repetido) throw new Error('CPF ou e-mail já cadastrado.');
    this.#visitantes.inserirNoFim(visitante);
    this.#proximoIdVisitante++;
    this.#repositorio.salvarVisitante(visitante);
    return visitante;
  }

  // ---------- Consultas ----------

  buscarAtracao(id) {
    const no = this.#atracoes.buscar(a => a.id === Number(id));
    return no ? no.dado : null;
  }

  buscarVisitante(id) {
    const no = this.#visitantes.buscar(v => v.id === Number(id));
    return no ? no.dado : null;
  }

  /** Cópias das listas: quem consulta não consegue mexer na estrutura do parque. */
  get atracoes() { return this.#atracoes.buscarTodos(() => true); }
  get visitantes() { return this.#visitantes.buscarTodos(() => true); }
  get historico() { return this.#historico.buscarTodos(() => true); }

  atracoesPorNome() {
    const copia = this.atracoes;
    copia.ordenar((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    return copia;
  }

  visitantesPorNome() {
    const copia = this.visitantes;
    copia.ordenar((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    return copia;
  }

  /** Reservas do visitante, da mais recente para a mais antiga. */
  historicoDe(visitanteId) {
    const resultado = new ListaDuplamenteEncadeada();
    this.#historico.percorrer(reserva => {
      if (reserva.visitante.id === Number(visitanteId)) resultado.inserirNoInicio(reserva);
    });
    return resultado;
  }

  /** Reservas em que o visitante está aguardando, por ordem de entrada. */
  reservasAguardando(visitanteId) {
    return this.#historico.buscarTodos(r => r.visitante.id === Number(visitanteId) && r.status === 'aguardando');
  }

  /** Posição (1 = próximo) do visitante na fila do horário, ou null. */
  posicaoDe(visitanteId, atracaoId, horario) {
    const visitante = this.buscarVisitante(visitanteId);
    const sessao = this.buscarAtracao(atracaoId)?.buscarSessao(horario);
    return visitante && sessao ? sessao.fila.posicaoDe(visitante) : null;
  }

  /** Total de pessoas aguardando em todos os horários da atração. */
  totalNaFila(atracaoId) {
    let total = 0;
    this.buscarAtracao(atracaoId)?.sessoes.percorrer(sessao => { total += sessao.fila.tamanho; });
    return total;
  }

  /** A sessão que o botão EMBARCAR chamaria agora, ou null se não há ninguém na fila. */
  sessaoDeEmbarque(atracaoId) {
    const atracao = this.buscarAtracao(atracaoId);
    return atracao ? this.#escolherSessao(atracao) : null;
  }

  /**
   * Métricas do dia, com contadores feitos percorrendo as listas:
   * { total, vip, comuns, topA: { nome, n } | null, topV: { nome, n } | null }.
   * Contam as reservas cuja entrada na fila foi hoje; quem desistiu não conta.
   */
  estatisticas() {
    const hoje = this.#relogio.hoje();
    let total = 0, vip = 0;
    const porAtracao = new ListaDuplamenteEncadeada();   // cada nó: { item, n }
    const porVisitante = new ListaDuplamenteEncadeada();
    this.#historico.percorrer(reserva => {
      if (reserva.entrouEm.slice(0, 10) !== hoje) return;
      total++;
      if (reserva.visitante.ingresso.prioridade() > 0) vip++;
      Parque.#contar(porAtracao, reserva.atracao);
      Parque.#contar(porVisitante, reserva.visitante);
    });
    return {
      total, vip, comuns: total - vip,
      topA: Parque.#maisContado(porAtracao), topV: Parque.#maisContado(porVisitante)
    };
  }

  static #contar(lista, item) {
    const no = lista.buscar(contador => contador.item === item);
    if (no) no.dado.n++;
    else lista.inserirNoFim({ item, n: 1 });
  }

  /** O item com mais ocorrências (no empate, o que apareceu primeiro), ou null se não há nenhum. */
  static #maisContado(lista) {
    let melhor = null;
    lista.percorrer(contador => { if (!melhor || contador.n > melhor.n) melhor = contador; });
    return melhor ? { nome: melhor.item.nome, n: melhor.n } : null;
  }

  // ---------- Filas ----------

  /** Coloca o visitante na fila da atração no horário. Devolve a Reserva criada. */
  entrarNaFila(visitanteId, atracaoId, horario) {
    const { visitante, atracao, sessao } = this.#localizar(visitanteId, atracaoId, horario);
    if (visitante.idade(this.#relogio.hoje()) < atracao.idadeMinima) {
      throw new Error(`Idade mínima para esta atração: ${atracao.idadeMinima} anos.`);
    }
    this.#exigirHorarioAberto(horario);
    if (sessao.fila.buscarPorVisitante(visitante)) throw new Error('Você já está nessa fila.');

    const reserva = new Reserva({
      id: this.#proximoIdReserva, visitante, atracao, horario,
      prioritaria: atracao.concedePrioridadeA(visitante), // sem fila VIP, o VIP entra como normal
      entrouEm: this.#relogio.agora()
    });
    sessao.fila.enfileirar(reserva);
    this.#historico.inserirNoFim(reserva);
    this.#proximoIdReserva++;
    this.#repositorio.salvarReserva(reserva);
    return reserva;
  }

  /** O visitante desiste da fila. A reserva some da fila e do histórico. */
  sairDaFila(visitanteId, atracaoId, horario) {
    const { visitante, sessao } = this.#localizar(visitanteId, atracaoId, horario);
    const reserva = sessao.fila.sairDaFila(visitante);
    if (!reserva) throw new Error('Você não está nessa fila.');
    const no = this.#historico.buscar(r => r === reserva);
    if (no) this.#historico.remover(no);
    this.#repositorio.removerReserva(reserva);
    return reserva;
  }

  /** Move a reserva para outra fila da mesma atração (vai para o fim dos normais ou dos VIPs). */
  trocarHorario(visitanteId, atracaoId, horarioAtual, novoHorario) {
    const { visitante, atracao, sessao: origem } = this.#localizar(visitanteId, atracaoId, horarioAtual);
    const destino = atracao.buscarSessao(novoHorario);
    if (!destino) throw new Error('Esse horário não existe nesta atração.');
    if (novoHorario === horarioAtual) throw new Error('Escolha um horário diferente do atual.');
    if (!origem.fila.buscarPorVisitante(visitante)) throw new Error('Você não está nessa fila.');
    this.#exigirHorarioAberto(novoHorario);
    if (destino.fila.buscarPorVisitante(visitante)) throw new Error('Você já está nessa fila.');

    // todas as validações passaram: agora o nó sai de uma fila e entra na outra
    const reserva = origem.fila.sairDaFila(visitante);
    reserva.mudarHorario(novoHorario, this.#relogio.agora());
    destino.fila.enfileirar(reserva);
    this.#repositorio.atualizarReserva(reserva);
    return reserva;
  }

  /**
   * Chama a próxima sessão da atração: embarcam até "capacidade" pessoas, VIPs primeiro.
   * Devolve { horario, total, embarcados }, ou null se não há ninguém na fila.
   */
  embarcar(atracaoId) {
    const atracao = this.buscarAtracao(atracaoId);
    if (!atracao) throw new Error('Atração não encontrada.');
    const sessao = this.#escolherSessao(atracao);
    if (!sessao) return null;

    const embarcados = new ListaDuplamenteEncadeada();
    while (embarcados.tamanho < atracao.capacidade) {
      const reserva = sessao.fila.desenfileirar();
      if (!reserva) break; // a fila tinha menos gente que a capacidade
      reserva.concluir(this.#relogio.agora());
      this.#repositorio.atualizarReserva(reserva);
      embarcados.inserirNoFim(reserva);
    }
    return { horario: sessao.horario, total: embarcados.tamanho, embarcados };
  }

  // ---------- Persistência ----------

  /** Reconstrói o parque a partir do repositório. Chamar uma vez, ao iniciar, com o parque vazio. */
  carregar() {
    this.restaurar(this.#repositorio.carregar());
  }

  /**
   * Recria as listas a partir de dados simples ({ atracoes, visitantes, reservas }), mantendo os ids
   * originais. Não grava nada de volta. As filas são refeitas na ordem em que cada pessoa entrou
   * (data/hora de entrada e, no empate, o id); a prioridade VIP é reaplicada pela própria fila.
   */
  restaurar({ atracoes = [], visitantes = [], reservas = [] }) {
    if (!this.#atracoes.estaVazia() || !this.#visitantes.estaVazia() || !this.#historico.estaVazia()) {
      throw new Error('Só é possível restaurar um parque vazio.');
    }
    atracoes.forEach(dados => this.#atracoes.inserirNoFim(new Atracao(dados)));
    visitantes.forEach(dados => {
      this.#visitantes.inserirNoFim(new Visitante({ ...dados, hoje: this.#relogio.hoje() }));
    });

    const criadas = []; // arrays só aqui, na fronteira com os dados vindos do repositório
    [...reservas].sort((a, b) => a.id - b.id).forEach(dados => {
      const reserva = new Reserva({
        id: dados.id, visitante: this.buscarVisitante(dados.visitanteId), atracao: this.buscarAtracao(dados.atracaoId),
        horario: dados.horario, prioritaria: dados.prioritaria, entrouEm: dados.entrouEm
      });
      if (dados.status === 'concluida') reserva.concluir(dados.embarcouEm);
      this.#historico.inserirNoFim(reserva);
      criadas.push(reserva);
    });
    criadas
      .filter(r => r.status === 'aguardando')
      .sort((a, b) => a.entrouEm.localeCompare(b.entrouEm) || a.id - b.id)
      .forEach(reserva => {
        const sessao = reserva.atracao.buscarSessao(reserva.horario);
        if (!sessao) throw new Error(`A reserva ${reserva.id} aponta para um horário que não existe.`);
        sessao.fila.enfileirar(reserva);
      });

    this.#proximoIdAtracao = Parque.#maiorId(this.#atracoes) + 1;
    this.#proximoIdVisitante = Parque.#maiorId(this.#visitantes) + 1;
    this.#proximoIdReserva = Parque.#maiorId(this.#historico) + 1;
  }

  static #maiorId(lista) {
    let maior = 0;
    lista.percorrer(item => { if (item.id > maior) maior = item.id; });
    return maior;
  }

  // ---------- Apoio (interno) ----------

  #localizar(visitanteId, atracaoId, horario) {
    const visitante = this.buscarVisitante(visitanteId);
    const atracao = this.buscarAtracao(atracaoId);
    const sessao = atracao ? atracao.buscarSessao(horario) : null;
    if (!visitante || !sessao) throw new Error(SELECIONE);
    return { visitante, atracao, sessao };
  }

  #exigirHorarioAberto(horario) {
    if (!this.#relogio.horarioAberto(horario)) throw new Error('Esse horário já passou.');
  }

  /** Próximo horário (a partir de agora) com gente na fila; se todos já passaram, o mais cedo. */
  #escolherSessao(atracao) {
    const comGente = atracao.sessoes.buscarTodos(s => s.fila.tamanho > 0);
    const aberta = comGente.buscar(s => this.#relogio.horarioAberto(s.horario));
    const no = aberta || comGente.inicio;
    return no ? no.dado : null;
  }
}

module.exports = Parque;