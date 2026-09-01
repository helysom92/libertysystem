import { describe, expect, it } from "vitest";
import { parseCsvExtrato } from "../csvExtrato";

describe("parseCsvExtrato — delimitador e cabeçalho", () => {
  it("detecta vírgula como delimitador", () => {
    // valor com vírgula decimal quebraria aqui se o delimitador fosse ',' — usamos ponto decimal
    const csvSemAmbiguidade = "Data,Descricao,Valor\n01/09/2026,Mercado,-100.00";
    const r = parseCsvExtrato(csvSemAmbiguidade);
    expect(r.erros).toEqual([]);
    expect(r.linhas).toHaveLength(1);
  });

  it("detecta ponto-e-vírgula como delimitador (comum em extrato BR com valor decimal-vírgula)", () => {
    const csv = "Data;Descricao;Valor\n01/09/2026;Supermercado;-350,75";
    const r = parseCsvExtrato(csv);
    expect(r.erros).toEqual([]);
    expect(r.linhas).toEqual([{ data: "2026-09-01", descricao: "Supermercado", valor: 350.75, tipo: "Despesa" }]);
  });

  it("reconhece cabeçalhos com acento e maiúsculas variadas", () => {
    const csv = "DATA;DESCRIÇÃO;VALOR\n01/09/2026;Teste;100,00";
    const r = parseCsvExtrato(csv);
    expect(r.linhas).toHaveLength(1);
  });

  it("erro claro quando falta coluna de data", () => {
    const csv = "Descricao;Valor\nTeste;100,00";
    const r = parseCsvExtrato(csv);
    expect(r.linhas).toEqual([]);
    expect(r.erros[0]).toMatch(/data/i);
  });

  it("erro claro quando falta coluna de valor", () => {
    const csv = "Data;Descricao\n01/09/2026;Teste";
    const r = parseCsvExtrato(csv);
    expect(r.linhas).toEqual([]);
    expect(r.erros[0]).toMatch(/valor/i);
  });

  it("arquivo vazio devolve erro, nunca lança exceção", () => {
    expect(() => parseCsvExtrato("")).not.toThrow();
    expect(parseCsvExtrato("").erros).toEqual(["Arquivo vazio."]);
  });
});

describe("parseCsvExtrato — valor com sinal (coluna única)", () => {
  it("valor negativo vira Despesa, positivo vira Receita, sempre com valor positivo no resultado", () => {
    const csv = "Data;Descricao;Valor\n01/09/2026;Salario;5000,00\n02/09/2026;Aluguel;-1500,00";
    const r = parseCsvExtrato(csv);
    expect(r.linhas).toEqual([
      { data: "2026-09-01", descricao: "Salario", valor: 5000, tipo: "Receita" },
      { data: "2026-09-02", descricao: "Aluguel", valor: 1500, tipo: "Despesa" },
    ]);
  });

  it("formato brasileiro com separador de milhar (1.234,56)", () => {
    const csv = "Data;Descricao;Valor\n01/09/2026;Venda grande;1.234,56";
    const r = parseCsvExtrato(csv);
    expect(r.linhas[0].valor).toBe(1234.56);
  });

  it("formato com ponto decimal simples (1234.56), sem separador de milhar", () => {
    const csv = "Data,Descricao,Valor\n01/09/2026,Teste,1234.56";
    const r = parseCsvExtrato(csv);
    expect(r.linhas[0].valor).toBe(1234.56);
  });

  it("valor negativo entre parênteses (formato contábil)", () => {
    const csv = "Data;Descricao;Valor\n01/09/2026;Despesa;(150,00)";
    const r = parseCsvExtrato(csv);
    expect(r.linhas[0]).toEqual({ data: "2026-09-01", descricao: "Despesa", valor: 150, tipo: "Despesa" });
  });

  it("prefixo R$ é ignorado", () => {
    const csv = "Data;Descricao;Valor\n01/09/2026;Teste;R$ 100,00";
    const r = parseCsvExtrato(csv);
    expect(r.linhas[0].valor).toBe(100);
  });
});

describe("parseCsvExtrato — colunas Débito/Crédito separadas", () => {
  it("usa a coluna que tem valor preenchido pra decidir o tipo", () => {
    const csv = "Data;Descricao;Debito;Credito\n01/09/2026;Salario;;5000,00\n02/09/2026;Mercado;200,00;";
    const r = parseCsvExtrato(csv);
    expect(r.linhas).toEqual([
      { data: "2026-09-01", descricao: "Salario", valor: 5000, tipo: "Receita" },
      { data: "2026-09-02", descricao: "Mercado", valor: 200, tipo: "Despesa" },
    ]);
  });

  it("linha sem nenhum dos dois preenchido vira erro, não quebra o resto", () => {
    const csv = "Data;Descricao;Debito;Credito\n01/09/2026;Vazio;;\n02/09/2026;Com valor;100,00;";
    const r = parseCsvExtrato(csv);
    expect(r.linhas).toHaveLength(1);
    expect(r.erros).toHaveLength(1);
    expect(r.erros[0]).toMatch(/Linha 2/);
  });
});

describe("parseCsvExtrato — datas", () => {
  it("aceita DD/MM/AAAA", () => {
    expect(parseCsvExtrato("Data;Descricao;Valor\n25/12/2026;Teste;10,00").linhas[0].data).toBe("2026-12-25");
  });

  it("aceita DD-MM-AAAA", () => {
    expect(parseCsvExtrato("Data;Descricao;Valor\n25-12-2026;Teste;10,00").linhas[0].data).toBe("2026-12-25");
  });

  it("aceita AAAA-MM-DD (já no formato ISO)", () => {
    expect(parseCsvExtrato("Data;Descricao;Valor\n2026-12-25;Teste;10,00").linhas[0].data).toBe("2026-12-25");
  });

  it("data não reconhecida vira erro, linha pulada, não trava as demais", () => {
    const csv = "Data;Descricao;Valor\nlixo;Teste;10,00\n01/09/2026;Ok;20,00";
    const r = parseCsvExtrato(csv);
    expect(r.linhas).toHaveLength(1);
    expect(r.linhas[0].descricao).toBe("Ok");
    expect(r.erros[0]).toMatch(/Linha 2/);
  });
});

describe("parseCsvExtrato — campos com aspas e delimitador dentro do texto", () => {
  it("descrição entre aspas contendo o delimitador não quebra o parsing", () => {
    const csv = 'Data,Descricao,Valor\n01/09/2026,"Loja, Filial 2",-50.00';
    const r = parseCsvExtrato(csv);
    expect(r.linhas[0].descricao).toBe("Loja, Filial 2");
    expect(r.linhas[0].valor).toBe(50);
  });

  it("aspas duplicadas dentro de um campo entre aspas viram uma aspas literal", () => {
    const csv = 'Data,Descricao,Valor\n01/09/2026,"Pagamento ""especial""",-10.00';
    const r = parseCsvExtrato(csv);
    expect(r.linhas[0].descricao).toBe('Pagamento "especial"');
  });
});

describe("parseCsvExtrato — linhas em branco e robustez geral", () => {
  it("ignora linhas totalmente vazias no meio do arquivo", () => {
    const csv = "Data;Descricao;Valor\n01/09/2026;A;10,00\n\n02/09/2026;B;20,00";
    const r = parseCsvExtrato(csv);
    expect(r.linhas).toHaveLength(2);
  });

  it("nunca lança exceção mesmo com entrada completamente malformada", () => {
    expect(() => parseCsvExtrato(";;;\n\n\n,,,")).not.toThrow();
  });
});
