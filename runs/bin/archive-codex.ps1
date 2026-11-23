# archive-codex.ps1 — codex 结果索引器
#
# 位置：runs\bin\archive-codex.ps1（2026-11-22 从项目根移入）
# 默认 Root = 脚本的上一级目录的上一级 = 项目根，Store = runs\
#
# 两种来源都吃：
#   (A) 新流程：codex 已直接输出到 runs\ 的 *.json（无需搬运，只补索引）
#   (B) 旧流程：项目根目录残留的 _prompt*.json（搬进 runs\ 再补索引）
#
# 索引文件 runs\runs.jsonl：一行一条记录，便于 grep / Select-String / ConvertFrom-Json 逐行读
#
# 用法：
#   .\runs\bin\archive-codex.ps1              # 增量归档（幂等）
#   .\runs\bin\archive-codex.ps1 -List       # 只列出已归档记录摘要
#   .\runs\bin\archive-codex.ps1 -Show 12    # 打印第 12 条完整记录

[CmdletBinding()]
param(
    [string]$Root   = (Split-Path $PSScriptRoot -Parent | Split-Path -Parent),
    [string]$Ledger = 'runs.jsonl',
    [string]$Store  = 'runs',
    [switch]$List,
    [int]$Show
)

$ErrorActionPreference = 'Stop'
Set-Location $Root

$storePath  = Join-Path $Root $Store
if (-not (Test-Path $storePath)) { New-Item -ItemType Directory -Path $storePath | Out-Null }
# runs.jsonl 现在躺 store 里（runs\runs.jsonl），不再在项目根
$ledgerPath = Join-Path $storePath $Ledger

function Get-LedgerRecords {
    if (-not (Test-Path $ledgerPath)) { return @() }
    Get-Content $ledgerPath -Encoding utf8 |
        Where-Object { $_.Trim() } |
        ForEach-Object { $_ | ConvertFrom-Json }
}

# ---------- 只读模式 ----------
if ($List) {
    $recs = @(Get-LedgerRecords)
    if (-not $recs) { 'runs.jsonl 还没有记录'; return }
    '{0,-4} {1,-19} {2,-14} {3,3} {4,8}' -f '#', 'runAt', 'label', 'N', 'bytes'
    '-' * 58
    for ($i = 0; $i -lt $recs.Count; $i++) {
        $r = $recs[$i]
        '{0,-4} {1,-19} {2,-14} {3,3} {4,8}' -f ($i + 1),
            ([datetime]$r.runAt).ToString('yyyy-MM-dd HH:mm:ss'),
            $r.label, $r.itemCount, $r.promptBytes
    }
    "`n合计 $($recs.Count) 条"
    return
}
if ($Show -gt 0) {
    $recs = @(Get-LedgerRecords)
    if ($Show -gt $recs.Count) { "只有 $($recs.Count) 条记录"; return }
    $recs[$Show - 1] | ConvertTo-Json -Depth 40
    return
}

# ---------- 增量归档 ----------
$seen = @{}
foreach ($r in Get-LedgerRecords) { if ($r.promptFile) { $seen[$r.promptFile] = $true } }

$added = 0

function Add-Record {
    param([System.IO.FileInfo]$PromptFile, [string]$Label, [string]$RelPrompt, [string]$RelLog, [System.IO.FileInfo]$LogFile)
    $raw = Get-Content $PromptFile.FullName -Raw -Encoding utf8
    $parsed = $null; $err = $null
    try { $parsed = $raw | ConvertFrom-Json } catch { $err = $_.Exception.Message }

    $count = 0; $kinds = @()
    if ($parsed) {
        if ($parsed.PSObject.Properties.Name -contains 'results') {
            $count = @($parsed.results).Count
            $kinds = @($parsed.results | ForEach-Object { if ($_.PSObject.Properties.Name -contains 'kind') { $_.kind } else { 'task' } })
        } else { $count = 1 }
    }

    $record = [ordered]@{
        archivedAt  = (Get-Date).ToString('o')
        runAt       = $PromptFile.LastWriteTime.ToString('o')
        label       = $Label
        promptFile  = $RelPrompt
        logFile     = $RelLog
        promptBytes = $PromptFile.Length
        logBytes    = if ($LogFile) { $LogFile.Length } else { 0 }
        itemCount   = $count
        kinds       = $kinds
        parseError  = $err
        raw         = $raw
    }
    ($record | ConvertTo-Json -Depth 40 -Compress) | Add-Content -Path $ledgerPath -Encoding utf8
    Write-Output ("+ {0,-12} {1,2} 项  {2,6}B  {3}" -f $Label, $count, $PromptFile.Length, $RelPrompt)
}

# (A) 已在 runs\ 里的 json —— 只补索引
Get-ChildItem -Path $storePath -File -Filter '*.json' |
    Where-Object { $_.Name -notlike '*.meta.json' } |
    Sort-Object LastWriteTime | ForEach-Object {
    $rel = "$Store/$($_.Name)"
    if ($seen.ContainsKey($rel)) { return }
    $base = $_.BaseName                                    # 20261122-210136_mixed3
    $label = if ($base -match '^\d{8}-\d{6}_(.+)$') { $matches[1] } else { $base }
    $logCand = Join-Path $storePath (($base -replace '\.json$', '') + '.log')
    $logObj = if (Test-Path $logCand) { Get-Item $logCand } else { $null }
    $relLog = if ($logObj) { "$Store/$($logObj.Name)" } else { $null }
    Add-Record -PromptFile $_ -Label $label -RelPrompt $rel -RelLog $relLog -LogFile $logObj
    $seen[$rel] = $true
    $added++
}

# (B) 根目录残留的 _prompt*.json —— 搬进 runs\ 再索引
Get-ChildItem -File -Filter '_prompt*.json' | Sort-Object LastWriteTime | ForEach-Object {
    $p = $_
    $suffix = $p.BaseName -replace '^_prompt', ''
    $label  = if ($suffix) { $suffix.TrimStart('_') } else { 'main' }
    $logSrc = Join-Path $Root ("_codex$suffix.log")
    $stamp  = $p.LastWriteTime.ToString('yyyyMMdd-HHmmss')

    $newName = "$stamp`_$label.json"
    $dest    = Join-Path $storePath $newName
    if (Test-Path $dest) { $newName = "$stamp`_$label-$((Get-Random -Maximum 9999)).json"; $dest = Join-Path $storePath $newName }
    Move-Item -LiteralPath $p.FullName -Destination $dest -Force

    $relLog = $null; $logObj = $null
    if (Test-Path $logSrc) {
        $newLog = "$stamp`_$label.log"
        $destLog = Join-Path $storePath $newLog
        if (Test-Path $destLog) { $newLog = "$stamp`_$label-$((Get-Random -Maximum 9999)).log"; $destLog = Join-Path $storePath $newLog }
        Move-Item -LiteralPath $logSrc -Destination $destLog -Force
        $logObj = Get-Item $destLog
        $relLog = "$Store/$newLog"
    }

    Add-Record -PromptFile (Get-Item $dest) -Label $label -RelPrompt "$Store/$newName" -RelLog $relLog -LogFile $logObj
    $seen["$Store/$newName"] = $true
    $added++
}

Write-Output '---'
if ($added -eq 0) { '没有新结果需要归档' } else { "本次归档 $added 条" }
"runs.jsonl 累计 $((@(Get-LedgerRecords)).Count) 条  /  runs\ 内文件 $((Get-ChildItem $storePath -File).Count) 个"
