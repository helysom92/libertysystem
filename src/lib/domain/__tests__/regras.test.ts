import { describe, expect, it } from "vitest";
import { filtrarPorUnidade, sugerirPorRegra, unidadeEfetiva, type RegraLancamento } from "../regras";

function regra(parcial: Partial<RegraLancamento> & { padrao: string }): RegraLancamento {
  return {
    id: parcial.padrao,
    tipo: null,
    categoria: null,
    unidade_negocio: null,
    recorrencia: "nenhuma",
    valor_tipico: null,
    ativo: true,
    criado_em: "2026-10-01T00:00:00Z",
    ...parcial,
  };
}

describe("unidadeEfetiva / filtrarPorUnidade", () => {
  it("lançamento sem unidade conta como Comunicação Visual", () => {
    expect(unidadeEfetiva({ unidade_negocio: null })).toBe("comunicacao_visual");
    expect(unidadeEfetiva({})).toBe("comunicacao_visual");
    expect(unidadeEfetiva({ unidade_negocio: "digital" })).toBe("digital");
  });

  it("filtra sem misturar Digital com Comunicação Visual", () => {
    const lancs = [
      { id: "a", unidade_negocio: null },
      { id: "b", unidade_negocio: "digital" as const },
      { id: "c", unidade_negocio: "comunicacao_visual" as const },
    ];
    expect(filtrarPorUnidade(lancs, "todas")).toHaveLength(3);
    expect(filtrarPorUnidade(lancs, "digital").map((l) => l.id)).toEqual(["b"]);
    expect(filtrarPorUnidade(lancs, "comunicacao_visual").map((l) => l.id)).toEqual(["a", "c"]);
  });
});

describe("sugerirPorRegra", () => {
  const regras = [
    regra({ padrao: "Agência Lupa", unidade_negocio: "digital", categoria: "Mídia", recorrencia: "mensal" }),
    regra({ padrao: "lupa", unidade_negocio: "outros" }),
    regra({ padrao: "Douradina", tipo: "Receita", unidade_negocio: "digital" }),
    regra({ padrao: "cola", tipo: "Despesa", ativo: false }),
  ];

  it("casa ignorando acento e caixa", () => {
    expect(sugerirPorRegra("PIX RECEBIDO AGENCIA LUPA LTDA", "Receita", regras)?.padrao).toBe("Agência Lupa");
  });

  it("a regra de padrão mais longo vence", () => {
    expect(sugerirPorRegra("lupa comunicacao", "Receita", regras)?.unidade_negocio).toBe("outros");
    expect(sugerirPorRegra("agencia lupa", "Receita", regras)?.unidade_negocio).toBe("digital");
  });

  it("respeita o tipo da regra", () => {
    expect(sugerirPorRegra("Mídia Prefeitura de Douradina", "Receita", regras)?.padrao).toBe("Douradina");
    expect(sugerirPorRegra("Mídia Prefeitura de Douradina", "Despesa", regras)).toBeNull();
  });

  it("ignora regra desativada e texto vazio", () => {
    expect(sugerirPorRegra("compra de cola", "Despesa", regras)).toBeNull();
    expect(sugerirPorRegra("   ", "Receita", regras)).toBeNull();
  });
});
