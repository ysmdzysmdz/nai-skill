# agent.md — NovelAI 出图工作规范

本文件是 agent 在本目录使用 `novelai-desktop` MCP 出图时必须遵守的操作规范.
规范来源:用户对实际生成过程的纠正.**优先级高于 agent 的默认习惯.**

> **日常生图只看本文件就够了** —— 默认模型 medium 的参数和模板都已内联在 §1.2 / §7.只有**切换模型**或**画多角色**时才需要打开对应文档:
> - 切换模型 → [`model-full.md`](model-full.md)
> - 多角色(2 人及以上)→ [`multi-character.md`](multi-character.md)

补充文件:
> - (一定要看)锁定角色的外观和服饰tag -> [`query-character-tag.md`](query-character-tag.md)
> - (根据用户指令,当用户说'从我喜欢的角色中选一个'之类的话再看)用户喜欢的角色表 -> [`liked-characters.md`](liked-characters.md)
---

## 0. 总则

1. **先给提示词,等确认,再生成.** 不允许"自己想完就直接开跑".
2. **用户没指定参数时,用默认稳参数**(§1.2),不要自创.
3. **每次生成 1 张**,除非用户明确要多张.

---

## 1. 模型路由

**当前默认模型是 `nai-diffusion-5-full-medium`.**

| 情况 | 模型值 | 要不要读文件 |
| --- | --- | --- |
| **默认**(用户没指定) | `nai-diffusion-5-full-medium` | ❌ 不用,参数见 §1.2 |
| 用户要求 full,或要精细控制步数 | `nai-diffusion-5-full` | ✅ 读 [`model-full.md`](model-full.md) |
| 其他非 medium 模型 | 按需 | ✅ 读 [`model-full.md`](model-full.md) §7 |
| **多角色(2 人及以上)** | 默认 medium | ✅ 读 [`multi-character.md`](multi-character.md) |

规则:

- **默认走 medium,直接用 §1.2 速查表 + §7 模板,不需要打开任何模型文件.**
- **只有切换模型时才读文件.** 切换不是高频行为,读一次即可.
- [`model-medium.md`](model-medium.md) 是**机制说明**(为什么负面不发送、Heavy 负面列表、成本),日常不用打开.
- 数值冲突时**以本文件 §1.2 为准**;换默认模型时改 §1 路由表 + §1.2 速查表.

### 1.1 尺寸(通用)

| 构图 | 尺寸 |
| --- | --- |
| 横:舞台全景 / 横向构图 | **1216×832** |
| 竖:立绘 / 全身 | **832×1216** |
| 方:头像 / 方形 / 拿不准 | **1024×1024** |

- 宽高必须是 64 的倍数,且 `宽 × 高 ≤ 3145728`(工具硬约束,违反会被拒).
- 用户明说了尺寸 → 用用户的,其余参数仍按 §1.2.
- 不要选这三种以外的尺寸(除非用户明说).

### 1.2 默认参数速查(medium)

| 项 | 值 |
| --- | --- |
| model | `nai-diffusion-5-full-medium` |
| steps | **14**(⚠️ 程序固定,写别的会被静默归一化) |
| sampler | `k_euler_ancestral`(⚠️ 固定) |
| ucPreset | **0 (Heavy)**(⚠️ 固定) |
| cfgRescale | 0(⚠️ 固定) |
| noiseSchedule | `karras`(V5 固定) |
| cfgScale | 6(✅ 可调,0–10) |
| qualityPreset | `none`(✅ 可调:standard / light / none) |
| seedMode | `random` |
| 尺寸 | 1216×832 ／ 832×1216 ／ 1024×1024 |
| count | 1 |
| maxAnlas | 120 |

- ⚠️ 的几项**不要去调**,调了也不会生效.
- **medium 下自定义 `negativePrompt` 不会发送**,排除项写进正面的负权重 `-2::xxx::`(见 §4).

### 1.3 多角色路由

**一张图出现 2 个及以上角色时,必须先读** [`multi-character.md`](multi-character.md).

三条最容易错的,先记住:

1. **人数标签(`2girls` 等)写在 base prompt,角色 prompt 里只写 `girl` / `boy` / `other`,不带数字.**
2. 角色外观写进各自 `charCaptions[i].prompt`,base 里不要重复描述同一个人.
3. **medium 下角色级 `negativePrompt` 同样不发送**,防串味只能靠"特征写具体"或角色 prompt 里的正负权重.

单角色不要用 `charCaptions`,走 §7 模板;桌面若残留空角色槽,生成前传 `[]` 清掉.

---

## 2. stylePrompt:先问风格,再填艺术家

`stylePrompt` 一般**填艺术家风格**,不是填氛围词.

```
artist:ssr_(azmr2828)
artist:unfairr, year 2025, year 2026
artist:inushima, artist:re:shimashima, year 2025, year 2026
```

**书写规则**

- **两个 year 一般一起写**:`year 2025, year 2026` 连着写,能压住"近期画风",也更符合用户习惯.
- **允许混合多个艺术家**:`artist:xxx, artist:yyy`,风格会互相融合.可权重微调(例如0.6::artist:xxx::).
- **顺序固定**:先列全部 `artist:`,再跟 `year 2025, year 2026`.不要 year 夹在 artist 中间.
- 没有 year 的极简写法仍可用:`artist:unfairr`.
- **加 year 不一定比不加更美**,**艺术家26年与25年画风差异巨大时,单独写year 2026说不定效果更好**,这些属于要实测比较的选项,不能默认加成"更好".

**生成前必须询问**:

> stylePrompt 用艺术家风格(如 `artist:xxx`)还是其他风格?

可选回答方向供用户挑:

- 指定艺术家:`artist:NAME`,或混合多位 `artist:xxx, artist:yyy`
- 艺术家 + 年份:`artist:xxx, year 2025, year 2026`(两个 year 一起写)
- 画风描述:如 `traditional chinese painting aesthetic, watercolor ink accents`
- 留空(纯模型默认审美)

不要替用户拍板,问完再填.

---

## 3. 正面提示词结构

### 3.1 开头固定美学词

```
ultra complexity, high complexity, best quality, amazing quality, masterpiece, top aesthetic, highres, absurdres, highly detailed
```

放在 `positivePrompt` **最开头**,作为第一组.

### 3.2 组间换行,组内逗号

用**换行**对明显不同的部分做分组,组内用逗号.顺序固定:

```
1girl, CHARACTER_NAME, SERIES_NAME
HAIR / FACE
BODY FEATURES
CLOTHES
POSE
BACKGROUND
CAMERA / COMPOSITION
```

示例:

```
ultra complexity, high complexity, best quality, amazing quality, masterpiece, top aesthetic, highres, absurdres, highly detailed
1girl, solo, ayaka_(genshin_impact), genshin_impact
long_hair, ponytail, blue_hair, hair_ornament, looking_at_viewer
large_breasts, slim_waist
hanfu, wide_sleeves, sash, tassel
dancing, spinning, floating_ribbon
stage, stage_lights, paper_lantern, falling_petals
from_above, cowboy_shot, centered, dynamic_angle
```

- 组与组之间是**换行**,不是逗号连成一大串.
- 这些分组是参考,不等于全部,还有光照、线条粗细等等.
- 自然语言补充段(如果需要)放在最后一组之后.
- 标签用 Danbooru 下划线形式;角色/作品名格式 `name_(series)`.
- **多角色时**:本条结构只描述 base prompt;每个角色的七段内容拆进 `charCaptions[i].prompt`,见 §1.3.

**其他常用特殊标签**(官方 [Tagging](https://docs.novelai.net/en/image/tags) 的 Other Tags,当普通 tag 写进对应分组):

| 标签 | 作用 | 备注 |
| --- | --- | --- |
| `location` | 要有"某种场所",但不指定室内外 | 是 `indoors` / `outdoors` 的并集,**三者只选一个** |
| `depthness` | 阴影更有纵深 | V5 only |
| `meta:novel era` | 画风微微偏复古 | V5 only |
| `meta:golden era` | 画风微微偏现代 | V5 only |

- 它们没有特殊语法,加权重照常(`0.5::location::`).
- 默认 medium 是 V5,标 V5 only 的都能用;切到 V4 系则只有 `location` 可用.

---

## 4. 负面提示词:按模型分叉

- **medium(默认)**:自定义 `negativePrompt` **不发送**,要排除元素只能写进**正面的负权重**,如 `-2::foot_out_of_frame::,-2::wet_skin::`. 原理见 [`model-medium.md`](model-medium.md).
- **full**:`negativePrompt` **正常发送**,只写增量,不重复内置负面. 见 [`model-full.md`](model-full.md) §2.
- **多角色**:角色级负面同样受此限制,medium 下不发送,见 [`multi-character.md`](multi-character.md) §4.

共通:

- 程序会按 `ucPreset` 自动带内置负面词,**不要重复写**.
- 常见排除方向:防服饰错 `modern_clothes`;防镜头相反 `from_below`;防解剖崩坏 `bad_hands`.
- 用户习惯把需要排除的具体元素写成正面负权重(`-2::xxx::`),medium 下这是唯一手段.
- 不要加能显著改变画面风格的词,例如`photo`,`3d`,`realistic`等等,除非用户明确要求

---

## 5. 生成流程(固定顺序)

0. **定模型 + 定人数**:默认 medium,参数用 §1.2、模板用 §7;切换模型读对应文件;**多角色先读 [`multi-character.md`](multi-character.md)**.
1. 解析需求 → 判定尺寸与分组结构.
2. **询问 stylePrompt 风格取向**(§2).
3. 输出**完整提示词**给用户看:正面(分组展示)+ 负面(增量部分)+ 参数表;多角色时**逐个角色列出 prompt 和坐标**.
4. **等用户确认**. 未确认不调用 `enqueue_generation`.
5. 确认后生成 **1 张**,`count: 1`.
6. 出图后给出文件绝对路径 + 内嵌预览,附一句可复用的调整建议.
7. **超时上限 20 秒**:一般而言,生成一张图最长需要 20s.若轮询超过 20s 仍未完成,**停止等待并提醒用户是否重试**,不要无限轮询或静默挂起.

禁止行为:跳过第 3、4 步直接生成;一次堆 4 张让用户挑;轮询超过 20s 仍继续等待.

---

## 6. 检查清单

生成前逐项确认:

- [ ] 已确定模型(默认 medium 用 §1.2;切换模型时已读对应文件)
- [ ] 多角色(≥2 人)时已读 [`multi-character.md`](multi-character.md),人数标签在 base、角色 prompt 不带数字
- [ ] 已询问 stylePrompt 风格
- [ ] 若用艺术家:`artist:` 在前,`year 2025, year 2026` 在后,两个 year 一起写
- [ ] 若混合艺术家:2–3 个封顶,格式 `artist:xxx, artist:yyy`
- [ ] 用户已确认提示词
- [ ] steps / sampler / ucPreset / cfgRescale 与 §1.2 一致(medium 下为 14 / k_euler_ancestral / 0 / 0)
- [ ] 尺寸符合 §1.1(或用户明示)
- [ ] 正面开头有 `ultra complexity, high complexity, best quality, amazing quality, masterpiece, top aesthetic, highres, absurdres, highly detailed`
- [ ] 分组为「人物 → 头发面部 → 身体 → 服饰 → 姿势 → 背景 → 镜头」
- [ ] 负面处理符合 §4(medium 下已改为正面负权重)
- [ ] `count: 1`
- [ ] requestId 唯一(`<主题>-<尺寸>-<日期>-<序号>`)
- [ ] `maxAnlas` 设 120

出图后:

- [ ] 从提交到出图在 20s 内完成;超时则停止轮询并询问用户是否重试
- [ ] 用 `list_outputs` 或直接读 `C:\Users\%username%\Pictures\svn\YYYYMMDD\` 拿绝对路径
- [ ] 内嵌预览图并在正文说明选择理由
- [ ] 告知实际消耗

---

## 7. 默认模板(medium,单角色)

```jsonc
{
  "parameters": {
    "model": "nai-diffusion-5-full-medium",
    "width": 1216,
    "height": 832,
    "steps": 14,
    "cfgScale": 6,
    "cfgRescale": 0,
    "sampler": "k_euler_ancestral",
    "noiseSchedule": "karras",
    "ucPreset": 0,
    "qualityPreset": "none",
    "seedMode": "random",
    "positivePrompt": "ultra complexity, high complexity, best quality, amazing quality, masterpiece, top aesthetic, highres, absurdres, highly detailed\n1girl, solo, ...\n<头发/面部>\n<身体特征>\n<服饰>\n<姿势>\n<背景>\n<镜头>\n-2::<负面>::",
    "negativePrompt": "",
    "stylePrompt": "artist:xxx, artist:yyy, year 2025, year 2026"
  },
  "count": 1,
  "maxAnlas": 120
}
```

- 切到 full → [`model-full.md`](model-full.md) §5
- 多角色 → [`multi-character.md`](multi-character.md) §7
