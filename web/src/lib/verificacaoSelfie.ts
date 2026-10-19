/**
 * Exigência da verificação com selfie: no envio, frente + verso + selfie e
 * dados obrigatórios (nome completo, CPF, nascimento); na decisão, conferência
 * administrativa marcada e categoria do motivo.
 *
 * Controle EXPLÍCITO do servidor: `DULAR_VERIFICACAO_SELFIE=ligado`. Ausente =
 * desligado, que é o padrão de produção. Nada que o app envie liga ou desliga
 * a exigência — um app antigo omitir a selfie não a dispensa quando ligada.
 *
 * Ativar em produção depende de: app de produção com selfie disponível na
 * Play, política de privacidade atualizada e homologação concluída.
 */
export function selfieExigida(env: Record<string, string | undefined> = process.env): boolean {
  return env.DULAR_VERIFICACAO_SELFIE === "ligado";
}
