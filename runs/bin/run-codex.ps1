# run-codex.ps1 — 调 codex 的统一入口（app-server 通道），跑完自动补索引
#
# 位置：runs\bin\run-codex.ps1（2026-11-22 从项目根移入）
# 底层是 runs\bin\codex-as.js（codex app-server --stdio，JSON-RPC），不是 codex exec。
#
# 用法（在项目根执行）：
#   .\runs\bin\run-codex.ps1 -Label poseA -PromptFile .\runs\req\kimono_poseA.txt
#   .\runs\bin\run-codex.ps1 -Label poseA -Prompt "按手册规则挑一张双人姿势图并如实标注…"
#
# 产物（全部在 runs\ 内）：
#   runs\req\<label>.txt             提示词（约定位置，可选）
#   runs\<stamp>_<label>.json        提取出的纯 JSON 答案
#   runs\<stamp>_<label>.meta.json   耗时 / thread+turn id / 时间线 / parsed 标记
#   runs\log\<stamp>_<label>.out.log 完整运行日志
# 并自动追加到 runs\runs.jsonl
#
# 注意：文件必须是 UTF-8 with BOM。Windows PowerShell 5.1 读无 BOM 的 UTF-8 会按 GBK 解码，
# 中文变乱码并抛 TerminatorExpectedAtEndOfString，脚本连第一行逻辑都进不去。

[CmdletBinding(DefaultParameterSetName = 'Inline')]
param(
    [Parameter(Mandatory)][string]$Label,
    [Parameter(Mandatory, ParameterSetName = 'File')][string]$PromptFile,
    [Parameter(Mandatory, ParameterSetName = 'Inline')][string]$Prompt,
    [ValidateSet('danger-full-access','workspace-write','read-only')][string]$Sandbox = 'danger-full-access',
    [string]$Model,
    [switch]$NoIndex,
    [switch]$WithProjectDoc
)

$ErrorActionPreference = 'Stop'
$bin  = $PSScriptRoot                                              # runs\bin
$runs = Split-Path $bin -Parent                                     # runs
$root = Split-Path $runs -Parent                                    # 项目根
$runner  = Join-Path $bin 'codex-as.js'
$archive = Join-Path $bin 'archive-codex.ps1'
if (-not (Test-Path $runner)) { throw "找不到 codex-as.js: $runner" }

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { $node = 'C:\Program Files\nodejs\node.exe' }
if (-not (Test-Path $node)) { throw '找不到 node' }

# 提示词：文件优先，否则落临时文件
$tmpTask = $null
if ($PSCmdlet.ParameterSetName -eq 'File') {
    if (-not (Test-Path $PromptFile)) { throw "找不到提示词文件: $PromptFile" }
    $taskPath = (Resolve-Path $PromptFile).Path
} else {
    if (-not $Prompt.Trim()) { throw '提示词为空' }
    $tmpTask = Join-Path $env:TEMP "codex-task-$([guid]::NewGuid().ToString('N').Substring(0,8)).txt"
    Set-Content -Path $tmpTask -Value $Prompt -Encoding utf8
    $taskPath = $tmpTask
}

$exitCode = 1
try {
    $argv = @($runner, '--cwd', $root, '--label', $Label, '--task', $taskPath, '--sandbox', $Sandbox)
    if ($Model) { $argv += @('--model', $Model) }
    if ($WithProjectDoc) { $argv += '--with-project-doc' }

    # 用 Start-Process -Wait 而不是 & node：直接管道/重定向都会让 PS 去等
    # codex.exe 孙进程释放继承来的句柄，实测挂死。Start-Process 只等 node 进程本身的句柄。
    $logDir = Join-Path $runs 'log'
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null

    $argLine = ($argv | ForEach-Object { if ($_ -match '\s') { '"{0}"' -f $_ } else { $_ } }) -join ' '

    # 关键：既不重定向、也不 WaitForExit。
    # PS 5.1 与 codex.exe 孙进程抢同一批继承句柄，任何"等进程"的写法都会让 PS 自旋
    # （实测 164s / 174s / 289s / 335s 都卡在这里，codex 本身只花 7–60s）。
    # 改成「启动后轮询产物文件」：node 写出 .meta.json 就算完成，PS 完全不碰进程句柄。
    $startedAt = Get-Date
    $proc = Start-Process -FilePath $node -ArgumentList $argLine -NoNewWindow -PassThru

    $timeoutSec = 200
    $meta = $null
    while (((Get-Date) - $startedAt).TotalSeconds -lt $timeoutSec) {
        $meta = Get-ChildItem $runs -Filter "*_$Label.meta.json" -File -ErrorAction SilentlyContinue |
                Where-Object { $_.LastWriteTime -ge $startedAt } |
                Sort-Object LastWriteTime | Select-Object -Last 1
        if ($meta) { break }
        # node 已退出但没写 meta：必然是崩了，不必再等
        if ($proc.HasExited) { Start-Sleep -Milliseconds 500
            $meta = Get-ChildItem $runs -Filter "*_$Label.meta.json" -File -ErrorAction SilentlyContinue |
                    Where-Object { $_.LastWriteTime -ge $startedAt } |
                    Sort-Object LastWriteTime | Select-Object -Last 1
            break }
        Start-Sleep -Milliseconds 700
    }

    if (-not $meta) {
        Write-Output ("! {0}s 内没有产物，强制结束进程树" -f $timeoutSec)
        try { & taskkill /pid $proc.Id /T /F 2>&1 | Out-Null } catch {}
        $exitCode = 124
    } else {
        $m = Get-Content $meta.FullName -Raw -Encoding utf8 | ConvertFrom-Json
        $exitCode = if ($m.parsed) { 0 } else { 1 }
    }

    # 日志由 node 自己写进 runs\log\（含 timeline），这里把最后一段回显出来
    $newLog = Get-ChildItem $logDir -Filter "*_$Label.out.log" -ErrorAction SilentlyContinue |
              Sort-Object LastWriteTime | Select-Object -Last 1
    if ($newLog) { Get-Content $newLog.FullName -Tail 12 }

    if (-not $NoIndex -and (Test-Path $archive)) {
        try { & $archive | Out-Null; Write-Output '✓ 已并入 runs\runs.jsonl' }
        catch { Write-Output ("! 归档失败（产物已落盘）: " + $_.Exception.Message) }
    }
}
finally {
    if ($tmpTask -and (Test-Path $tmpTask)) { Remove-Item $tmpTask -Force }
}

# exit 放在 try/finally 之外：PS 5.1 在 try 内 exit 会走 finally 后偶发挂起
exit $exitCode
