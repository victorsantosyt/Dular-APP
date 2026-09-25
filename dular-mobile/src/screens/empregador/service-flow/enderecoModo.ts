/**
 * O que a etapa de endereço mostra. Com endereço cadastrado o empregador só
 * escolhe entre eles; o formulário manual fica para quando não há nenhum
 * (lista vazia ou falha ao carregar), sem presumir que o onboarding garantiu.
 */
export type ModoEndereco = "carregando" | "formulario" | "cadastrados";

export function modoEndereco(enderecos: readonly unknown[] | null, loadFailed: boolean): ModoEndereco {
  if (loadFailed) return "formulario";
  if (enderecos === null) return "carregando";
  return enderecos.length === 0 ? "formulario" : "cadastrados";
}
