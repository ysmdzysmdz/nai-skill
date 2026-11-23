#!/usr/bin/env node
/**
 * codex-as.js — 通过 codex app-server (--stdio, JSON-RPC) 跑一次性任务
 *
 * 为什么不用 `codex exec`：
 *   exec 是 TUI 的脚本化版本，要渲染整场会话再重放一遍，实测单任务 70.0s。
 *   同任务走 app-server 只要 36.8s —— 握手 0.21s 就完成，省掉的是包装层开销。
 *
 * 用法：
 *   node runs\bin\codex-as.js --cwd <工作目录> --label <名字> --task <提示词文件> [--sandbox danger-full-access]
 *
 * 目录约定（2026-11-22 整理后）：
 *   runs\bin\codex-as.js                     本脚本
 *   runs\req\<label>.txt                     提示词
 *   runs\<yyyyMMdd-HHmmss>_<label>.json      提取出的纯 JSON 答案
 *   runs\<yyyyMMdd-HHmmss>_<label>.meta.json 元信息（耗时、thread/turn id、原始消息条数）
 *   runs\runs.jsonl                          索引
 *
 * 产物默认落在本脚本的上一级（即 runs\），可用 --out 覆盖。
 * 结束时会打印耗时与答案；索引由 run-codex.ps1 调 archive-codex.ps1 补。
 */

const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

function arg(name, dflt) {
  const i = process.argv.indexOf('--' + name)
  return i > 0 && i + 1 < process.argv.length ? process.argv[i + 1] : dflt
}

const cwd = arg('cwd', process.cwd())
const label = arg('label', 'run')
const taskFile = arg('task')
const sandbox = arg('sandbox', 'danger-full-access')
const approvalPolicy = arg('approval', 'never')
const model = arg('model')
if (!taskFile) { console.error('缺少 --task <提示词文件>'); process.exit(2) }

const outDir = path.resolve(arg('out', path.join(__dirname, '..')))
fs.mkdirSync(outDir, { recursive: true })
const task = fs.readFileSync(path.resolve(taskFile), 'utf8')
const stamp = (() => {
  const d = new Date(), p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
})()

const outJson = path.join(outDir, `${stamp}_${label}.json`)
const outMeta = path.join(outDir, `${stamp}_${label}.meta.json`)

// 自己写运行日志：调用方（run-codex.ps1）不能靠 PS 的重定向来收输出。
// Windows PowerShell 5.1 在 RedirectStandardOutput 时会异步读管道，而 codex.exe 孙进程
// 继承了管道句柄、直到被 taskkill 才释放 —— PS 就一直自旋等 EOF（实测 100% 单核烧 2 分钟）。
// 改成 node 自己落文件，PS 端只等进程句柄，互不干扰。
const logDir = path.join(outDir, 'log')
const logPath = path.join(logDir, `${stamp}_${label}.out.log`)
const logLines = []
const _log = console.log.bind(console)
console.log = (...a) => { const s = a.join(' '); logLines.push(s); _log(s) }
const flushLog = () => { try { fs.mkdirSync(logDir, { recursive: true }); fs.writeFileSync(logPath, logLines.join('\n') + '\n', 'utf8') } catch {} }
process.on('exit', flushLog)

const t0 = Date.now()
const t = () => +((Date.now() - t0) / 1000).toFixed(2)

// app-server 同样会加载 cwd 下的 AGENTS.md（经 ~/.codex/config.toml 的项目信任判定），
// 用 -c project_doc_max_bytes=0 关掉，等价于 exec 时代的同一条覆盖。
// --with-project-doc 可保留该行为（一般不需要：项目 AGENTS.md 是给出图 agent 的规范，会干扰标注任务）。
const withProjectDoc = process.argv.includes('--with-project-doc')
const extraCfg = []
for (let i = 0; i < process.argv.length - 1; i++) {
  if (process.argv[i] === '--cfg') extraCfg.push('-c', process.argv[i + 1])
}
const serverArgs = ['/c', 'codex', 'app-server']
if (!withProjectDoc) serverArgs.push('-c', 'project_doc_max_bytes=0')
serverArgs.push(...extraCfg, '--stdio')

const p = spawn('cmd.exe', serverArgs, { stdio: ['pipe', 'pipe', 'pipe'] })
let buf = ''
let threadId = null, turnId = null, finished = false
const messages = []        // 所有 agentMessage 文本，按到达顺序
const events = []          // 时间线

const send = o => p.stdin.write(JSON.stringify(o) + '\n')

/** 从 answer 里抠出纯 JSON：优先 ```json 块，否则第一个 { 到最后一个 } */
function extractJson(text) {
  const fence = text.match(/```(?:json)?\s*\n([\s\S]*?)```/)
  const body = fence ? fence[1] : text
  const s = body.indexOf('{'), e = body.lastIndexOf('}')
  if (s < 0 || e <= s) return null
  const slice = body.slice(s, e + 1)
  try { return JSON.parse(slice) } catch { return null }
}

function finish(status, note) {
  if (finished) return
  finished = true
  const elapsed = t()
  const joined = messages.join('\n').trim()
  const parsed = extractJson(joined)

  events.push({ at: elapsed, event: status, note: note || null })

  if (parsed) {
    fs.writeFileSync(outJson, JSON.stringify(parsed, null, 2), 'utf8')
  } else if (joined) {
    fs.writeFileSync(outJson, joined, 'utf8')
  }
  fs.writeFileSync(outMeta, JSON.stringify({
    label, elapsedSeconds: elapsed, cwd, sandbox, approvalPolicy, model: model || null,
    threadId, turnId, status, note: note || null,
    messageCount: messages.length,
    parsed: !!parsed,
    output: path.basename(outJson),
    timeline: events,
  }, null, 2), 'utf8')

  console.log(`\n[${elapsed}s] ==== ${status.toUpperCase()} ${note || ''} ====`)
  console.log(`thread=${threadId} turn=${turnId} messages=${messages.length} parsed=${!!parsed}`)
  console.log(`输出: ${outJson}`)
  if (parsed) console.log(JSON.stringify(parsed, null, 2).slice(0, 3000))
  else if (joined) console.log('---- 未解析为 JSON 的原文 ----\n' + joined.slice(0, 3000))

  // 杀整棵进程树：只 kill cmd.exe 会留下 codex.exe 孙进程继续持有 stdout 句柄，
  // 调用它的 PowerShell 就永远等不到 EOF（实测卡 6 分钟）。
  try { require('child_process').spawnSync('taskkill', ['/pid', String(p.pid), '/T', '/F'], { stdio: 'ignore' }) } catch {}
  try { p.kill() } catch {}
  process.exit(parsed ? 0 : 1)
}

p.stdout.on('data', d => {
  buf += d.toString()
  const lines = buf.split(/\r?\n/); buf = lines.pop()
  for (const line of lines) {
    if (!line.trim()) continue
    let o; try { o = JSON.parse(line) } catch { continue }

    if (o.id === 1 && o.result) {
      events.push({ at: t(), event: 'initialize' })
      console.log(`[${t()}] initialize OK`)
      send({ jsonrpc: '2.0', method: 'initialized' })
    }
    if (o.id === 2 && o.result) {
      threadId = o.result.thread && o.result.thread.id
      events.push({ at: t(), event: 'thread/start', threadId })
      console.log(`[${t()}] thread/start ${threadId}`)
      const params = { threadId, input: [{ type: 'text', text: task, text_elements: [] }] }
      send({ jsonrpc: '2.0', id: 3, method: 'turn/start', params })
    }
    if (o.id === 2 && o.error) finish('failed', 'thread/start: ' + JSON.stringify(o.error).slice(0, 200))
    if (o.id === 3 && o.result) {
      turnId = o.result.turn && o.result.turn.id
      events.push({ at: t(), event: 'turn/start', turnId })
      console.log(`[${t()}] turn/start ${turnId}`)
    }
    if (o.id === 3 && o.error) finish('failed', 'turn/start: ' + JSON.stringify(o.error).slice(0, 200))

    if (o.method === 'item/completed') {
      const it = o.params && o.params.item
      if (!it) continue
      if (it.type === 'agentMessage' && typeof it.text === 'string') {
        messages.push(it.text)
        events.push({ at: t(), event: 'agentMessage', chars: it.text.length })
        console.log(`[${t()}] agentMessage ${it.text.length} 字符`)
      } else {
        events.push({ at: t(), event: it.type })
        console.log(`[${t()}] ${it.type}`)
      }
    }
    if (o.method === 'turn/completed') {
      const st = (o.params && o.params.turn && o.params.turn.status) || 'unknown'
      finish(st === 'completed' ? 'completed' : 'failed', `status=${st}`)
    }
  }
})

p.stderr.on('data', d => {
  const s = d.toString().trim()
  if (s) console.log(`[${t()}] ERR ${s.slice(0, 200)}`)
})
p.on('error', e => finish('failed', 'spawn: ' + e.message))

send({
  jsonrpc: '2.0', id: 1, method: 'initialize',
  params: {
    clientInfo: { name: 'dsh-lead', title: 'DSH lead', version: '0.0.1' },
    capabilities: { experimentalApi: false, requestAttestation: false },
  },
})

setTimeout(() => {
  const params = { cwd, ephemeral: true, approvalPolicy, sandbox }
  if (model) params.model = model
  send({ jsonrpc: '2.0', id: 2, method: 'thread/start', params })
}, 300)

setTimeout(() => finish('failed', '超时'), 180000)
