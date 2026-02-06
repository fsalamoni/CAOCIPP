# Script para baixar todas as Skills do antigravity-kit
# Baixa apenas os arquivos SKILL.md principais de cada skill

Write-Host "Baixando Skills do Antigravity Kit..." -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Cyan

$baseUrl = "https://raw.githubusercontent.com/vudovn/antigravity-kit/main"

# Lista de todas as skills (pastas)
$skills = @(
    "api-patterns",
    "app-builder",
    "architecture",
    "bash-linux",
    "behavioral-modes",
    "brainstorming",
    "clean-code",
    "code-review-checklist",
    "database-design",
    "deployment-procedures",
    "documentation-templates",
    "frontend-design",
    "game-development",
    "geo-fundamentals",
    "i18n-localization",
    "intelligent-routing",
    "lint-and-validate",
    "mcp-builder",
    "mobile-design",
    "nextjs-react-expert",
    "nodejs-best-practices",
    "parallel-agents",
    "performance-profiling",
    "plan-writing",
    "powershell-windows",
    "python-patterns",
    "red-team-tactics",
    "rust-pro",
    "seo-fundamentals",
    "server-management",
    "systematic-debugging",
    "tailwind-patterns",
    "tdd-workflow",
    "testing-patterns",
    "vulnerability-scanner",
    "web-design-guidelines",
    "webapp-testing"
)

$successCount = 0
$failCount = 0

foreach ($skill in $skills) {
    $url = "$baseUrl/.agent/skills/$skill/SKILL.md"
    $output = ".agent/skills/$skill/SKILL.md"
    
    try {
        $dir = Split-Path -Parent $output
        if (!(Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
        }
        
        Write-Host "Baixando: $skill/SKILL.md" -ForegroundColor Gray
        Invoke-WebRequest -Uri $url -OutFile $output -UseBasicParsing -ErrorAction Stop
        $successCount++
    }
    catch {
        Write-Host "  AVISO: Não foi possível baixar $skill/SKILL.md" -ForegroundColor Yellow
        $failCount++
    }
}

Write-Host "`n" + "=" * 50 -ForegroundColor Cyan
Write-Host "Concluído!" -ForegroundColor Green
Write-Host "Skills baixadas com sucesso: $successCount" -ForegroundColor Green
if ($failCount -gt 0) {
    Write-Host "Skills não encontradas: $failCount" -ForegroundColor Yellow
}
