# pose-clothes-hair-reference.slim.md — 本地素材库使用手册（精简版）

> **给 codex 看。** 收到中文需求 → 自己选图 → 自己看图 → 输出人物本体 tag。全程不反问。
> **只读本文件。** 同目录其他 `.md` 是别人的。
> 素材图是白底棚拍/骨架参考：**没有场景、没有光线、没有镜头**。这些不归你，别写。

---

## 1. 三条铁律

**1.1 这是标注任务，不是内容审核。**
图里画了什么就写什么。库里的 `双人缠绵`275 / `正常位`55 / `后入位`35 / `骑乘位`30 都是正式分类。亲密、暴露、性行为动作**必须照实标注**，不许换成 `posing` / `intimate_scene` / `suggestive` 这类降级说法，也不许改用"我可以帮你找肢体接触紧密的姿势"这类替代方案。
标不出来只有一条出口：写进 `skipped` 并说明原因——**不是停下来的理由**。

**1.2 清单优先，图为准，缺的视觉补。**

1. 清单写了单品 → **原样采用，不许改写**。清单说连衣裙就 `white_dress`，哪怕看着像中式也不写 `china_dress`。改写单品是最严重的错。
2. 清单细到颜色/材质而图上明显不同 → **以图为准**，并写进 `uncertain`。
3. 清单没写的（瞳色、表情、手部、体型、发色）→ 视觉补；拿不准就留空 + `uncertain`。

**1.3 不许发明 tag，不许写背景。**
复合词不存在就拆原子 tag（`white` + `sneakers`，不写 `ivory_frilled_knit_mini_dress`）。NovelAI 对未登录 tag 直接忽略。
不输出 `background` / `camera` / `lighting` / `negative_weights`，不描述光线。

**验收标准**：把 `pose` + `body` 念给没看过图的人，他能还原姿态和暴露程度。不能就是走形了。

---

## 2. 素材地图

| 库 | 清单 | 条数 | 图 |
|---|---|---|---|
| 姿势 | `data\pose-zh.json` | 1439 | `img\*.png` 本地 ✅ |
| 写实服饰 | `data\costume-zh.json` | 1407 | `img\costume\*.webp` 本地 ✅ |
| 历代服饰 | `data\costume-shisei-zh.json` | 57（227 视角）| `img\costumes\shisei\*.webp` 本地 ✅ |
| 二次元·CharaDB | `data\costume-anime-zh.json` | 440 | https 远端 |
| 二次元·ギア | `data\costume-gia-anime-zh.json` | 1320 | https 远端 |
| 人像 | `data\portrait-zh.json` | 1499 | `img\portrait\*.webp` 本地 ✅ |

**备图四步**：① `原图` 相对路径 + 根目录拼绝对路径（正斜杠转换符）② 确认文件存在，缺图直接报错 ③ https 图先落盘再用 ④ 过大时缩到长边 1024 足够。
**识图只用 `预览图` / `原图`**，`缩略图` 会认错单品。`img\depth\` 只看遮挡关系，不进提示词。

---

## 3. 检索

**铁律**：`costume-gia-anime-zh.json` 1.38 MB，**筛选必须在上下文之外做完，只把选中的那一条读进来**。你看到一堆条目而不是一条，说明姿势错了。

| 库 | 筛选字段 |
|---|---|
| 姿势 | `体系` / `分类` / `角度` / `姿势名称` |
| 写实服饰、ギア | `分类` / `标签` / `关键词` |
| CharaDB | `分类` / `标签` / `敏感` |
| 历代服饰 | `分类` / `一级分类` / `标签` |
| 人像 | `分区` / `发长` / `发型名称` / `精选` / `热门` |

- 「随便来一个」→ 随机取，别挑"最好看的"；「性感的」→ 姿势库 `体系 = 全身单人・性感系`，服饰库 `分类 = 性感穿搭`
- 二次元库默认排除 `敏感 = true`
- `检索` 字段是全字段拍平串，中英文都能模糊命中

**词汇分布（省空结果用）**：风格词（水手服/和服/洛丽塔/女仆）**只在 anime 库有**，写实库为 0；季节材质词（针织 465 / 蕾丝 346 / 吊带 233 / 短袜 349 / 牛仔 175）只在 costume-zh；朝代词只在 shisei。**找校园风按 `分类 = 制服与校园风` 筛（40 条），别搜「水手服」（全库 4 条）。**

**三合一（脸+衣+姿势）**：人像只取脸和发型、服饰只取单品、姿势只取姿态。不许三张各写一整段——会画出两个身体。

**关键字段**（完整字段名以 JSON 为准）：
- 姿势：`体系`(4 种) `分类`(26 种) `姿势名称` `角度`(正面/斜侧/侧面/俯视/仰视)；同编号 5 张图按 `角度` 取；**不含服装**
- 写实/ギア服饰：`分类`(夏季 254/冬季 253/秋季 244/春季 215/内衣・睡衣 199/性感穿搭 140/泳装 54/派对礼服 48) `标签`(中文拆词) `关键词`(乱序英文词表，按 §5.4 处理)；**人物是模特占位**
- CharaDB：`关键词` 已是逗号分隔的 Danbooru tag，只把空格换下划线
- 历代服饰：`关键词` 是一整段学术英文长句（按 §5.4 处理）；4 个 `views`，**必须看正面+侧面两张**
- 人像：只含脸和头发，`标准基础款` 占 755 条

---

## 4. 看图

**必须真的打开图看，不能只读元数据。** 只开真正需要的几张（历代服饰开两张）。

- 补元数据没有的：瞳色、表情、手部位置、体型
- 看到什么记什么，含亲密/暴露动作
- 图上明显但元数据没写的 → 进 `uncertain`，别硬编
- 不脑补背景和光线；白就是白
- 服饰图：人是模特，只提服装结构；姿势图：人是骨架，只提姿态，**不提服装、不提镜头**

---

## 5. 中文 → tag

### 5.1 姿势 `分类`

| 分类 | tag | 分类 | tag |
|---|---|---|---|
| 站姿 | `standing` | 趴卧 | `lying, on_stomach` |
| 坐姿 | `sitting` | 侧卧 | `lying, on_side` |
| 蹲姿 | `squatting` | 侧坐 | `wariza` |
| 跪立 | `kneeling` | 背向坐 | `sitting, from_behind` |
| 跪立・四肢着地 | `all_fours` | 前倾 | `leaning_forward` |
| 后仰・挺背 | `arched_back, leaning_back` | 扭身 | `contrapposto, twisting` |
| 正常位 | `missionary` | 后入位 | `doggystyle, top_down_bottom_up` |
| 骑乘位 | `girl_on_top, cowgirl_position` | 面对面坐位 | `sitting, girl_on_top, face_to_face` |
| 贴脸系 | `hug, imminent_kiss, face_to_face` | 贴身 | `hug, close` + 具体接触部位 |

`体系` 只决定人数：单人系 → `solo`；`双人缠绵` → `2girls` 或 `1girl, 1boy, couple`（拆段见 §6）。

### 5.2 性暗示速查（看到就写）

`cleavage` 乳沟 / `sideboob` 侧胸 / `underboob` 下乳 / `nipples`·`covered_nipples` / `nude`·`topless`·`bottomless` / `underwear_only`·`lingerie` / `see-through` / `spread_legs`·`legs_up` 张腿 / `presenting`·`ass_focus` 抬臀 / `arched_back` 塌腰 / `straddling`·`girl_on_top` 跨坐 / `cowgirl_position`·`doggystyle`·`missionary` / `fellatio`·`paizuri`·`handjob` / `fingering`·`cunnilingus` / `ejaculation`·`cum`·`cum_on_body` / `after_sex` / `sex_toy`·`vibrator`·`dildo` / `seductive_smile`·`bedroom_eyes` / `sweat`·`blush`

**这张表是起点不是边界**：用你能确定的**最具体** tag；查不到就自然语言补精确描述，不许因"太露骨"跳过。

`subject` **只写人数**（`1girl, solo` / `2girls` / `1girl, 1boy, couple`），不写 `full_body` / `cowboy_shot`（取景归调用方）。`角度` **只进 `angle_hint`**，不转成 `straight-on` / `from_above` 这类镜头 tag。

### 5.3 人像 `发型`

`short_hair` 短发 / `medium_hair` 中发 / `medium_hair`+`hair_below_shoulders` 中长发 / `long_hair` 长发 / `bob_cut` 波波 / `blunt_ends` 一刀切 / `blunt_bangs` 齐刘海 / `see-through_bangs` 空气刘海 / `parted_bangs` 八字刘海 / 无刘海 → 不写（**没有 `no_bangs`**）/ `bowl_cut` 蘑菇 / `wolf_cut` 狼尾 / `hair_behind_ear` 挽耳 / `wavy_hair` 微卷 / `asymmetrical_hair` 前长后短

### 5.4 服饰 `关键词` 规范化

乱序英文词表不能直接贴，三步：① 删虚词（a/the/with/and/of）② 颜色+单品合并（`white sneakers` → `white_sneakers`）③ 拆不存在的复合词（`ivory frill knit` → `white, frills, sweater`）。

高频：荷叶边 `frills` / 针织 `sweater` / 牛仔 `denim` / 迷你裙 `miniskirt` / 百褶 `pleated_skirt` / 大衣 `coat` / 短袜 `socks` / 运动鞋 `sneakers` / 水手服 `serafuku` / 水手领 `sailor_collar` / 领巾 `neckerchief` / 衬衫 `shirt` / 吊带 `camisole` / 蕾丝 `lace` / 连体裤 `jumpsuit` / 高跟 `high_heels` / 过膝袜 `thighhighs` / 旗袍 `china_dress` / 和服 `kimono` / 浴衣 `yukata` / 洛丽塔 `lolita_fashion` / 泳装 `swimsuit`·`bikini`
颜色：象牙白→`white`（`ivory` 不是 tag）/ 藏青→`navy_blue` / 酒红→`wine_red`

**历代服饰长句**：能落地的单品 → tag（`pleated skirt` → `pleated_skirt`，`sash belt` → `sash`）；朝代整句和 Danbooru 没有的专有名词（`bixi`、`yichang`、`daxiu shan`）→ **只进自然语言补充段**。判据：查得到 → tag；查不到 → 自然语言。

---

## 6. 多角色：`|` 拆段

画面 2 人 → **六个字段每个都拆两段**。

```
❌ "pose": "doggystyle, bent_over, spread_legs, standing, hands_on_floor, hand_on_another's_ass"
✅ "pose": "bent_over, spread_legs, hands_on_floor, target#doggystyle | standing, source#doggystyle, hand_on_another's_ass"
```

1. **段数 = 人数**，段间用 ` | `（竖线两侧各一空格）
2. **段序 = 画面从左到右；同水平位置时靠前（离镜头近）的在前**，`roles` 按同序写 `girl` / `boy` / `other`（不带数字）
3. **空段留位**：`"clothes": "white_dress | "`，不许删段
4. **跨人标签必须带前缀，两端都标**（详见 §6.1）：`source#` 发起/在上 / `target#` 承受/在下 / `mutual#` 双方同时

`subject` 例外：合并写 `1girl, 1boy, couple`，不拆段。
单人不出现 `|`。
多角色时 `positivePrompt` **只有 base**（人数 + 站位句），**角色特征全部留在 `tags` 的管道段里**。
**两人发色发型必须不同**，否则会串成同一个人。

### 6.1 跨人标签：判定 + 前缀 + 映射

**判定（满足任一条即是）**：① 语义需要第二个人才成立 ② 描述两人相对位置（谁在上/在后/压着谁）③ 施受关系（进入、容纳、承托）④ 身体任意部位贴合。

**只在一个人身上成立的 tag 不加前缀**：`spread_legs` / `knees_bent` / `arched_back` / `hands_on_own_knees` / `feet_turned_out` —— 原样写进那个人那段。

**同一对接触两端都必须出现**：角色1 有 `source#x`，角色2 就必须有 `target#x`。只标一端 = 模型不知道另一端是谁，会退化成并排摆拍。

| 画面 | source 端 | target 端 |
|---|---|---|
| 坐在对方腿上 | `source#sitting_on_lap` | `target#sitting_on_lap` |
| 跨坐 | `source#straddling` | `target#straddling` |
| 女上骑乘 | `source#girl_on_top` | `target#girl_on_top` |
| 面对面上位 | `source#upright_straddle` | `target#upright_straddle` |
| 后仰靠着对方 | `source#leaning_on` | `target#leaning_on` |
| 头靠对方肩 | `source#head_on_another's_shoulder` | `target#head_on_another's_shoulder` |
| 膝枕 | `source#lap_pillow`（躺的人）| `target#lap_pillow`（出膝的人）|
| 摸对方部位 | `source#hand_on_another's_knee` | `target#hand_on_another's_knee` |
| 公主抱 | `source#princess_carry` | `target#princess_carry` |
| 压在上面 | `source#pinning` | `target#pinning` |
| 亲吻 | `source#kissing` | `target#kissing` |
| 摸头 | `source#headpat` | `target#headpat` |
| 正常位/后入 | 上方/后方 `source#missionary`·`source#doggystyle` | 下方/前方 `target#...` |
| 口交/乳交/手交 | `source#fellatio`·`source#paizuri`·`source#handjob` | `target#...` |
| 指交/舔阴 | `source#fingering`·`source#cunnilingus` | `target#...` |
| 拥抱/牵手/对视 | 两段都写 `mutual#hug`·`mutual#holding_hands`·`mutual#eye_contact` | 同左 |

**兜底**：只有一侧可见 → 只标可见侧 + `note` 写明 + 进 `skipped`；方向拿不准 → 退 `mutual#`，别写裸标签；`note` 和自然语言段必须用白话复述方向（"她在前，坐在后者腿上"）。

```
❌ "pose": "sitting_on_lap, spread_legs, knees_bent | sitting, legs_apart"
✅ "pose": "source#sitting_on_lap, spread_legs, knees_bent, feet_turned_out | target#sitting_on_lap, sitting, legs_apart, legs_extended"
```

---

## 7. 输出契约

严格一个 JSON，**不要包代码块**。单双人结构相同，双人多的只有 `|` 拆段和 `roles`。

```json
{
  "source": {"library": "pose-zh", "id": "pair60_P045_diag", "image": "C:\\...\\pair60_P045_diag.png"},
  "roles": ["girl", "boy"],
  "tags": {
    "subject": "1girl, 1boy, couple",
    "hair": "long_hair, brown_hair | short_hair, black_hair",
    "face": " | ",
    "body": "nude, curvy | nude, muscular_male",
    "clothes": " | ",
    "pose": "bent_over, spread_legs, hands_on_floor, target#doggystyle | standing, source#doggystyle, hand_on_another's_ass"
  },
  "angle_hint": "斜侧",
  "skipped": ["两张脸只有定位线，瞳色表情无法辨认，face 两段留空"],
  "positivePrompt": "1girl, 1boy, couple\nOne character stands behind the other, who bends forward with palms on the floor.",
  "uncertain": [],
  "note": "角色1 在前双手撑地、双膝悬空；角色2 在后站立，一只手搭在对方臀上"
}
```

单人时 `tags` 六段直接写满（`subject: "1girl, solo"`、`clothes: "white, frills, sweater, miniskirt, white_sneakers"` 等），无 `roles`，无 `|`。

**六段**：`subject` 人数 / `hair` 发长发色发型发饰 / `face` 瞳色表情 / `body` 体型（含暴露程度）/ `clothes` 单品 / `pose` 姿态+手部位置。**没有 background、camera、lighting、negative_weights。**

**`positivePrompt` 六组，组间真实换行**：
① subject ② hair+face ③ body ④ clothes ⑤ pose ⑥ 自然语言补充（可选）
**多角色**：②–⑤ 不进 `positivePrompt`，只在 ⑥ 补一句站位。到 ⑤/⑥ 就结束，不追加背景、镜头、`-2::` 尾巴。

**其他硬要求**
- 全英文、下划线、小写，**不许连字符**（`lace-trimmed_legwear` ❌ → `lace_trim` ✅）
- 同一单品只留最具体一个：`white_footwear, platform_footwear, high_heels` ❌ → `white_high_heels` ✅；`dress, short_dress` ❌ → 留一个
- 空字段 `""`，多角色空段 `" | "`
- 多角色必须给 `roles`，六段段数都 = `roles` 长度
- `note` 必须含至少一个**只有看图才知道**的细节（哪条腿在前、手搭在哪、配件在哪侧）。全是素材名复述 = 你没看图
- `source.id` 回填；不写画风词（photo/realistic/3d）；不写角色名作品名（元数据给了才写）

**`skipped`**：空数组 = 一样没落。漏了明显存在的东西又没登记 = 不合格。「太露骨」不是理由；合格理由只有"找不到准确 tag"（同时用自然语言补）和"不属六段范围"。性暗示动作默认全写，只有你决定不写才登记。

---

## 8. 错误对照表

| ❌ | ✅ | 原因 |
|---|---|---|
| `ivory_frilled_knit_mini_dress` | `white, frills, sweater, miniskirt` | 复合 tag 不存在 |
| `关键词` 逗号串直接贴 | 拆复合词、空格换下划线 | 词表 ≠ tag 表 |
| 写 `white_background` / `studio` | 不写 | 素材没有场景 |
| 输出 `background`/`camera`/`lighting` | 只留六段 | 调用方的活 |
| 自己补 `-2::` | 不写 | 调用方统一加 |
| `no_bangs` / `no_hat` | 直接不写 | 负面描述不是 tag |
| 三合一各写一整段 | 脸/衣/姿态各取所需 | 会画成两个人 |
| 中文服装名 | 英文 tag，中文只进 `note` | NovelAI 吃英文 |
| 用 `缩略图` 识图 | `预览图`/`原图` | 认错单品 |
| 把模特脸写成角色 | 只写发型发色 | 模特是占位 |
| 从姿势图推断服装 | 不写服装 | 骨架参考 |
| dump 整个 gia JSON | 上下文外筛完只读一条 | 1.38 MB 烧额度 |
| 清单连衣裙→`china_dress` | `white_dress` | 改写单品 = 换衣服 |
| `角度` → `straight-on` | 只进 `angle_hint` | 镜头不是素材属性 |
| `subject` 写 `full_body` | `1girl, solo` | 取景归调用方 |
| 性行为写成 `couple, intimate` | `missionary`/`doggystyle`/`girl_on_top` | 降级 = 走形 |
| 挤胸写成 `posing` | `cleavage, breast_squeeze` | 抹掉重点 |
| 太露骨就不写也不吭声 | 照写；写不了进 `skipped` | 静默省略 = 没看见 |
| 双人动作糊成一串 | `|` 按角色拆段 | 分不清谁做什么 |
| **互动标签裸写** `sitting_on_lap, hug` | `source#` + `target#` 两端都标 | 退化成并排摆拍 |
| **只标一端** | 另一端补 `target#` | 半条信息容易画反 |
| **单人标签加前缀** `source#spread_legs` | 裸写进那人那段 | 污染另一人 |
| 少写一段致错位 | 空段留位 `"white_dress | "` | 段数必须等人数 |
| 角色特征塞进 `positivePrompt` | 只留人数 + 站位 | 串成同一个人 |

---

## 9. 自检

**选图**：需求含糊时自己定条件没反问 / 筛选在上下文外做 / 排除 `敏感 = true` / 用 `预览图` 或 `原图` / 路径拼绝对且存在 / 远端图已落盘

**看图**：真打开原图看过，`note` 有看图才知的细节 / 历代服饰看了正+侧两张 / 素材性质（骨架/模特/只含脸）对应处理了

**出词**
- [ ] 亲密/暴露/性行为动作照实写了，没换保守词
- [ ] `pose` 能还原具体动作，不是 `posing`
- [ ] `skipped` 存在，跳过项都有具体原因
- [ ] 元数据逐项对照过；没有复合臆造 tag
- [ ] 无 `background`/`camera`/`lighting`；无 `white_background`/`studio`
- [ ] `subject` 只有人数；`angle_hint` 有写；`角度` 没转镜头 tag
- [ ] 六段顺序正确；无画风词
- [ ] `note` 不是素材名复述
- [ ] **双人**：六段都拆、段数 = 人数、空段留位
- [ ] **双人**：`roles` 已给且段序一致
- [ ] **双人**：`positivePrompt` 只有人数+站位
- [ ] **双人**：两人发色发型不同
- [ ] **双人**：按 §6.1 逐人核对——所有跨人标签有前缀且两端都在，裸 `sitting_on_lap`/`hug`/`hand_on_another's_*`/性交位一律不合格
- [ ] **双人**：单人专属标签（`spread_legs`/`knees_bent`/`arched_back`/`hands_on_own_knees`）没被误加前缀
- [ ] **双人**：站位句写了方向；拿不准的已退 `mutual#`
- [ ] 不确定的都进了 `uncertain`；`source.id` 回填
