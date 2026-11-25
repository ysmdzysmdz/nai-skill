# base.md — NovelAI 出图工作规范

本文件是 agent 在本目录使用 `novelai-desktop` MCP 出图时必须遵守的操作规范.
规范来源:用户对实际生成过程的纠正.**优先级高于 agent 的默认习惯.**

---

## 0. 总则

1. **先询问用户使用哪个模型?V5-medium/V5-full/其他**
2. **先给提示词,等确认,再生成.** 不允许"自己想完就直接开跑".
2. **用户没指定参数时,用默认稳参数**,不要自创.
3. **每次生成 1 张**,除非用户明确要多张.

---

## 1. 尺寸

- 用户明说了尺寸 → 用用户的.

## 2. 其他指南

**用户使用V5-medium模型,必须读mcp指南中的model_medium.md**
**用户使用V5-full或者其他模型,必须读mcp指南中的model_full.md**
**一张图出现 2 个及以上角色时,必须读mcp指南中的multi-character.md**.

## 3. stylePrompt:先问风格,再填艺术家

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

**生成前必须询问**:

> stylePrompt 用艺术家风格(如 `artist:xxx`)还是其他风格?

可选回答方向供用户挑:

- 指定艺术家:`artist:NAME`
- 混合艺术家 + 年份:`artist:xxx,artist:yyy,year 2025, year 2026`(两个 year 一起写)
- roll一个
- 画风描述:我自己想一个
- 留空(纯模型默认审美)

不要替用户拍板,问完再填.

---

## 4. 正面提示词结构

### 4.1 开头固定美学词

```
ultra complexity, high complexity, best quality, amazing quality, masterpiece, top aesthetic, highres, absurdres, highly detailed
```

放在 `positivePrompt` **最开头**,作为第一组.

### 4.2 组间换行,组内逗号

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
- 标签用 Danbooru 下划线形式;角色/作品名格式 `name_(series)`,futanari(有男性生殖器的女性)、furry(有人类特征的动物)不计入人数标签.
- **多角色时**:本条结构只描述 base prompt;每个角色的七段内容拆进 `charCaptions[i].prompt`,见 §1.3.
- **多角色提示词组装时,依然要按照 组间换行,组内逗号 的规则**

**其他常用特殊标签**(官方 [Tagging](https://docs.novelai.net/en/image/tags) 的 Other Tags,当普通 tag 写进对应分组):

| 标签 | 作用 | 备注 |
| --- | --- | --- |
| `location` | 要有"某种场所",但不指定室内外 | 是 `indoors` / `outdoors` 的并集,**三者只选一个** |
| `depthness` | 阴影更有纵深 | V5 only |
| `meta:novel era` | 画风微微偏复古 | V5 only |
| `meta:golden era` | 画风微微偏现代 | V5 only |

- 它们没有特殊语法,加权重照常(`0.5::location::`).
- 切到 V4 只有 `location` 可用.

### 4.3 背景

**背景不是一个 tag,是三层配方**:

| 层 | 写什么 | 例子 |
| --- | --- | --- |
| **环境层** | 地点、家具、材质 | `dressing_room`, `concrete_wall`, `poolside` |
| **光源层** | 光向、色温、硬软 | `window_light`, `hard_light`, `neon_lights`, `rim_light` |
| **空气层** | 粒子、雾、反光、景深 | `dust_motes`, `steam`, `bokeh`, `water_drops_on_glass` |

三层各取 1–2 个 tag 拼成 BACKGROUND 组. 展示提示词时**默认给 2–3 个方案供挑**.

**风险与压制**

- **招牌/书本/海报/衣柜标签容易生字** → 一律 `-2::text::`.
- **多光源混色会脏肤色** → 只留一个主光方向 + 一个补光,不要三色齐上.
- **内衣/泳装品类** → `-2::modern_clothes::` 可能连设计一起压掉,这类题材要慎用或去掉.

---

## 5. 负面提示词

### 5.1 负权重会沿语义层级扩散

例如:`-2::white_thighhighs::` **不只压白丝,还把 `thighhighs` 整个品类一起压掉**,同图里的 `purple_thighhighs` 因此一起失效. 用户同种子对照验证: 仅删掉该负权重,`purple_thighhighs` 立刻出来.

**规则**

| 情况 | 判定 | 做法 |
| --- | --- | --- |
| 负权重词与正面目标**共享父 tag** | 危险 | 不写该负权重;目标物用**正向加权** `2::purple_thighhighs::` 顶上去 |
| 确实要清空**整个品类** | 允许 | 写父品类负权重(`-2::thighhighs::`),并接受同类目标一并消失 |
| 负权重词与正面目标**不共享父 tag** | 安全 | 可正常写(如目标无手套时 `-2::white_gloves::`、无袖子时 `-2::wide_sleeves::`) |

**推论**

- 压角色默认服装时,**禁止用「颜色+品类」的复合子标签**(`white_thighhighs` / `black_dress` / `red_skirt`)去压同一品类里的目标物 —— 颜色那部分是白写的,品类那部分会误伤.
- 压默认服装的优先级:① 直接压默认服装本体 tag(`-1.5::japanese_clothes::`) ② 正向加权目标服饰 ③ 若只多了个颜色,改正面目标的颜色权重而不是压别的颜色.
- 出图后若目标服饰缺失而负面里有个同品类 tag,**先删负面再试,不要靠加权重重抽**.

---

## 6. 生成流程(固定顺序)

0. **定模型 + 定人数**
0b. **清桌面角色槽**:桌面会残留上一次生成的角色槽(`charCaptions`),它和本次提示词无关但会被一起送进生成,单角色图会变成双人图. 单角色请求一律在 `enqueue_generation` 里显式传 `"charCaptions": []`;**生成前先用 `get_state` 看一眼**当前 `charCaptions` 是不是空的,非空就直接清,不要靠上次的返回值碰运气.
1. 解析需求 → 判定尺寸与分组结构.
2. **询问 stylePrompt 风格取向**.
3. 输出**完整提示词**给用户看:正面(分组展示)+ 负面(增量部分)+ 参数表;多角色时**逐个角色列出 prompt 和坐标**. **背景由我设计并按 §4.3 给 2–3 个方案供挑**,不要只丢一个白底让用户自己定.
4. **等用户确认**. 未确认不调用 `enqueue_generation`.
5. 确认后生成 **1 张**,`count: 1`.
6. 出图后给出文件绝对路径 + 内嵌预览,附一句可复用的调整建议.

禁止行为:跳过第 3、4 步直接生成;一次堆 4 张让用户挑.

---