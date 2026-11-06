---
description: Sincronização, atualização de documentos, verificação, PR e deploy
---

# Fluxo de Atualização e Deploy (SIGO)

Sequência final de uma entrega: backup local, documentação, verificação e
publicação. O processo completo está em `docs/DEVELOPMENT_GUIDE.md` (seção 6).

## Passos

// turbo
1. Sincronizar Backup (`Repositório original`) — opcional, só na máquina local do mantenedor
```powershell
robocopy "c:\Users\Usuario\Desktop\CAOCIPP" "c:\Users\Usuario\Desktop\CAOCIPP\Repositório original" /MIR /XD .git node_modules "Repositório original" .gemini .agent /XF .env .DS_Store /R:0 /W:0
```

2. Atualizar a documentação no mesmo PR
- Ajustar em `docs/` os documentos afetados pela mudança (índice em `docs/README.md`).
- Registrar entregas relevantes em `docs/CHANGELOG.md`.

// turbo
3. Verificação (o mesmo que o CI roda)
```bash
npm run lint && npm run typecheck && npm --prefix functions-v2 run build:local && npm run build
```
Inclua `functions-v2/lib/` no commit se `functions-v2/src` mudou.

4. Commit e push num branch
```bash
git checkout -b <branch>
git add <arquivos>
git commit -m "<tipo>(<escopo>): <descrição>"
git push -u origin <branch>
```

5. Abrir pull request para `main` e aguardar o CI verde.

6. Deploy
O merge em `main` dispara `.github/workflows/deploy.yml`, que publica hosting,
functions, regras e índices em <https://sigo-caocipp.web.app>. Não é preciso
rodar `firebase deploy` à mão.
