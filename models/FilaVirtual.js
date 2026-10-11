const ListaDuplamenteEncadeada = require('./ListaDuplamenteEncadeada');

/**
 * Fila virtual de uma sessão de atração, com prioridade.
 *
 * Cada item da fila é uma reserva. A fila só precisa que a reserva tenha:
 *   - prioritaria: true quando o visitante tem direito à fila VIP nesta atração;
 *   - visitante: o visitante dono da reserva.
 *
 * Regra de ordem: os prioritários ficam sempre na frente, cada grupo por ordem
 * de chegada. O ponteiro ultimoVip marca onde termina o grupo prioritário, então
 * tanto entrar na fila quanto sair dela custam O(1) (sem percorrer a lista).
 *
 * Invariante: todos os nós prioritários vêm antes de todos os normais, e
 * ultimoVip aponta para o último prioritário (ou é null se não há nenhum).
 */
class FilaVirtual extends ListaDuplamenteEncadeada {
  #ultimoVip = null;

  /** Último nó prioritário da fila (útil para desenhar a fila na tela). */
  get ultimoVip() { return this.#ultimoVip; }

  /** Coloca a reserva na fila e devolve o nó criado. */
  enfileirar(reserva) {
    if (!reserva) throw new Error('Informe a reserva a ser enfileirada.');
    if (!reserva.prioritaria) return super.inserirNoFim(reserva);
    // VIP passa na frente dos normais: entra logo depois do último VIP (ou no início)
    const no = this.#ultimoVip
      ? super.inserirApos(this.#ultimoVip, reserva)
      : super.inserirNoInicio(reserva);
    this.#ultimoVip = no;
    return no;
  }

  /** Atende o primeiro da fila. Devolve a reserva, ou null se a fila está vazia. */
  desenfileirar() {
    return this.removerPrimeiro();
  }

  /**
   * Remove um nó da fila (de qualquer posição). Se era o último VIP, o ponteiro
   * volta para o nó anterior, que também é VIP (ou null, se não sobrou nenhum).
   */
  remover(no) {
    const anterior = no ? no.anterior : null;
    const eraUltimoVip = no === this.#ultimoVip;
    const reserva = super.remover(no); // lança erro se o nó não for desta fila
    if (eraUltimoVip) this.#ultimoVip = anterior;
    return reserva;
  }

  /** Posição do visitante na fila (1 = próximo a ser atendido), ou null se não está. */
  posicaoDe(visitante) {
    let posicao = 1;
    for (let no = this.inicio; no; no = no.proximo, posicao++) {
      if (FilaVirtual.#mesmoVisitante(no.dado.visitante, visitante)) return posicao;
    }
    return null;
  }

  /** Devolve o nó do visitante na fila, ou null. */
  buscarPorVisitante(visitante) {
    return this.buscar(reserva => FilaVirtual.#mesmoVisitante(reserva.visitante, visitante));
  }

  /** O visitante sai da fila. Devolve a reserva removida, ou null se ele não estava. */
  sairDaFila(visitante) {
    const no = this.buscarPorVisitante(visitante);
    return no ? this.remover(no) : null;
  }

  /** Devolve uma NOVA lista com as próximas n reservas, sem tirá-las da fila. */
  proximos(n) {
    if (!Number.isInteger(n) || n < 0) throw new Error('n deve ser um inteiro maior ou igual a zero.');
    const resultado = new ListaDuplamenteEncadeada();
    for (let no = this.inicio; no && resultado.tamanho < n; no = no.proximo) {
      resultado.inserirNoFim(no.dado);
    }
    return resultado;
  }

  // ---------- Operações da lista que quebrariam a ordem de prioridade ----------

  inserirNoInicio() { FilaVirtual.#bloquear(); }
  inserirNoFim() { FilaVirtual.#bloquear(); }
  inserirApos() { FilaVirtual.#bloquear(); }
  alterar() { FilaVirtual.#bloquear(); }
  mover() { FilaVirtual.#bloquear(); }
  ordenar() { FilaVirtual.#bloquear(); }

  static #bloquear() {
    throw new Error('Em uma FilaVirtual use enfileirar, desenfileirar e sairDaFila: '
      + 'as outras operações da lista quebrariam a ordem de prioridade.');
  }

  // Mesmo objeto, ou mesmo id (quando os dois têm id).
  static #mesmoVisitante(a, b) {
    return a === b || (a?.id !== undefined && a.id === b?.id);
  }
}

module.exports = FilaVirtual;