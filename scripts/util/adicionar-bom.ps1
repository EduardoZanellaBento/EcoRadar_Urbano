# Regrava os scripts .ps1 do projeto em UTF-8 com BOM (necessário para o Windows PowerShell 5.1
# interpretar corretamente os acentos). Uso: powershell -ExecutionPolicy Bypass -File scripts/util/adicionar-bom.ps1
$raiz = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$utf8ComBom = New-Object System.Text.UTF8Encoding $true
Get-ChildItem -Path (Join-Path $raiz 'scripts'), (Join-Path $raiz 'tests') -Filter *.ps1 -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch 'node_modules' } |
    ForEach-Object {
        $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
        $temBom = $bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF
        if (-not $temBom) {
            $texto = [System.Text.Encoding]::UTF8.GetString($bytes)
            [System.IO.File]::WriteAllText($_.FullName, $texto, $utf8ComBom)
            Write-Host "BOM adicionado: $($_.Name)"
        }
    }
