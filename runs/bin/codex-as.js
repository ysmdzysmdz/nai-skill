#!/usr/bin/env node
// 通过 Codex app-server（默认 stdio）运行一次任务，并把最终 JSON 对象写到 runs。
const { spawn, spawnSync } = require('child_process')
const { randomUUID } = require('crypto')
const fs = require('fs')
const path = require('path')
const { createInterface } = require('readline')

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name)
  return i > 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback
}

const cwd = path.resolve(arg('cwd', process.cwd()))
const label = arg('label', 'run')
const runId = arg('run-id', randomUUID().replace(/-/g, ''))
const taskFile = arg('task')
const sandbox = arg('sandbox', 'danger-full-access')
const approvalPolicy = arg('approval', 'never')
const model = arg('model')
if (!taskFile) { console.error('缺少 --task <提示词文件>'); process.exit(2) }
if (!label.trim() || /[<>:"/\\|?*\x00-\x1f]/u.test(label) || /[. ]$/.test(label) || !/^[a-f0-9]{32}$/i.test(runId)) {
  console.error('无效的运行标签或运行 ID')
  process.exit(2)
}

const outDir = path.resolve(arg('out', path.join(__dirname, '..')))
const now = new Date()
const pad = n => String(n).padStart(2, '0')
const day = [now.getFullYear(), pad(now.getMonth() + 1), pad(now.getDate())].join('')
const time = [now.getHours(), now.getMinutes(), now.getSeconds()].map(pad).join('')
const stem = day + '-' + time + '-' + runId + '_' + label
const outJson = path.join(outDir, stem + '.json')
const outMeta = path.join(outDir, stem + '.meta.json')
const logDir = path.join(outDir, 'log')
const logPath = path.join(logDir, stem + '.out.log')
const logLines = []
const events = []
const startTime = Date.now()
const elapsed = () => +((Date.now() - startTime) / 1000).toFixed(2)
function log(line) {
  logLines.push(line)
  console.log(line)
}

function findCodex() {
  const explicit = arg('codex')
  if (explicit) {
    const file = path.resolve(explicit)
    if (!fs.statSync(file, { throwIfNoEntry: false })?.isFile()) {
      throw new Error('找不到指定的 Codex CLI: ' + file)
    }
    if (/\.(cmd|bat|ps1)$/i.test(file)) throw new Error('--codex 请指定 codex.exe 或 npm 的 codex.js')
    return file
  }
  if (process.platform !== 'win32') return 'codex'
  for (const dir of (process.env.PATH || '').split(path.delimiter).filter(Boolean)) {
    const fullDir = dir.replace(/^"|"$/g, '')
    // 官方 npm 包的 .cmd 是转发入口。直接运行其 JS 可保留参数边界。
    for (const entry of ['codex.exe', 'node_modules/@openai/codex/bin/codex.js']) {
      const file = path.resolve(fullDir, entry)
      if (fs.statSync(file, { throwIfNoEntry: false })?.isFile()) return file
    }
  }
  throw new Error('PATH 中找不到 Codex CLI。请安装 @openai/codex，或用 --codex / -CodexPath 指定其路径。')
}

function extractJson(answer) {
  const fence = answer.match(/\x60{3}(?:json)?\s*\r?\n([\s\S]*?)\x60{3}/i)
  const body = (fence ? fence[1] : answer).trim()
  let value
  try {
    value = JSON.parse(body)
  } catch {
    if (fence) return null
    const start = body.indexOf('{')
    const end = body.lastIndexOf('}')
    if (start < 0 || end <= start) return null
    try { value = JSON.parse(body.slice(start, end + 1)) } catch { return null }
  }
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null
}

const rpcNames = { 1: 'initialize', 2: 'thread/start', 3: 'turn/start' }
let child, timeout, shutdownTimer, exitTimer, outcome
let threadId = null, turnId = null, messageCount = 0
let finalAnswer, legacyAnswer = '', stderr = '', turnError
const send = message => child.stdin.write(JSON.stringify(message) + '\n')
const errorText = error => [error?.message, error?.additionalDetails].filter(Boolean).join(' | ')

function publish() {
  clearTimeout(shutdownTimer)
  clearTimeout(exitTimer)
  const { status, reason, duration } = outcome
  const answer = (finalAnswer ?? legacyAnswer).trim()
  const parsed = extractJson(answer)
  const note = reason || (parsed ? null : '最终回复缺失或无法解析为 JSON 对象')
  // 一次序列化，落盘与日志共用同一份文本：日志里必须是完整全文，
  // 任何长度截断都会把 JSON 切成不可解析的碎片。
  const text = answer ? (parsed ? JSON.stringify(parsed, null, 2) : answer) : ''
  fs.mkdirSync(logDir, { recursive: true })
  if (answer) fs.writeFileSync(outJson, text, 'utf8')

  events.push({ at: duration, event: status, note })
  log('[' + duration + 's] ' + status.toUpperCase() + (note ? ' ' + note : ''))
  if (answer) log('输出: ' + outJson + ' (' + text.length + ' 字符)\n' + text)
  fs.writeFileSync(logPath, logLines.join('\n') + '\n', 'utf8')

  // 答案和日志落盘后，原子发布 PowerShell 等待的完成信号。
  const metaTemp = outMeta + '.tmp'
  fs.writeFileSync(metaTemp, JSON.stringify({
    label, runId, elapsedSeconds: duration, cwd, sandbox, approvalPolicy, model: model || null,
    threadId, turnId, status, note, messageCount, parsed: !!parsed,
    output: answer ? path.basename(outJson) : null,
    timeline: events,
  }, null, 2), 'utf8')
  fs.renameSync(metaTemp, outMeta)
  process.exitCode = status === 'completed' && parsed ? 0 : 1
}

function releasePipes() {
  child.stdin.destroy()
  child.stdout.destroy()
  child.stderr.destroy()
}

function finish(status, reason, alreadyClosed = false) {
  if (outcome) return
  outcome = { status, reason, duration: elapsed() }
  clearTimeout(timeout)
  if (alreadyClosed) return publish()
  child.stdin.end()
  shutdownTimer = setTimeout(() => {
    if (child.pid && child.exitCode === null && child.signalCode === null) {
      if (process.platform === 'win32') {
        spawnSync('taskkill.exe', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', timeout: 3000 })
      }
      child.kill()
    }
    releasePipes()
  }, 1500)
}

function onLine(line, task) {
  if (outcome) return
  let msg
  try { msg = JSON.parse(line) } catch { return }

  if (!msg.method && rpcNames[msg.id] && msg.error) {
    return finish('failed', rpcNames[msg.id] + ': ' + (errorText(msg.error) || JSON.stringify(msg.error)))
  }
  if (msg.id === 1 && msg.result) {
    events.push({ at: elapsed(), event: 'initialize' })
    log('initialize OK')
    send({ jsonrpc: '2.0', method: 'initialized', params: {} })
    const params = { cwd, ephemeral: true, approvalPolicy, sandbox }
    if (model) params.model = model
    send({ jsonrpc: '2.0', id: 2, method: 'thread/start', params })
  }
  if (msg.id === 2 && msg.result) {
    threadId = msg.result.thread?.id
    if (!threadId) return finish('failed', 'thread/start 未返回 thread ID')
    events.push({ at: elapsed(), event: 'thread/start', threadId })
    log('thread/start ' + threadId)
    const params = { threadId, input: [{ type: 'text', text: task, text_elements: [] }] }
    send({ jsonrpc: '2.0', id: 3, method: 'turn/start', params })
  }
  if (msg.id === 3 && msg.result) {
    turnId = msg.result.turn?.id
    if (!turnId) return finish('failed', 'turn/start 未返回 turn ID')
    events.push({ at: elapsed(), event: 'turn/start', turnId })
    log('turn/start ' + turnId)
  }

  const params = msg.params
  if (!params || (params.threadId && params.threadId !== threadId) ||
      (turnId && params.turnId && params.turnId !== turnId)) return
  if (msg.method === 'item/completed' && params.item) {
    const { type, text, phase } = params.item
    if (type === 'agentMessage' && typeof text === 'string') {
      messageCount++
      if (phase === 'final_answer') finalAnswer = text
      if (phase == null) legacyAnswer = text
      events.push({ at: elapsed(), event: type, phase: phase ?? null, chars: text.length })
    } else {
      events.push({ at: elapsed(), event: type })
    }
  }
  if (msg.method === 'error') {
    const reason = errorText(params.error)
    if (reason) log('app-server error: ' + reason)
    if (!params.willRetry) turnError = reason
  }
  if (msg.method === 'turn/completed') {
    const turn = params.turn
    if (turnId && turn?.id && turn.id !== turnId) return
    const status = turn?.status || 'unknown'
    if (status === 'completed') return finish('completed')
    const reason = errorText(turn?.error) || turnError
    finish('failed', 'status=' + status + (reason ? ': ' + reason : ''))
  }
}

function run() {
  let cli, task
  try {
    task = fs.readFileSync(path.resolve(taskFile), 'utf8').replace(/^\uFEFF/, '')
    if (!task.trim()) throw new Error('提示词为空')
    cli = findCodex()
  } catch (error) {
    return finish('failed', error.message, true)
  }

  const args = ['app-server']
  if (!process.argv.includes('--with-project-doc')) args.push('-c', 'project_doc_max_bytes=0')
  for (let i = 2; i < process.argv.length - 1; i++) {
    if (process.argv[i] === '--cfg') args.push('-c', process.argv[++i])
  }
  const jsEntry = /\.m?js$/i.test(cli)
  child = spawn(jsEntry ? process.execPath : cli, jsEntry ? [cli, ...args] : args, {
    cwd, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
  })
  createInterface({ input: child.stdout, crlfDelay: Infinity }).on('line', line => onLine(line, task))
  child.stderr.setEncoding('utf8').on('data', chunk => {
    stderr = (stderr + chunk).slice(-4000)
    if (chunk.trim()) log('stderr: ' + chunk.trim())
  })
  let spawnError
  child.on('error', error => { spawnError = error.message })
  child.stdin.on('error', error => {
    if (!outcome && error.code !== 'EPIPE') log('stdin: ' + error.message)
  })
  // 子进程提前退出时，后代继承的句柄可能暂时让 close 无法触发。
  child.on('exit', () => { exitTimer = setTimeout(releasePipes, 1000) })
  child.on('close', (code, signal) => {
    if (outcome) return publish()
    const status = spawnError ? '启动 Codex CLI 失败: ' + spawnError : 'Codex CLI 提前退出 (' + (signal || code) + ')'
    finish('failed', status + (stderr.trim() ? ': ' + stderr.trim() : ''), true)
  })
  timeout = setTimeout(() => finish('failed', '等待 Codex 回合超时（180s）'), 180000)
  send({
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: {
      clientInfo: { name: 'dsh-lead', title: 'DSH lead', version: '0.0.1' },
      capabilities: { experimentalApi: false, requestAttestation: false },
    },
  })
}

run()
