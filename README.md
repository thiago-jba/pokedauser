# Coleção TCG — controle da minha coleção de cartas Pokémon

App Android (APK instalável) para controlar a coleção, expansão por expansão.

## Como instalar no celular
1. No celular, abra a página **Releases** deste repositório no GitHub.
2. Baixe o arquivo `ColecaoTCG-1.0.X.apk` da versão mais recente.
3. Toque no arquivo baixado. Na primeira vez o Android pede para **permitir instalar apps desta fonte** (Chrome ou Arquivos) — permita e confirme.
4. Para atualizar, repita o processo com a versão nova: a coleção fica salva.

## Como usar
- **Tela inicial:** digite o nome da expansão (em português) no campo de busca e toque em **+ Adicionar**. O app baixa todas as cartas e variantes.
- **Dentro da expansão:** toque numa carta para marcar/desmarcar "tenho". Segure o dedo para ver a carta grande e todas as variantes dela.
- **Filtros:** tipo de carta (Normal, Holo, Reverse Foil, Reverse Especial — Poké Bola/Master Bola —, 1ª Edição, Promo/Carimbada), Tenho/Faltam, raridade, nome ou número.
- **Lote:** marca ou desmarca de uma vez todas as cartas que estão na tela com os filtros atuais.
- **Backup:** menu ⋮ → Exportar backup (salve no Drive/WhatsApp). Para restaurar: ⋮ → Importar backup.
- Segure o dedo sobre uma coleção na tela inicial para removê-la.

## De onde vêm os dados
Cartas, imagens e variantes vêm da API gratuita e aberta [TCGdex](https://tcgdex.dev). Nomes e fotos aparecem em português quando a TCGdex tem essa versão; caso contrário, em inglês.

## Para desenvolvedores
- Expo (React Native) + TypeScript. Código em `src/`.
- Cada envio para a branch `main` gera um APK novo pelo GitHub Actions (`.github/workflows/android.yml`) e publica em Releases.
- `keystore/app.keystore` é a chave de assinatura do app: mantenha este repositório **privado** e não apague esse arquivo (sem ela, atualizações exigem desinstalar o app).
