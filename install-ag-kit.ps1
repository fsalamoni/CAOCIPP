# Script para baixar e instalar o antigravity-kit
# Repositório: https://github.com/vudovn/antigravity-kit

Write-Host "Antigravity Kit Installer" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Cyan

$baseUrl = "https://raw.githubusercontent.com/vudovn/antigravity-kit/main"
$targetDir = ".agent"

# Criar diretório .agent se não existir
if (!(Test-Path $targetDir)) {
    Write-Host "Criando diretório .agent..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $targetDir | Out-Null
}

# Função para baixar arquivo
function Download-File {
    param (
        [string]$Url,
        [string]$OutputPath
    )
    
    try {
        $dir = Split-Path -Parent $OutputPath
        if ($dir -and !(Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
        }
        
        Write-Host "Baixando: $OutputPath" -ForegroundColor Gray
        Invoke-WebRequest -Uri $Url -OutFile $OutputPath -UseBasicParsing
        return $true
    }
    catch {
        Write-Host "Erro ao baixar $Url : $_" -ForegroundColor Red
        return $false
    }
}

# Lista de arquivos e diretórios para baixar
$files = @(
    ".agent/ARCHITECTURE.md",
    ".agent/mcp_config.json"
)

# Agentes
$agents = @(
    "backend-specialist.md",
    "code-archaeologist.md",
    "database-architect.md",
    "debugger.md",
    "devops-engineer.md",
    "documentation-writer.md",
    "explorer-agent.md",
    "frontend-specialist.md",
    "game-developer.md",
    "mobile-developer.md",
    "orchestrator.md",
    "penetration-tester.md",
    "performance-optimizer.md",
    "product-manager.md",
    "product-owner.md",
    "project-planner.md",
    "qa-automation-engineer.md",
    "security-auditor.md",
    "seo-specialist.md",
    "test-engineer.md"
)

# Workflows
$workflows = @(
    "brainstorm.md",
    "create.md",
    "debug.md",
    "deploy.md",
    "enhance.md",
    "orchestrate.md",
    "plan.md",
    "preview.md",
    "status.md",
    "test.md",
    "ui-ux-pro-max.md"
)

# Skills (apenas o arquivo principal doc.md por enquanto)
$files += ".agent/skills/doc.md"

Write-Host "`nBaixando arquivos principais..." -ForegroundColor Yellow
foreach ($file in $files) {
    $url = "$baseUrl/$file"
    Download-File -Url $url -OutputPath $file
}

Write-Host "`nBaixando agentes..." -ForegroundColor Yellow
foreach ($agent in $agents) {
    $url = "$baseUrl/.agent/agents/$agent"
    $output = ".agent/agents/$agent"
    Download-File -Url $url -OutputPath $output
}

Write-Host "`nBaixando workflows..." -ForegroundColor Yellow
foreach ($workflow in $workflows) {
    $url = "$baseUrl/.agent/workflows/$workflow"
    $output = ".agent/workflows/$workflow"
    Download-File -Url $url -OutputPath $output
}

Write-Host "`n" + "=" * 50 -ForegroundColor Cyan
Write-Host "Instalação concluída!" -ForegroundColor Green
Write-Host "Estrutura .agent criada com sucesso!" -ForegroundColor Green
Write-Host "`nLocal de instalação: $(Get-Location)\.agent" -ForegroundColor Cyan
