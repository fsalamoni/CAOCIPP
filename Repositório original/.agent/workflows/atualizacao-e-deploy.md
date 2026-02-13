---
description: Sincronização, atualização de documentos, commit e deploy total
---

# Fluxo de Atualização e Deploy (Consultas CAO)

Este workflow automatiza a sequência final de sincronização do backup, atualização de memoriais e publicação do sistema.

## Passos

// turbo
1. Sincronizar Backup (`Repositório original`)
```powershell
robocopy "c:\Users\Usuario\Desktop\CAOCIPP" "c:\Users\Usuario\Desktop\CAOCIPP\Repositório original" /MIR /XD .git node_modules "Repositório original" .gemini .agent /XF .env .DS_Store /R:0 /W:0
```

2. Atualizar Documentos de Referência
- Marcar versão final nos arquivos em `docs/`
- Atualizar "Last Updated" em `README.md` e `MIGRATION_PROGRESS.md`

// turbo
3. Build de Verificação
```bash
npm run build
```

4. Commit das Alterações
```bash
git add .
git commit -m "chore: automatized update and sync"
```

// turbo
5. Push para o Repositório
```bash
git push origin main
```

// turbo
6. Deploy para Firebase
```bash
npx firebase deploy --only hosting
```
> Deploy agora vai para **consultascao.web.app** (configurado em `firebase.json` com `"site": "consultascao"`)
