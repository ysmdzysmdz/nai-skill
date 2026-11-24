# multi-character.md — 多角色提示词

> 由 [AGENTS.md](AGENTS.md) §1.3 路由到此文件.
> 官方文档:<https://docs.novelai.net/en/image/multiplecharacters>(读取于 2026-11-06)
> 适用:**一张图里 2 个及以上角色**.

---

## 1. 适用范围与上限

- 多角色提示词是 **V4 及以上**才有的功能.
- 官方口径:**V5 最多 22 个角色,V4 / V4.5 最多 6 个**.
- 本 MCP 的 `charCaptions` 数组 schema 允许 **32** 个(工具描述写的是 "V5 allows 32"),**以 22 为实际上限**.

---

## 2. 结构:base prompt + 角色 prompt

一张图拆成两类提示词:

| 部分 | 作用 | MCP 字段 |
| --- | --- | --- |
| **base prompt** | 场景、风格、人数、镜头、构图 | `parameters.positivePrompt` |
| **角色 prompt** | 单个角色的外观/服装/动作 | `charCaptions[i].prompt` |

**核心规则(最容易错的一条)**:

> **人数标签(`1girl` / `2girls` / `3others` …)只写在 base prompt 里.
> 每个角色 prompt 里只写 `girl` / `boy` / `other`,不要带数字.**

否则计数会重复,模型要么画出多余的人,要么把同一个角色画两遍.

```
base:      2girls, side_by_side, indoors, stage, stage_lights, cowboy_shot
角色 1:    girl, long_hair, purple_hair, purple_eyes, white_blouse
角色 2:    girl, very_long_hair, black_hair, red_eyes, turtleneck
```

---

## 3. 排序与位置

**默认排序**:模型按 `charCaptions` 数组顺序放置角色——**从上到下、从左到右**.

- 加 `side_by_side` 时:数组第 1 个通常在**左**,第 2 个在**右**.
- 想调换左右 → 直接调换数组顺序,别在 prompt 里硬拧.

**精确坐标**(推荐用于双人以上或需要叠身位的构图):

```jsonc
"charCaptions": [
  { "prompt": "girl, ...", "useCoords": true, "x": 0.32, "y": 0.5 },
  { "prompt": "girl, ...", "useCoords": true, "x": 0.68, "y": 0.5 }
]
```

- `x`:0 = 最左,1 = 最右;`y`:0 = 最上,1 = 最下. 表示该角色区域的**中心点**.
- 官方说明模型会"closely follow"设定的位置.
- **V4 / V4.5 的坐标受 5×5 网格限制**,V5 更细.
- 坐标要**和数组顺序不冲突**,并**用自然语言再强化一次**(官方 Tip).

> 坐标也能用来定位物体,但需要更仔细的提示词.

---

## 4. 防串味(角色之间特征互相污染)

官方推荐做法是给每个角色单独设 **Undesired Content**,对应 MCP 的 `charCaptions[i].negativePrompt`.

**⚠️ 但默认模型是 medium,而 medium 下自定义负面(全局和角色级)都不会发送**——写进角色的 `negativePrompt` 等于没写. 所以 medium 上只能这样防串味:

1. **特征写具体**:发色/瞳色/发型/服装都明确写,别用模糊词.
2. **在该角色的 prompt 里用负权重**(权重语法对任意 prompt 字段生效):
   ```
   girl, long_hair, purple_hair, -2::blonde_hair::, -2::blue_eyes::
   ```
   > 理论上可行,**未实测**,效果需要观察.
3. **真的压不住就切 full**,用角色级 `negativePrompt` 走官方正路(见 [model-full.md](model-full.md)).

---

## 5. 动作与互动

多角色互动时,用前缀标注主动/被动方:

| 前缀 | 用于 | 例 |
| --- | --- | --- |
| `source#` | 动作发起方 | A 的 prompt:`source#hug` |
| `target#` | 动作承受方 | B 的 prompt:`target#hug` |
| `mutual#` | 双方互相 | 两人的 prompt 都写 `mutual#hug` |

- 例:A 搂 B → A 写 `source#hug`,B 写 `target#hug`;互相搂 → 两边都写 `mutual#hug`.
- 官方明确说这个语法**不一定可靠**,要配合自然语言补一句(如 `She is hugging the other girl.`).
- 引用的官方示例里还用了 `target#pointing` / `source#pointing at another` 这类写法,交互动作都可以套.

---

## 6. MCP 字段映射

| 概念 | MCP 参数 |
| --- | --- |
| base prompt | `parameters.positivePrompt` |
| 角色 prompt | `charCaptions[i].prompt`(必填,非空) |
| 角色 Undesired Content | `charCaptions[i].negativePrompt`(**medium 下无效**) |
| 角色位置 | `charCaptions[i].useCoords` + `x` / `y`(0–1) |
| 人数标签 | 写在 `positivePrompt` 里 |
| 全局风格 | `parameters.stylePrompt` |

- `charCaptions` 是**整体替换**:不传 = 保留桌面现有角色;传 `[]` = 清空.
- 桌面若残留空的角色槽(`get_state` 里 `references.characterCount > 0` 且 prompt 为空),**生成前先传 `[]` 清掉**.
- 官方网页端的 `|` 分隔符写法在 MCP 里**不适用**,这里一律用 `charCaptions` 数组.

---

## 7. 完整示例(双人)

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
    "positivePrompt": "ultra complexity, high complexity, best quality, amazing quality, masterpiece, top aesthetic, highres, absurdres, highly detailed\n2girls, side_by_side, indoors, stage, stage_lights, falling_petals\ncowboy_shot, from_above, centered",
    "negativePrompt": "",
    "stylePrompt": "artist:xxx, year 2025, year 2026"
  },
  "charCaptions": [
    { "prompt": "girl, long_hair, purple_hair, purple_eyes, blunt_bangs, white_blouse, pleated_skirt, hands_on_own_hips", "useCoords": true, "x": 0.32, "y": 0.5 },
    { "prompt": "girl, very_long_hair, black_hair, red_eyes, turtleneck, ripped_jeans, source#pointing", "useCoords": true, "x": 0.68, "y": 0.5 }
  ],
  "count": 1,
  "maxAnlas": 120
}
```

---

## 8. 检查清单

- [ ] 只有 1 个角色? → 不用本文,走 [AGENTS.md](AGENTS.md) §7 单角色模板
- [ ] 人数标签(`2girls` 等)在 **base prompt** 里,不在角色 prompt 里
- [ ] 每个角色 prompt 以 `girl` / `boy` / `other` 开头,**不带数字**
- [ ] 角色外貌写进各自 prompt,base 里没有重复描述同一角色
- [ ] 2 人以上或需要精确站位 → 已设 `useCoords` + `x`/`y`,且与数组顺序一致
- [ ] 已在 base 里用自然语言强化站位
- [ ] medium 下没指望 `negativePrompt` 生效(防串味走具体描述或正面负权重)
- [ ] 已清掉桌面残留的空角色槽