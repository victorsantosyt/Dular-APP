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

## Quando anunciar

1. Gere o AAB e confira seu `versionCode` real.
2. Publique a versão na faixa correta da Google Play.
3. Aguarde a versão ficar disponível para **todos os usuários do público/faixa que usa aquele backend**. Não anuncie enquanto houver revisão pendente ou distribuição gradual que ainda não cubra esse público.
4. Só então configure `ANDROID_APP_RELEASE` naquele ambiente e faça o deploy necessário.
5. Confira o endpoint e teste a abertura com um build anterior, verificando se o botão abre a página correta da Play e se a atualização está disponível para essa conta.

Mantenha as configurações de **preview/homologação e produção separadas**. Uma versão disponível apenas para testadores internos não deve ser anunciada no backend de produção. Ao usar o mesmo backend para públicos diferentes, anuncie somente uma versão acessível a todos eles.

Este mecanismo anuncia uma versão aprovada pelo operador. Ele **não detecta a disponibilidade individual na Google Play**, não consulta HTML da loja e não confirma participação da conta em uma faixa de testes. O link abre `https://play.google.com/store/apps/details?id=br.com.dular.app`; a loja decide o acesso conforme a conta e a distribuição.

O aviso é opcional. Não há versão mínima obrigatória nem bloqueio de acesso ao app.

## Primeira instalação do recurso

É necessário instalar primeiro um AAB que já contenha esta consulta e o popup. Depois, o aviso poderá anunciar uma versão com `versionCode` maior. Um app antigo que não contém esse código não recebe o popup retroativamente.
