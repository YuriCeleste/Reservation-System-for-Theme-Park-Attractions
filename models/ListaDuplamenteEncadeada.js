const No = require('./No');

/**
 * Lista duplamente encadeada genérica.
 *
 * Os nós são ligados "na mão", sem usar array, Map ou Set para guardar os dados.
 * As subclasses (como a FilaVirtual) usam apenas os métodos públicos abaixo.
 */
class ListaDuplamenteEncadeada {
  #inicio = null;
  #fim = null;
  #tamanho = 0;

  get inicio() { return this.#inicio; }
  get fim() { return this.#fim; }
  get tamanho() { return this.#tamanho; }

  estaVazia() { return this.#tamanho === 0; }

  // ---------- Inclusão (todas devolvem o nó criado) ----------

  inserirNoInicio(dado) {
    const no = new No(dado);
    this.#ligarNoInicio(no);
    return no;
  }

  inserirNoFim(dado) {
    const no = new No(dado);
    this.#ligarNoFim(no);
    return no;
  }

  inserirApos(referencia, dado) {
    this.#validar(referencia);
    const no = new No(dado);
    this.#ligarApos(referencia, no);
    return no;
  }

  // ---------- Remoção (devolvem o dado removido) ----------

  /** Remove um nó qualquer em O(1): basta religar o anterior e o próximo. */
  remover(no) {
    this.#validar(no);
    const dado = no.dado;
    this.#desligar(no);
    return dado;
  }

  /** Remove o primeiro nó. Devolve o dado, ou null se a lista está vazia. */
  removerPrimeiro() {
    return this.#inicio ? this.remover(this.#inicio) : null;
  }

  // ---------- Busca ----------

  /** Devolve o primeiro nó cujo dado satisfaz o predicado, ou null. */
  buscar(predicado) {
    for (let no = this.#inicio; no; no = no.proximo) {
      if (predicado(no.dado, no)) return no;
    }
    return null;
  }

  /** Devolve uma NOVA lista com os dados que satisfazem o predicado. */
  buscarTodos(predicado) {
    const resultado = new ListaDuplamenteEncadeada();
    for (let no = this.#inicio; no; no = no.proximo) {
      if (predicado(no.dado, no)) resultado.inserirNoFim(no.dado);
    }
    return resultado;
  }

  /** Devolve o nó na posição indicada (0 = primeiro), ou null se não existir. */
  noEm(indice) {
    if (!Number.isInteger(indice) || indice < 0 || indice >= this.#tamanho) return null;
    // aproveita a lista dupla: começa pela ponta mais próxima
    if (indice < this.#tamanho / 2) {
      let no = this.#inicio;
      for (let i = 0; i < indice; i++) no = no.proximo;
      return no;
    }
    let no = this.#fim;
    for (let i = this.#tamanho - 1; i > indice; i--) no = no.anterior;
    return no;
  }

  // ---------- Alteração, movimentação e ordenação ----------

  /** Troca o dado guardado em um nó. */
  alterar(no, novoDado) {
    this.#validar(no);
    no.dado = novoDado;
    return no;
  }

  /**
   * Move um nó para a posição indicada (0 = início). A posição é onde o nó
   * ficará no final; valores fora do intervalo são ajustados para as pontas.
   */
  mover(no, novaPosicao) {
    this.#validar(no);
    if (!Number.isInteger(novaPosicao)) throw new Error('A posição deve ser um número inteiro.');
    const alvo = Math.max(0, Math.min(novaPosicao, this.#tamanho - 1));
    this.#desligar(no);
    if (alvo === 0) this.#ligarNoInicio(no);
    else this.#ligarApos(this.noEm(alvo - 1), no);
  }

  /**
   * Ordena a lista por inserção (insertion sort), religando os próprios nós.
   * É estável: elementos iguais mantêm a ordem original. Os nós continuam os
   * mesmos, então referências guardadas para eles seguem válidas.
   */
  ordenar(comparador) {
    let resto = this.#inicio;
    this.#inicio = null;
    this.#fim = null;
    this.#tamanho = 0;
    while (resto) {
      const no = resto;
      resto = resto.proximo;
      let referencia = this.#fim;
      while (referencia && comparador(referencia.dado, no.dado) > 0) referencia = referencia.anterior;
      if (referencia) this.#ligarApos(referencia, no);
      else this.#ligarNoInicio(no);
    }
  }

  // ---------- Percurso ----------

  percorrer(callback) {
    let indice = 0;
    for (let no = this.#inicio; no; no = no.proximo) callback(no.dado, indice++, no);
  }

  /** Permite usar for...of sobre a lista (percorre os nós, não copia nada). */
  *[Symbol.iterator]() {
    for (let no = this.#inicio; no; no = no.proximo) yield no.dado;
  }

  // ---------- Ligação e desligamento de nós (interno) ----------

  #validar(no) {
    if (!(no instanceof No) || no.lista !== this) {
      throw new Error('O nó não pertence a esta lista.');
    }
  }

  #ligarNoInicio(no) {
    no.anterior = null;
    no.proximo = this.#inicio;
    if (this.#inicio) this.#inicio.anterior = no;
    else this.#fim = no;
    this.#inicio = no;
    no.lista = this;
    this.#tamanho++;
  }

  #ligarNoFim(no) {
    no.proximo = null;
    no.anterior = this.#fim;
    if (this.#fim) this.#fim.proximo = no;
    else this.#inicio = no;
    this.#fim = no;
    no.lista = this;
    this.#tamanho++;
  }

  #ligarApos(referencia, no) {
    if (referencia === this.#fim) return this.#ligarNoFim(no);
    no.anterior = referencia;
    no.proximo = referencia.proximo;
    referencia.proximo.anterior = no;
    referencia.proximo = no;
    no.lista = this;
    this.#tamanho++;
  }

  #desligar(no) {
    if (no.anterior) no.anterior.proximo = no.proximo;
    else this.#inicio = no.proximo;
    if (no.proximo) no.proximo.anterior = no.anterior;
    else this.#fim = no.anterior;
    no.proximo = null;
    no.anterior = null;
    no.lista = null;
    this.#tamanho--;
  }
}

module.exports = ListaDuplamenteEncadeada;