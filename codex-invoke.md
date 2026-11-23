# codex-invoke.md — 本地素材库调用手册

> **给调度方 agent（lead）看。** 用户说「从素材库挑个姿势/服饰/人像」「参考这个发型」这类话时，读本文件。
>
> **一句话原则：素材库的活全部归 codex，我只发一句话、只收一个成品提示词。**
> codex 干活所需的知识在 [`pose-clothes-hair-reference.md`](pose-clothes-hair-reference.md)——那是它的手册，不是我的。

当前通过 `codex-as.js` 调用 `codex app-server`，使用默认的 stdio 传输。

---

## 0. 速查

### 0.1 一条命令

新电脑先确认 `node --version` 和 `codex --version` 都能运行。需要安装 CLI 时，可用 `npm install -g @openai/codex`，再按 `codex` 的提示登录。

```powershell
# 在项目根验证 CLI、登录与 JSON 输出
.\runs\bin\run-codex.ps1 -Label smoke -Sandbox read-only -NoIndex -Prompt '只回复 {"ok":true}，不调用工具。'

# 先创建 runs\req\poseA.txt，再执行任务并补索引
.\runs\bin\run-codex.ps1 -Label poseA -PromptFile .\runs\req\poseA.txt

# 直连底层（不补索引时才用）
node .\runs\bin\codex-as.js --cwd (Get-Location).Path --label poseA --task .\runs\req\poseA.txt
```

产物直落 `runs\`，提示词放 `runs\req\`，索引 `runs\runs.jsonl`，见 §7。

### 0.2 什么任务交给 codex

| 需求 | 归谁 |
|---|---|
| 从素材库挑姿势 / 服饰 / 人像，翻成 tag | **codex** |
| 决定取景、镜头、背景 | 我 |
| 把 tag 套到指定角色、体型、露骨细节 | 我 |
| 双人按 `\|` 拆段、定坐标 | 我 |

---

## 1. 分工边界

| 环节 | 谁干 |
|---|---|
| 读 JSON 清单、按分类/关键词筛选、随机抽一条 | **codex** |
| 拼绝对路径、校验图片存在、下载远端图、缩图 | **codex** |
| 打开参考图、看图识特征 | **codex** |
| 输出人物本体六段 tag（subject / hair / face / body / clothes / pose） | **codex** |
| **决定取景范围**（全身 / 半身 / 特写） | 我 |
| **设计背景**（环境 / 光源 / 空气三层配方，见 AGENTS.md §3.3） | 我 |
| **决定从哪个角度看、镜头怎么给** | 我 |
| 双人时按 `\|` 拆段、映射 `charCaptions`、定坐标 | 我 |
| 收 tag → 补取景镜头 → 加参数 → 问 stylePrompt → 出图 | 我 |

**我不碰素材库。** 不自己读 `data\*.json`、不自己 `Get-Random`、不自己 `Test-Path`、不自己看参考图。

**素材库的图是白底棚拍、完成度很低的参考**，镜头方向读不出来，只能我自己按画面意图定；codex 那边也已禁止输出取景与镜头。

---

## 2. 发什么：先剥离属于我的部分

### 2.1 剥离规则

用户原话常同时包含两件事：

- **（a）** 从素材库挑什么姿势 / 服饰 / 发型 → 归 codex
- **（b）** 把结果套到哪些角色、什么体型、什么露骨细节 → 归我

**（b）必须从提示词里删掉**，只把（a）传过去。角色名、体型要求（巨乳 / 肥阴阜等）、想加的身体 tag 一律不进 codex 的输入。

**为什么**：codex 只被授权做「把素材图如实翻译成 tag」。需求里一旦出现「给指定角色写提示词」，只有两种结局——按标注器规则判越权而拒绝（白跑一次），或硬填导致 `skipped` 的如实性作废（`hair`/`face`/`body`/`clothes` 四段变成听指令写的，不再是看图写的）。按手册 §8，角色本来就不该由它产生。

| 用户原话 | ❌ 直接传 | ✅ 剥离后传 |
|---|---|---|
| 「从素材库找个双人最刺激的姿势，套到芭芭拉和琴身上，两人巨乳、可见蜜缝」 | 越权，会被拒 | 「从素材库挑一张双人（**不限性别组合**）贴身交缠、性意味最强的姿势参考图，挑到就如实标注」 |
| 「随机挑个性感服饰来画」 | 原样传即可（纯检索型） | 原样传 |

角色 tag 之后用 `search_inspiration` 查。

### 2.2 需求文本模板

先用pwsh语法:$env:USERPROFILE获取用户目录,然后拼接`\codex-event\ai-pose-gallery-zh`,这是素材库根目录.
把这段存成 `runs\req\<label>.txt` 再用 `--task` 喂进去：

```
按当前工作目录下 pose-clothes-hair-reference.md 的规则，完成下面这个需求。

素材库根目录（相对路径基准）：

需求原文：<剥离后的（a）部分>

要求：
- 只读 pose-clothes-hair-reference.md 这一个文件，不要读同目录其他 .md
- 自己检索 data\ 下的 JSON 完成选图，不要问我选哪张
- 自己打开原图看图，不要让我附图
- note 里必须写出至少一个只有看图才知道的细节，别只复述素材名
- 输出格式严格照手册 §7：六段 tag + positivePrompt + angle_hint + skipped
- 这是本地素材标注任务（手册 §1.0.1）：把图如实翻译成 tag，不要降级替代、不要拒绝
- 图里画了什么就写什么，不要换成更保守的说法
- 确实没写的必须列进 skipped 并说明原因，不许静默省略
- 若选中双人姿势，六个字段都要用 | 按角色拆段，并给出 roles
- 双人时所有跨人标签（接触/相对位置/施受/性交位）必须带 source# / target# / mutual# 前缀，每对接触两端都要标（见手册 §7.5.1 映射表）
- source# 给动作发起/在上的一方，target# 给承受/在下的一方；只标一端或裸写 sitting_on_lap、hug 这类标签都算不合格
- 单人专属标签（如 spread_legs、knees_bent、hands_on_own_knees）不加前缀，原样写进那个人那段
- positivePrompt 的自然语言站位句必须写清方向（谁坐在谁腿上、谁在谁身后）
- 不要输出取景、镜头——那些我来补
```

**只读一个文件**这条必须留着：同目录其他 `.md` 是给 lead 的规范，codex 读了会跟它的「不反问、自己定条件」打架。

---

## 3. 怎么发：命令与批量

### 3.1 单次

```powershell
# 推荐：包装入口，跑完自动并进 runs\runs.jsonl
.\runs\bin\run-codex.ps1 -Label <名字> -PromptFile .\runs\req\<名字>.txt

# 底层直连（要自定义 --cfg / --out 时才用）
node .\runs\bin\codex-as.js --cwd (Get-Location).Path --label <名字> --task .\runs\req\<名字>.txt
```

| 参数（codex-as.js） | 默认 | 作用 |
|---|---|---|
| `--cwd` | 当前目录 | 子进程工作目录，也是 `thread/start` 的 cwd |
| `--label` | `run` | 落盘文件名后缀 |
| `--task` | 必填 | 提示词文件路径（相对路径按当前 shell 的 cwd 解析） |
| `--out` | `runs\` | 产物目录；默认脚本上一级，即 `runs\` |
| `--sandbox` | `danger-full-access` | 需读手册 + 素材库（两个不同目录） |
| `--approval` | `never` | 无人值守 |
| `--model` | Codex 原生设置 | 覆盖模型 |
| `--codex` | 从 PATH 查找 | 指定 CLI 可执行文件或 npm 的 `bin\codex.js` |
| `--cfg key=value` | — | 追加 `-c key=value`，可重复 |
| `--with-project-doc` | 关 | 保留 cwd 下 AGENTS.md 注入（一般不要，见 §8.3） |

| 参数（run-codex.ps1） | 默认 | 作用 |
|---|---|---|
| `-Label` | 必填 | 名字，同时决定产物后缀 |
| `-PromptFile` / `-Prompt` | 二选一必填 | 提示词文件，或直接给字符串（会落临时文件） |
| `-Sandbox` | `danger-full-access` | 透传 |
| `-Model` | — | 透传 |
| `-CodexPath` | 从 PATH 查找 | 透传给 `--codex` |
| `-NoIndex` | 关 | 跳过归档 |
| `-WithProjectDoc` | 关 | 透传 |

### 3.2 批量：多个选图合并成一次调用

同一批次要 N 个选图（**类型可以混**）时合并成一次调用，让它在**最后一条消息**里输出 `results` 数组。

此时提示词里必须加的三条：

```
本需求包含【三个独立】的选图标注任务，你要分别选出三张不同的原图，各自标注。
任务1（服饰）：...
任务2（姿势）：...
任务3（人像）：...
三个任务必须选【三张不同的原图】，不许同一张图交两遍。
```

末尾固定格式：

```
【输出格式 — 必须严格遵守】
在最后一条消息里，只输出一个 JSON 对象，不要任何其他文字：
{"results":[{"task":1,"kind":"clothes", ...手册 §8 全部字段...},{"task":2,"kind":"pose", ...},{"task":3,"kind":"portrait", ...}]}
```

**「最后一条消息」必须写死** —— 否则它可能拆成多条消息分别答，`results` 就残缺。

### 3.3 不许合并的情况

- **跨职责需求**（挑姿势 + 套指定角色/体型）：角色和体型一个字都不进 codex 输入（§2.1）。
- **有串行依赖的**：得看到前一份结果才能定后一份，合并等于让它猜。

类型混不混无所谓，门槛只有一条：**每份都得是「把一张图如实翻译成 tag」这同一件事**。

---

## 4. 收回后：校验与组装

### 4.1 八步流程

```
runs\<stamp>_<label>.json（六段 + angle_hint + skipped）
   ↓ ① 【我组装】positivePrompt 首行补 AGENTS.md §3.1 的美学词
   ↓ ② 校验六段顺序：subject → hair+face → body → clothes → pose
   ↓ ②b 校验 skipped：对照 §6 的空段事实表，该空的空=合格，不该空的空=漏标
   ↓ ②c 校验 pose 不是 posing / elegant_pose 这类空话——是就退回重做
   ↓ ②d 【双人必做】前缀校验，跑下面脚本，出裸标签或单向标就整份退回
   ↓ ③ 【我判断】取景：全身 / 半身 / 特写，写进 subject 段
   ↓ ④ 【我判断】镜头：读 angle_hint + 姿势名称，决定角度
   ↓ ④b 【机械拆分】roles ≥ 2 时按 | 拆段 → charCaptions，坐标我定
   ↓ ⑤ 按 AGENTS.md §1.1 定尺寸、§1.2 定参数
   ↓ ⑥ 按 AGENTS.md §2 问用户 stylePrompt 取向（不许替用户拍板）
   ↓ ⑦ 展示完整提示词 + 参数表，等用户确认
   ↓ ⑧ enqueue_generation，count=1，**显式传 charCaptions**（单角色传 `[]` 清桌面残留）
```

### 4.2 ②d 裸标签校验（双人必跑）

codex 的前缀是它自己标的，**不能默认它对**。`$fail` 非空就整份退回重做，别手工补救——手工补一次它下次还错，退回才能让它自己收敛。

```powershell
$j    = Get-Content .\runs\<stamp>_<label>.json -Raw | ConvertFrom-Json
$n    = $j.roles.Count
$fail = @()

# 1) 段数校验：body / clothes / pose 每段都必须等于人数
foreach ($f in 'hair','face','body','clothes','pose') {
  $c = (($j.tags.$f -split '\|')).Count
  if ($c -ne $n) { $fail += "段数不符: $f = $c 段, 应为 $n" }
}

# 2) 裸跨人标签：出现在任何段里都算错
$naked = 'sitting_on_lap','straddling','girl_on_top','cowgirl_position','upright_straddle',
         'hug','hugging','kissing','kiss_on_cheek','holding_hands','headpat','head_rest',
         'lap_pillow','carrying','princess_carry','on_top_of','pinning','leaning_on',
         'missionary','doggystyle','fellatio','paizuri','handjob','fingering','cunnilingus',
         'hug_from_behind','breast_grab'
$segs = $j.tags.pose -split '\|'
for ($i = 0; $i -lt $segs.Count; $i++) {
  $toks = ($segs[$i] -split ',') | ForEach-Object { $_.Trim() }
  foreach ($k in $naked) { if ($toks -contains $k) { $fail += "裸标签 $k 出现在第 $($i+1) 段" } }
}

# 3) 配对校验：source#X 必须在另一段有 target#X 或 mutual#X
$map = @{}
for ($i = 0; $i -lt $segs.Count; $i++) {
  foreach ($m in [regex]::Matches($segs[$i], '(source|target|mutual)#([\w''\-]+)')) {
    $map[$m.Groups[1].Value + '#' + $m.Groups[2].Value] += ,$i
  }
}
foreach ($k in $map.Keys) {
  if ($k -like 'source#*') {
    $name = $k.Substring(7)
    if (-not $map.ContainsKey("target#$name") -and -not $map.ContainsKey("mutual#$name")) {
      $fail += "缺配对: $k 没有对应的 target#$name"
    }
  }
  if ($k -like 'mutual#*' -and $map[$k].Count -lt 2) { $fail += "$k 只出现在一段，应两段都有" }
}
if ($fail) { "REJECT:"; $fail } else { "OK: 前缀与段数通过" }
```

批量结果要**逐份**跑，不能只校验第一份。

### 4.3 ③ 取景

codex 只给人数（`1girl, solo`），取景由我按画面重点加：

| 意图 | 取景 tag |
|---|---|
| 立绘 / 展示整套服装 | `full_body` |
| 半身肖像 / 强调上半身姿势 | `upper_body` |
| 腰部以上带一点腿 | `cowboy_shot` |
| 脸部特写 | `portrait` + `close-up` |

### 4.4 ④ 镜头

看 `angle_hint`（codex 只告知参考图拍摄方向，不给 tag），再按姿势本身选：

| 姿势特征 | 镜头选择 |
|---|---|
| 全身立绘 / 展示服装线条 | `straight-on` 或 `three-quarter view` |
| 腰胯、腿线是重点 | `from_below` 或 `from_side` |
| 趴卧 / 俯身 | `from_above` |
| 双人缠绵 | `from_above` 或 `three-quarter view`，别正面平铺 |

`camera` 合法值：`straight-on`、`three-quarter view`、`from_side`、`from_above`、`from_below`。
**`from_front` 不是 tag，别写。**

### 4.5 ④b 拆 charCaptions

`roles` 长度 ≥ 2 时，先读 [`multi-character.md`](multi-character.md)，然后纯机械拆分：

```
roles: ["girl", "boy"]
tags.hair : "long_hair, brown_hair | short_hair, black_hair"
tags.pose : "bent_over, ..., target#doggystyle | standing, ..., source#doggystyle"
             └────── 第1段 ──────┘             └──── 第2段 ─────┘

charCaptions[0].prompt = "girl, long_hair, brown_hair, ..., bent_over, ..., target#doggystyle"
charCaptions[1].prompt = "boy, short_hair, black_hair, ..., standing, ..., source#doggystyle"
```

四条要点：

1. **每个角色 prompt 以 `roles[i]` 开头，不带数字**——`girl` / `boy`，不是 `1girl`
2. **人数标签只在 base 里**，角色 prompt 里不重复
3. **坐标我定**：按段序从左到右均分 `x`（如 0.32 / 0.68），`y` 用 0.5；两人前后叠压时调 `y` 拉开
4. **`source#` / `target#` / `mutual#` 前缀原样透传**：不增、不删、不改名。codex 交什么就进 `charCaptions` 什么。前缀缺失或缺配对只有一条处理路径——走 §4.2 退回重做。

### 4.6 ④c 段数校验

`hair` / `face` / `body` / `clothes` / `pose` 五个字段每个都必须正好切出 `roles.Count` 段。少一段说明 codex 漏了人，退回重做。

`subject` 例外——它是人数汇总，理想写法 `1girl, 1boy, couple`。实测有时写成 `1girl | 1boy`，**两种都收**：含 `|` 就按 `, ` 拼回一段，别当错误退回。

切段时：空段要保留占位（`" | "` 切出两个空串，仍计入段数）；切完去掉首尾空格。

---

## 5. 角色套用

### 5.1 查角色 tag

用 `novelai-desktop` MCP 的 `search_inspiration`（`source: "character"`），拿 `looks` + `outfit` 两栏。别凭记忆写角色特征。

### 5.2 性别改写（`roles` ≠ 实际角色性别时）

检索时刻意**不限定性别组合**：库里明确的插入 / 内射 / 骑乘位多是 1 男 1 女，写死 `2girls` 会把它们全筛掉。

`roles` 只决定**段数**和**左右顺序**，性别词是我的活：

| codex 交回 | 第 1 段开头 | 第 2 段开头 | base 人数标签 |
|---|---|---|---|
| `["girl","girl"]` | `girl` | `girl` | `2girls` |
| `["girl","boy"]` → 用户要双女 | `girl` | **`girl, futanari`**（不写 `boy`） | **`2girls, futanari`**（不是 `1girl, 1boy`；暗示档可换 `implied_futanari`） |
| `["girl","boy"]` → 用户就要男女 | `girl` | `boy` | `1girl, 1boy` |

**futa 分两档**（`futanari` 是属性词，不参与计数，所以 base 用 `2girls` 再挂它最稳）：

| 档位 | tag | 语义 |
|---|---|---|
| **暗示（默认走这档）** | `implied_futanari` | 靠体位 + `source#` / `target#` 让观者知道是扶她，**不画器官** |
| 明示 | `futanari, large_penis, erection, pussy` | 要真的看到器官；保留女阴才是 futa，别只写 `penis` |

**默认用暗示档。** futa 的身份由「谁在谁身后、谁在动」承载，不一定需要可见器官。明示档在侧视 doggy、侧视 missionary 这类构图上很难稳定画出来，而且有两个坑：

- **base 里别写 `-2::male::`**：它和 `penis` 语义强相关，等于用大权重把「男性生殖器」这个概念从整张图上抹掉，futa 的器官会被连带压没，画面退化成干净纯百合。要压男性角色只写 `-2::1boy::`。
- **承受方那段别写 `-2::penis::`**：同上。

明示档下删掉 `yuri`，它会把语义拉向「无阴茎百合」。反向：**真有 boy 参与时**（4 人图那种），要写 `hetero` 并加 `-2::futanari::`、`-2::yuri::`，同时把 `-2::1boy::` 去掉。

**配套 tag**（暗示档不需要）：插入位 `penis_on_pussy` / `deep_penetration` / `guided_penetration`；内射 `cum_in_pussy`；双扶她 `futa_with_futa`；扶她受 `futasub`。

**验收口径**：看不到器官但 `source#` / `target#` 都落在正确的人身上、朝向一致、插入方骨盆与承受方髋部贴合 —— 就算 futa 成立，不必为了「看见」去硬掰姿势。

**跨人前缀不受性别改写影响**：`source#` / `target#` 原样跟着段走，谁的段就留在谁的段里。

---

## 6. 事实表：各类型任务的空段

判 `skipped` 是否成立时对这张表：

| 任务类型 | 天然为空的段 | 说明 |
|---|---|---|
| 服饰（`costume-zh`） | `hair` / `face` | 无头无臂的模特架展示，这两段本该空；`clothes` 必须填满 |
| 姿势（`pose-zh`） | `hair` / `face` / `clothes` | 关节人偶，三件都空是正常的，`pose` 必须填满 |
| 人像（`portrait-zh`） | `clothes` | 半身/头像裁切，`hair` + `face` 是重点，`clothes` 空属正常 |

**该空的空了 = 合格的如实标注；不该空的空了 = 漏标，退回。**

---

## 7. 落盘与索引

### 7.1 结构

2026-11-22 整理后，**所有 codex 相关的东西都在 `runs\` 下**，项目根只剩文档：

```
nai-skill\
  AGENTS.md  model-*.md  multi-character.md  codex-invoke.md  …   ← 只有文档
  runs\
    bin\codex-as.js                 底层 JSON-RPC 客户端
    bin\run-codex.ps1               包装入口（跑完自动补索引）
    bin\archive-codex.ps1           索引器
    req\kimono_poseA.txt            提示词，一个任务一个文件
    req\lingerieA.txt
    20261122-213527_kimono_poseA.json        提取出的纯 JSON 答案
    20261122-213527_kimono_poseA.meta.json   耗时 / thread+turn id / 时间线 / parsed 标记
    runs.jsonl                      一行一条记录的索引（含 raw 全文）
    _legacy_exec\                   exec 时代的历史日志（可删）
```

三条硬规则：

1. **提示词只放 `runs\req\`**，命名跟 `-Label` 对齐（`req\hugA.txt` ↔ `-Label hugA`），别在根目录留 `req.txt`。
2. **脚本只放 `runs\bin\`**，调用时从项目根执行，路径写全 `.\runs\bin\...`。
3. **只删数据不要删 `runs\bin\` 与 `runs\req\`**——它们是代码和输入，不是产物。

### 7.2 索引

`runs\runs.jsonl` 是**派生数据，可删**——重跑 `archive-codex.ps1` 从 `runs\*.json` 原样重建（实测字节数一致）。唯一数据源是 `runs\*.json`。

```powershell
.\runs\bin\archive-codex.ps1            # 增量索引（幂等）
.\runs\bin\archive-codex.ps1 -List      # 摘要：编号 / 时间 / 名字 / 份数 / 大小
.\runs\bin\archive-codex.ps1 -Show 5    # 第 5 条完整记录（含 raw）

# 按内容搜
Select-String -Path .\runs\runs.jsonl -Pattern 'doggystyle' | ForEach-Object {
    ($_.Line | ConvertFrom-Json) | Select-Object runAt, label, itemCount
}
```

> 脚本用 `Split-Path $PSScriptRoot -Parent` 反推项目根，所以**从任何目录调用都能找到 `runs\`**，不用先 cd。

### 7.3 什么时候手工干预

本次产物共用 `<时间戳>-<运行ID>_<标签>` 前缀。脚本先写答案与 `runs\log\` 下的日志，再发布 `.meta.json`。归档器仍支持旧文件名。

- CLI 缺失、提前退出或回合失败 → 看 `.meta.json` 的 `status`、`note` 和同名前缀的 `.out.log`。没有答案时 `output` 为 `null`。回合完成且最终回复解析为 JSON 对象时，退出码才为 `0`。

- `.meta.json` 里 `parsed: false` → 答案不是合法 JSON（常见于它把格式句当解释），看 `runs\` 里保存的原文，然后**重跑**，不要在索引里手工补。
- `itemCount` 少于要求的任务数 → 它漏做了某个任务，同样重跑。
- 每次运行有 `.meta.json` 和 `.out.log`。有回复时还会生成答案 `.json`。`runs\_legacy_exec\` 存放旧版 `exec` 的日志。

### 7.4 编码坑（2026-11-22 记）

两个 `.ps1` 都已存成 **UTF-8 with BOM**。理由：Windows PowerShell 5.1（`powershell.exe`）读无 BOM 的 UTF-8 会按 GBK 解码，中文全变乱码并报 `TerminatorExpectedAtEndOfString`，导致脚本根本进不了第一行逻辑。用 pwsh 7 调用时看不出问题，一旦被 5.1 或计划任务调用就炸。

重存命令（改完脚本若丢了 BOM，跑这个补回来）：

```powershell
foreach ($f in '.\runs\bin\run-codex.ps1','.\runs\bin\archive-codex.ps1') {
  $t = Get-Content $f -Raw -Encoding utf8
  Set-Content -Path $f -Value $t -Encoding utf8BOM -NoNewline
}
```

---

## 8. 协议与坑

### 8.1 JSON-RPC 时序（自己写客户端时照这个）

```
→ {"jsonrpc":"2.0","id":1,"method":"initialize","params":{
     "clientInfo":{"name":"...","title":"...","version":"..."},
     "capabilities":{"experimentalApi":false,"requestAttestation":false}}}
← {"id":1,"result":{"userAgent":"...","codexHome":"...","platformOs":"windows"}}
→ {"jsonrpc":"2.0","method":"initialized"}
→ {"jsonrpc":"2.0","id":2,"method":"thread/start","params":{
     "cwd":"<工作目录>","ephemeral":true,"approvalPolicy":"never","sandbox":"danger-full-access"}}
← {"id":2,"result":{"thread":{"id":"01a2...","ephemeral":true}}}
→ {"jsonrpc":"2.0","id":3,"method":"turn/start","params":{
     "threadId":"01a2...","input":[{"type":"text","text":"<任务>","text_elements":[]}]}}
← 通知流: item/completed {item:{type:"agentMessage",text:"...",phase:"final_answer"}}
          item/completed {item:{type:"commandExecution"}}
          item/completed {item:{type:"imageView"}}
← {"method":"turn/completed","params":{"turn":{"status":"completed"}}}
```

帧格式是 **JSONL**（一行一个 JSON），不是 LSP 的 `Content-Length` 头。

审批/沙箱三档（抄自官方实现）：

| `permissionMode` | 参数 |
|---|---|
| `never` | `{approvalPolicy:'never'}` |
| 自动审批 | `{approvalPolicy:'on-request', approvalsReviewer:'auto_review', sandbox:'workspace-write'}` |
| 全放行 | `{approvalPolicy:'never', sandbox:'danger-full-access'}` |

### 8.2 三个坑

1. **`codex app-server proxy` 不转发 JSON-RPC。** 它连着 daemon（`~/.codex/app-server-control/app-server-control.sock`），但实测发 `initialize` 后 10 秒零帧。当前调用直接使用 `codex app-server` 的默认 stdio，每次启动一个进程。
2. `codex-as.js` 取 `final_answer`，旧版协议取最后一条无 `phase` 的 `agentMessage`。最终文本可用 JSON 代码围栏包裹。解析失败时保留原文，并记录 `parsed:false`。
3. **仍是每次新进程。** 省的是包装层不是推理。

### 8.3 AGENTS.md 会自动注入

`app-server` 和 `exec` 一样，会按 `~/.codex/config.toml` 的项目信任判定，把 cwd 下的 `AGENTS.md` 读进上下文。实测在 `nai-skill` 目录里直接跑，它答出 `C:\Users\76383\dsh-event\nai-skill\AGENTS.md`。

**`codex-as.js` 默认加 `-c project_doc_max_bytes=0` 关掉**（实测再问一遍返回 `none`）。理由是那份 AGENTS.md 是给出图 agent 的规范，「先问 stylePrompt 再生成」「每次生成 1 张」这些规则跟手册的「不反问、自己定条件」直接打架，还会白烧 3–4k tokens。

要保留该行为（例如让 codex 遵守项目规范做别的事）传 `--with-project-doc`。
