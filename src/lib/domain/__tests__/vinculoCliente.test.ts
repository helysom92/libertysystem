import { describe, expect, it } from "vitest";
import { documentoVisivel, sugerirClientes, type ClienteParaCruzamento } from "../vinculoCliente";

const clientes: ClienteParaCruzamento[] = [
  { id: "c1", nome: "Rodrigo Rodrigues", empresa: null, cpf_cnpj: "123.456.789-09" },
  { id: "c2", nome: "Daverson Matos", empresa: "DM Eventos Ltda", cpf_cnpj: "12.345.678/0001-90" },
  { id: "c3", nome: "Gold Móveis (Fábio)", empresa: "Gold Móveis Ltda", cpf_cnpj: null },
  { id: "c4", nome: "Ana Souza", empresa: null, cpf_cnpj: null },
];

describe("documentoVisivel", () => {
  it("documento completo, com ou sem pontuação", () => {
    expect(documentoVisivel("123.456.789-09").completo).toBe("12345678909");
    expect(documentoVisivel("12345678000190").completo).toBe("12345678000190");
  });

  it("documento mascarado devolve só o trecho visível", () => {
    expect(documentoVisivel("***.456.789-**")).toEqual({ completo: null, trecho: "456789" });
    expect(documentoVisivel("XXXXXXXX0001XX")).toEqual({ completo: null, trecho: "0001" });
  });

  it("vazio não quebra", () => {
    expect(documentoVisivel(null)).toEqual({ completo: null, trecho: "" });
  });
});

describe("sugerirClientes", () => {
  it("CPF/CNPJ completo igual é o vínculo mais forte", () => {
    const r = sugerirClientes(["Banco X"], "12345678000190", clientes);
    expect(r[0]).toMatchObject({ clienteId: "c2", motivo: "CPF/CNPJ confere" });
  });

  it("trecho visível do documento ainda sugere, com menos força", () => {
    const r = sugerirClientes([], "***.456.789-**", clientes);
    expect(r[0]).toMatchObject({ clienteId: "c1", motivo: "parte do CPF/CNPJ confere" });
    expect(r[0].pontos).toBeLessThan(100);
  });

  it("nome da conta parecido com o do cliente (ignora ltda/me/de)", () => {
    const r = sugerirClientes(["GOLD MOVEIS LTDA"], null, clientes);
    expect(r[0]).toMatchObject({ clienteId: "c3", motivo: "nome parecido" });
  });

  it("uma palavra solta em comum não basta quando o nome do cliente tem mais palavras", () => {
    expect(sugerirClientes(["Rodrigo"], null, clientes)).toEqual([]);
  });

  it("nome curto que bate inteiro com o do cliente sugere", () => {
    expect(sugerirClientes(["Ana Souza"], null, clientes)[0]?.clienteId).toBe("c4");
  });

  it("sem pista nenhuma, nada é sugerido", () => {
    expect(sugerirClientes(["Banco Sicredi"], null, clientes)).toEqual([]);
  });
});
