class Ingresso {
  constructor(tipo) {
    this.tipo = tipo;
  }

  prioridade() {
    throw new Error('prioridade() precisa ser implementada pela subclasse');
  }

  preco() {
    throw new Error('preco() precisa ser implementada pela subclasse');
  }

  exigeCartao() {
    return false;
  }

  static criar(tipo) {
    if (tipo === 'normal') return new IngressoNormal();
    if (tipo === 'vip')    return new IngressoVip();
    throw new Error(`Tipo de ingresso desconhecido: ${tipo}`);
  }
}

class IngressoNormal extends Ingresso {
  constructor() { super('normal'); }
  prioridade() { return 0; }
  preco()      { return 100; }
}

class IngressoVip extends Ingresso {
  constructor() { super('vip'); }
  prioridade()    { return 1; }
  preco()         { return 200; }
  exigeCartao()   { return true; }
}

module.exports = Ingresso;