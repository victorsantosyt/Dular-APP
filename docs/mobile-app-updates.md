# Aviso de atualização Android

O aplicativo consulta o endpoint público `GET /api/app/version` do backend configurado no build. O endpoint não exige login, não consulta banco de dados e responde sem cache (`Cache-Control: no-store`). A variável de ambiente é lida a cada requisição.

## Configuração operacional

Defina no backend a variável **`ANDROID_APP_RELEASE`**, de tipo **Plain text / configuração**, contendo um único objeto JSON. Ela não é um segredo. A resposta contém apenas informações públicas da versão e a URL fixa do app na Google Play.

Exemplo **fictício**, apenas para explicar o formato; **não ativar com estes valores**:

```json
{"versionCode":100,"versionName":"1.0.0","notes":["Melhorias na abertura do app.","Correções no perfil."]}
```

Campos obrigatórios, sem campos extras:

| Campo | Regra |
| --- | --- |
| `versionCode` | Inteiro positivo, até 2.100.000.000; usar o código real do AAB publicado. |
| `versionName` | Nome público da versão, com 1 a 30 caracteres após remover espaços externos. |
| `notes` | Lista de zero a cinco novidades; cada item deve ter de 1 a 180 caracteres após remover espaços externos. |

Ausência da variável, JSON inválido ou qualquer campo fora das regras devolve `{"android":null}` e desabilita o aviso. Remova a variável para interromper o anúncio. A configuração do ambiente de deploy pode exigir um novo deploy para ficar disponível no processo do servidor.

## Ambiente × faixa da Google Play

O aviso só anuncia o que a loja já entrega ao público **daquele backend**:

| Build | Backend que o app consulta | Faixa da Google Play | Onde configurar `ANDROID_APP_RELEASE` |
| --- | --- | --- | --- |
| Perfil EAS `homologacao` | staging: `https://dular-git-feat-google-play-backend-359-victorsantosyts-projects.vercel.app` | Teste interno | Vercel → Preview, **restrita à branch** `feat/google-play-backend-359` |
| Perfil EAS `production` | produção: `https://dular-three.vercel.app` | Produção | Vercel → Production |

Nunca anuncie em produção uma versão que só está no teste interno, nem no staging uma versão que a faixa de teste interno ainda não recebeu. Se a branch de staging mudar, a variável do Preview precisa acompanhar a nova branch.

## Procedimento de lançamento

Não há automação de publicação neste projeto (nenhum workflow roda `eas build`/`eas submit`). Cada etapa abaixo é manual, e o anúncio **não** pode ser disparado pelo término do build: o build terminar não prova que a loja liberou a versão.

1. **Gerar e conferir o artefato.** Rode o build no perfil da faixa (`eas build -p android --profile <perfil>`). No AAB baixado, confira o `versionCode` no manifesto, o pacote `br.com.dular.app`, a assinatura de upload (SHA-1 igual à do Play Console) e a URL do backend dentro do bundle.
2. **Publicar na faixa correta.** Envie o AAB à faixa que corresponde ao backend (tabela acima) e conclua o lançamento no Play Console.
3. **Confirmar a disponibilidade.** No Play Console, a versão (pelo `versionCode`) tem que constar como **disponível** naquela faixa: revisão concluída, lançamento ativo, sem distribuição gradual parcial que deixe parte do público de fora. No teste interno, a conta testadora precisa estar na lista da faixa. A existência do build no EAS **não** prova disponibilidade.
4. **Atualizar `ANDROID_APP_RELEASE` no backend correspondente**, com o `versionCode` confirmado no passo 3 e o `versionName` do AAB. Tipo **Config** (não Secret). Exemplo no staging:
   ```sh
   cd web
   npx vercel env add ANDROID_APP_RELEASE preview --git-branch feat/google-play-backend-359 \
     --project dular --no-sensitive \
     --value '{"versionCode":<N>,"versionName":"<nome>","notes":[]}'
   ```
   Para trocar um anúncio existente, remova a variável (passo "Retirar um anúncio") e adicione de novo.
5. **Redeploy.** A implantação só lê as variáveis no build: republique a implantação ativa daquele ambiente (`npx vercel redeploy <implantação>`).
6. **Conferir o endpoint** no domínio que o app usa:
   ```sh
   curl -s https://<domínio>/api/app/version
   ```
   Deve responder `200` com `"versionCode":<N>`. `{"android":null}` significa variável ausente ou inválida.
7. **Validar no aparelho**, com a conta da faixa:
   - versão anterior instalada: o popup aparece ao abrir o app (ou ao voltar a ele depois de 5 minutos da última consulta);
   - "Atualizar": abre a página do Dular na Google Play, que oferece a atualização para essa conta;
   - "Agora não": o popup não volta para aquela versão por 24 horas;
   - versão anunciada instalada: nenhum popup;
   - sem rede: o app abre normalmente, sem popup.

   O log `GET /api/app/version 200` só prova que o app consultou; não prova que o popup apareceu nem que a loja ofereceu a atualização.

## Retirar um anúncio

Se a versão for suspensa, revertida ou deixar de estar disponível para a faixa:

1. Remova a variável do ambiente correspondente:
   ```sh
   npx vercel env rm ANDROID_APP_RELEASE preview feat/google-play-backend-359 --project dular --yes
   ```
   (em produção: `npx vercel env rm ANDROID_APP_RELEASE production --project dular --yes`).
2. Faça o redeploy da implantação ativa daquele ambiente.
3. Confira que `GET /api/app/version` voltou a `{"android":null}`.

Quem já dispensou o aviso não é afetado; quem ainda não abriu o app deixa de ver o popup na próxima consulta.

Mantenha as configurações de **preview/homologação e produção separadas**. Uma versão disponível apenas para testadores internos não deve ser anunciada no backend de produção. Ao usar o mesmo backend para públicos diferentes, anuncie somente uma versão acessível a todos eles.

Este mecanismo anuncia uma versão aprovada pelo operador. Ele **não detecta a disponibilidade individual na Google Play**, não consulta HTML da loja e não confirma participação da conta em uma faixa de testes. O link abre `https://play.google.com/store/apps/details?id=br.com.dular.app`; a loja decide o acesso conforme a conta e a distribuição.

O aviso é opcional. Não há versão mínima obrigatória nem bloqueio de acesso ao app.

## Primeira instalação do recurso

É necessário instalar primeiro um AAB que já contenha esta consulta e o popup. Depois, o aviso poderá anunciar uma versão com `versionCode` maior. Um app antigo que não contém esse código não recebe o popup retroativamente.
