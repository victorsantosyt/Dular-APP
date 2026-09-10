# Créditos dos mockups

Os arquivos `app-*.webp` são composições: um print real do app Dular recortado
dentro de uma moldura de iPhone.

## Moldura do aparelho

Moldura "iPhone 16 Pro Max — Natural Titanium" do projeto
[weirdapps/mockups](https://github.com/weirdapps/mockups), distribuído sob
licença MIT:

> MIT License
>
> Copyright (c) 2026 Dimitrios Plessas
>
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all
> copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
> SOFTWARE.

## Prints

Telas do próprio app Dular (onboarding, escolha de perfil e login), capturadas
em 09/09/2026 no simulador do iPhone 14 Pro Max, a 1290×2796.

Substituíram a leva de 30/08/2026, que já não correspondia ao app: mostravam o
perfil com o nome antigo ("Sou Casa") e rótulos longos que quebravam palavra no
meio ("Avaliações e recomendaç/ões").

## Como as composições foram feitas

A área da tela na moldura é transparente. A máscara é obtida por flood-fill a
partir das bordas do PNG: a transparência que alcança a borda é o fundo, e a que
sobra é a tela — assim o print fica contido nos cantos arredondados sem vazar.
A tela mede 1320×2868 em (100,100) dentro da moldura de 1520×3068.

A máscara vem do alpha da própria moldura, e não de um retângulo de cantos
arredondados desenhado à mão: o canto da tela do iPhone é contínuo (squircle) e
qualquer aproximação por arco deixava uma fresta de fundo aparecendo nos quatro
cantos. A máscara é aplicada 1px para fora, porque a borda dela e a do bisel são
ambas suavizadas e não se sobrepunham exatamente.

O print entra em modo "cover" (a proporção 1290×2796 é praticamente a da tela,
1320×2868 — sobram 3px de largura, cortados pelo centro), é recortado pela
máscara, e a moldura entra por cima.

A composição e a codificação em WebP são feitas em canvas, no navegador: a
máquina não tem PIL, ImageMagick nem cwebp, e o `sips` do macOS não exporta
WebP.

Cada mockup é exportado em três larguras (`-sm`, `-md` e a cheia) para o
`srcset` da página servir o arquivo certo por densidade de tela.
