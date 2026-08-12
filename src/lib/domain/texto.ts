// Marcas de acento combinantes (resultado de normalize("NFD")) — intervalo Unicode U+0300–U+036F.
const MARCAS_DIACRITICAS = new RegExp("[\\u0300-\\u036f]", "g");

/** Normaliza texto pra busca: minúsculo e sem acento — "Marlao"/"marlão" e "Italo"/"Ítalo"
 * devem casar entre si, já que o usuário nem sempre digita o acento certo. */
export function normalizarBusca(texto: string): string {
  return texto.normalize("NFD").replace(MARCAS_DIACRITICAS, "").toLowerCase();
}
