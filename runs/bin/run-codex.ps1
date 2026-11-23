# run-codex.ps1 — 调 codex 的统一入口（app-server 通道），跑完自动补索引
#
# 位置：runs\bin\run-codex.ps1（2026-11-22 从项目根移入）
# 底层是 runs\bin\codex-as.js（codex app-server，默认 stdio，JSON-RPC），不是 codex exec。
#
# 用法（在项目根执行）：
#   .\runs\bin\run-codex.ps1 -Label poseA -PromptFile .\runs\req\kimono_poseA.txt
#   .\runs\bin\run-codex.ps1 -Label poseA -Prompt "按手册规则挑一张双人姿势图并如实标注…"
#
# 产物（全部在 runs\ 内）：
#   runs\req\<label>.txt             提示词（约定位置，可选）
#   runs\<stamp>-<runId>_<label>.json        提取出的纯 JSON 答案
#   runs\<stamp>-<runId>_<label>.meta.json   耗时 / thread+turn id / 时间线 / parsed 标记
#   runs\log\<stamp>-<runId>_<label>.out.log 完整运行日志
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
    [string]$CodexPath,
    [switch]$NoIndex,
    [switch]$WithProjectDoc
)

$ErrorActionPreference = 'Stop'
$bin  = $PSScriptRoot                                              # runs\bin
$runs = Split-Path $bin -Parent                                     # runs
$root = Split-Path $runs -Parent                                    # 项目根
$runner  = Join-Path $bin 'codex-as.js'
$archive = Join-Path $bin 'archive-codex.ps1'
if (-not (Test-Path -LiteralPath $runner -PathType Leaf)) { throw "找不到 codex-as.js: $runner" }
if (-not $Label.Trim() -or $Label -match '[<>:"/\\|?*\x00-\x1f]' -or $Label -match '[. ]$') {
    throw 'Label 含有无效文件名字符或以空格、句点结尾'
}

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { $node = 'C:\Program Files\nodejs\node.exe' }
if (-not (Test-Path $node)) { throw '找不到 node' }

# 提示词：文件优先，否则落临时文件
$tmpTask = $null
if ($PSCmdlet.ParameterSetName -eq 'File') {
    if (-not (Test-Path -LiteralPath $PromptFile -PathType Leaf)) { throw "找不到提示词文件: $PromptFile" }
    $taskPath = (Resolve-Path -LiteralPath $PromptFile).Path
} else {
    if (-not $Prompt.Trim()) { throw '提示词为空' }
    $tmpTask = Join-Path ([IO.Path]::GetTempPath()) "codex-task-$([guid]::NewGuid().ToString('N')).txt"
    [IO.File]::WriteAllText($tmpTask, $Prompt, [Text.UTF8Encoding]::new($false))
    $taskPath = $tmpTask
}

$exitCode = 1
try {
    $runId = [guid]::NewGuid().ToString('N')
    $argv = @($runner, '--cwd', $root, '--label', $Label, '--task', $taskPath, '--sandbox', $Sandbox, '--run-id', $runId)
    if ($Model) { $argv += @('--model', $Model) }
    if ($WithProjectDoc) { $argv += '--with-project-doc' }
    if ($CodexPath) {
        $argv += @('--codex', $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($CodexPath))
    }

    # Start-Process 接收一条命令行。轮询本次 meta，避免等待后代进程的输出管道。
    $argLine = ($argv | ForEach-Object {
        '"' + (($_ -replace '(\\*)"', '$1$1\"') -replace '(\\+)$', '$1$1') + '"'
    }) -join ' '
    $proc = Start-Process -FilePath $node -ArgumentList $argLine -WorkingDirectory $root -NoNewWindow -PassThru

    $timeoutSec = 200
    $wait = [Diagnostics.Stopwatch]::StartNew()
    $meta = $null
    do {
        $nodeExited = $proc.HasExited
        $meta = Get-ChildItem -LiteralPath $runs -Filter "*-$($runId)_*.meta.json" -File | Select-Object -First 1
        if ($meta -or $nodeExited) { break }
        Start-Sleep -Milliseconds 350
    } while ($wait.Elapsed.TotalSeconds -lt $timeoutSec)

    if (-not $meta) {
        if ($proc.HasExited) {
            $exitCode = $proc.ExitCode
            if ($exitCode -eq 0) { $exitCode = 1 }
            Write-Output "Node 已退出，未写出本次元数据（exit=$exitCode，运行 ID=$runId）。"
        } else {
            Write-Output "$($timeoutSec)s 内未写出本次元数据，正在结束进程树。"
            try { & taskkill.exe /pid $proc.Id /T /F 2>&1 | Out-Null } catch {}
            $exitCode = 124
        }
    } else {
        $m = Get-Content -LiteralPath $meta.FullName -Raw -Encoding utf8 | ConvertFrom-Json
        $exitCode = if ($m.status -eq 'completed' -and $m.parsed) { 0 } else { 1 }
        if ($m.note) { Write-Output $m.note }
        Write-Output ("元数据: " + $meta.FullName)

        if ($m.output -and -not $NoIndex -and (Test-Path -LiteralPath $archive)) {
            try { & $archive | Out-Null; Write-Output '✓ 已并入 runs\runs.jsonl' }
            catch { Write-Output ("! 归档失败（产物已落盘）: " + $_.Exception.Message); $exitCode = 1 }
        }
    }
}
finally {
    if ($tmpTask -and (Test-Path -LiteralPath $tmpTask)) { Remove-Item -LiteralPath $tmpTask -Force }
}

# exit 放在 try/finally 之外：PS 5.1 在 try 内 exit 会走 finally 后偶发挂起
exit $exitCode
