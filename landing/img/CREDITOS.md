# Créditos dos mockups

Os arquivos `app-*.webp` são composições: um print real do app Dular recortado
dentro de uma moldura de iPhone.

## Moldura do aparelho

Moldura "iPhone 16 Pro — Natural Titanium" do projeto
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
em 30/08/2026 a 1170×2532.

## Como as composições foram feitas

A área da tela na moldura é transparente. A máscara foi obtida por flood-fill a
partir das bordas do PNG: a transparência que alcança a borda é o fundo, e a que
sobra é a tela — assim o print fica contido nos cantos arredondados sem vazar.
O print é redimensionado para 1206×2622 (a resolução nativa da tela), recortado
pela máscara e a moldura entra por cima.

Cada mockup é exportado em três larguras (`-sm`, `-md` e a cheia) para o
`srcset` da página servir o arquivo certo por densidade de tela.
