// Fila com prioridade implementada como lista encadeada simples.
// Cada nó guarda um item e aponta para o próximo nó da fila.
class No {
  constructor(item) {
    this.item = item;
    this.proximo = null;
  }
}

class FilaEncadeada {
  constructor() {
    this.inicio = null;     // primeiro da fila (próximo a ser atendido)
    this.fim = null;        // último da fila
    this.ultimoVip = null;  // último nó VIP: os novos VIPs entram logo depois dele
    this.tamanho = 0;
  }

  // item = { id, visitante_id, nome, vip }
  enfileirar(item) {
    const no = new No(item);

    if (item.vip) {
      // VIP passa na frente dos normais: entra depois do último VIP (ou no início, se não há VIP)
      if (this.ultimoVip) {
        no.proximo = this.ultimoVip.proximo;
        this.ultimoVip.proximo = no;
      } else {
        no.proximo = this.inicio;
        this.inicio = no;
      }
      this.ultimoVip = no;
      if (!no.proximo) this.fim = no;
    } else {
      // Normal vai para o fim da fila
      if (this.fim) this.fim.proximo = no;
      else this.inicio = no;
      this.fim = no;
    }
    this.tamanho++;
  }

  // Remove e devolve o primeiro da fila (ou null se estiver vazia)
  desenfileirar() {
    if (!this.inicio) return null;
    const no = this.inicio;
    this.inicio = no.proximo;
    if (!this.inicio) this.fim = null;
    if (no === this.ultimoVip) this.ultimoVip = null; // era o último VIP
    this.tamanho--;
    return no.item;
  }

  // Percorre os nós e devolve os itens na ordem da fila
  paraArray() {
    const itens = [];
    for (let no = this.inicio; no; no = no.proximo) itens.push(no.item);
    return itens;
  }
}

module.exports = FilaEncadeada;
