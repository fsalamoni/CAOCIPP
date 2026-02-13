# ⚠️ Node.js Installation Required

## Problema Detectado

Node.js não foi encontrado no seu sistema PATH. Para executar a plataforma Consultas CAO localmente, você precisa ter Node.js instalado.

---

## Solução: Instalar Node.js

### Opção 1: Download Direto (Recomendado)

1. **Baixe Node.js LTS** (versão estável):
   - Acesse: https://nodejs.org/
   - Clique em "LTS" (Long Term Support)
   - Baixe a versão para Windows (x64)

2. **Execute o instalador:**
   - Clique duas vezes no arquivo `.msi` baixado
   - Siga o wizard de instalação
   - ✅ **IMPORTANTE:** Marque a opção "Automatically install necessary tools"
   - Clique em "Install"

3. **Reinicie o PowerShell/Terminal:**
   - Feche todas as janelas de terminal abertas
   - Abra uma nova janela de PowerShell

4. **Verifique a instalação:**
   ```powershell
   node --version
   npm --version
   ```
   
   Deve mostrar algo como:
   ```
   v20.11.0
   10.2.4
   ```

---

### Opção 2: Via Chocolatey (se você usa)

```powershell
choco install nodejs-lts -y
```

---

### Opção 3: Via winget (Windows 11)

```powershell
winget install OpenJS.NodeJS.LTS
```

---

## Após Instalar Node.js

1. **Feche e reabra o terminal**

2. **Navegue até a pasta do projeto:**
   ```powershell
   cd C:\Users\Usuario\Desktop\Consultas-CAO
   ```

3. **Instale as dependências:**
   ```powershell
   npm install
   ```

4. **Siga o guia QUICK_START.md** para continuar

---

## Verificação Rápida

Execute estes comandos após instalar:

```powershell
# Verificar Node.js
node --version

# Verificar npm
npm --version

# Verificar Firebase CLI (se instalado)
firebase --version
```

---

## Próximos Passos

1. ✅ Instalar Node.js (acima)
2. ✅ Instalar dependências: `npm install`
3. ✅ Instalar Firebase CLI (opcional): `npm install -g firebase-tools`
4. ✅ Seguir QUICK_START.md

---

**Tempo de instalação:** ~5 minutos  
**Download:** ~50-80 MB

**Me avise quando concluir a instalação do Node.js!** 🚀
