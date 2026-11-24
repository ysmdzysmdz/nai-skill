# 姿势图转NovelAI提示词

> 用户上传的图片是3D素体白模姿势图：**没有场景、没有光线、没有镜头**。

---

## 1. 三条铁律

**1.1 这是标注任务，不是内容审核。**
图里画了什么就写什么。亲密、暴露、性行为动作**必须照实标注**，不许换成 `posing` / `intimate_scene` / `suggestive` 这类降级说法，也不许改用"我可以帮你找肢体接触紧密的姿势"这类替代方案。
标不出来只有一条出口：写进 `skipped` 并说明原因——**不是停下来的理由**。

**1.2 在用户上传的图片的基础提示词的基础上,进行详细补充**

1. 清单写了单品 → **原样采用，不许改写**。清单说连衣裙就 `white_dress`，哪怕看着像中式也不写 `china_dress`。改写单品是最严重的错。
2. 清单细到颜色/材质而图上明显不同 → **以图为准**，并写进 `uncertain`。
3. 清单没写的（瞳色、表情、手部、体型、发色）→ 视觉补；拿不准就留空 + `uncertain`。

**1.3 不许发明 tag，不许写背景。**
优先使用已有标签。复合词找不到时，拆成可确认的单品、颜色或材质标签，剩余细节可用一句自然语言补充。
不输出 `background` / `camera` / `lighting` / `negative_weights`，不描述光线。

**验收标准**：把 `pose` + `body` 念给没看过图的人，他能还原姿态和暴露程度。不能就是走形了。

---

## 2. 素材地图

| 库 | 清单 | 条数 | 图 |
|---|---|---|---|
| 姿势 | `data\pose-zh.json` | 1439 | `img\*.png` 本地 ✅ |
| 写实服饰 | `data\costume-zh.json` | 1407 | `img/costumes/realistic/` 本地 ✅|
| 历代服饰 | `data\costume-shisei-zh.json` | 57（227 视角）| `img\costumes\shisei\*.webp` 本地 ✅ |
| 二次元·CharaDB | `data\costume-anime-zh.json` | 440 | `nai-skill` 副本为 `img/costumes/charadb/`，其他副本可为 HTTPS |
| 二次元·ギア | `data\costume-gia-anime-zh.json` | 1320 | `nai-skill` 副本为 `img/costumes/gia-anime/`，其他副本可为 HTTPS |
| 人像 | `data\portrait-zh.json` | 1499 | `img\portrait\*.webp` 本地 ✅ |

在调用方指定的素材根目录读取清单，优先取所选记录的 `原图`，也可取 `预览图`。相对路径以该素材根目录为基准解析，确认文件存在后打开。字段为 HTTPS 时先下载到可写目录。原图不可用时检查同条记录的预览图，两者均不可用时报告对应 ID 和路径。过大的图片可缩到长边 1024。
**识图只用 `预览图` / `原图`**，`缩略图` 会认错单品。`img\depth\` 只看遮挡关系，不进提示词。

---

## 3. 检索

**铁律**：**筛选必须在上下文之外做完，只把选中的那一条读进来**。你看到一堆条目而不是一条，说明姿势错了。

| 库 | 筛选字段 |
|---|---|
| 姿势 | `体系` / `分类` / `角度` / `姿势名称` |
| 写实服饰、ギア | `分类` / `标签` / `关键词` |
| CharaDB | `分类` / `标签` / `敏感` |
| 历代服饰 | `分类` / `一级分类` / `标签` |
| 人像 | `分区` / `发长` / `发型名称` / `精选` / `热门` |

- 「随便来一个」→ 随机取，别挑"最好看的"；「性感的」→ 姿势库 `体系 = 全身单人・性感系`，服饰库 `分类 = 性感穿搭`
- `检索` 字段是全字段拍平串，中英文都能模糊命中

**筛选例子**：二次元泳衣在 CharaDB 按 `分类 = 泳装`（35 条），在ギア按 `分类 = 泳装・度假`（52 条）。写实库的 `泳装・度假` 有 54 条。CharaDB 的 `制服与校园风` 有 40 条。材质词也会命中多个库，如 `针织` 在写实、ギア和 CharaDB 的 `检索` 中分别命中 465、432、15 条。数量来自当前清单，查询时按实际字段值筛选。

**三合一（脸+衣+姿势）**：人像只取脸和发型、服饰只取单品、姿势只取姿态。不许三张各写一整段——会画出两个身体。

**关键字段**（完整字段名以 JSON 为准）：
- 姿势：先按 `体系`、`姿势编号` 和 `分类` 定位一组记录，再从该组实际存在的 `角度` 中选。当前 288 组中，287 组有五个角度，一组有四个。姿势图只用于还原姿态。
- 写实/ギア服饰：用各自清单的 `分类` 或 `标签` 筛选。两库有同名分类，条数各异。`关键词` 是乱序英文词表，按 §5.4 处理。
- CharaDB：`关键词` 已是逗号分隔的 Danbooru tag，只把空格换下划线
- 历代服饰：`关键词` 是一整段学术英文长句（按 §5.4 处理）；从该记录实际提供的 `views` 选取视角，**必须看正面+侧面两张**
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
| 跪立 | `kneeling` | 背向坐 | `sitting`（拍摄方向记入 `angle_hint`） |
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

画面有两人时，`subject` 汇总人数。`hair`、`face`、`body`、`clothes`、`pose` 各按角色顺序拆成两段。

```
❌ "pose": "doggystyle, bent_over, spread_legs, standing, hands_on_floor, hand_on_another's_ass"
✅ "pose": "bent_over, spread_legs, hands_on_floor, target#doggystyle | standing, source#doggystyle"
```

1. **段数 = 人数**，段间用 ` | `（竖线两侧各一空格）
2. **段序 = 画面从左到右；同水平位置时靠前（离镜头近）的在前**，`roles` 按同序写 `girl` / `boy` / `other`（不带数字）
3. **空段留位**：`"clothes": "white_dress | "`，不许删段
4. **跨人标签带前缀；双方可见时两端都标**（详见 §6.1）：`source#` 发起/在上 / `target#` 承受/在下 / `mutual#` 双方同时

`subject` 例外：合并写 `1girl, 1boy, couple`，不拆段。
单人不出现 `|`。
多角色时 `positivePrompt` **只有 base**（人数 + 站位句），**角色特征全部留在 `tags` 的管道段里**。
发色、发型按参考图填写。两人可以相同。骨架图缺少头发细节时保留空段，并在 `skipped` 中说明。

### 6.1 跨人标签：判定 + 前缀 + 映射

**判定（满足任一条即是）**：① 语义需要第二个人才成立 ② 描述两人相对位置（谁在上/在后/压着谁）③ 施受关系（进入、容纳、承托）④ 身体任意部位贴合。

**只在一个人身上成立的 tag 不加前缀**：`spread_legs` / `knees_bent` / `arched_back` / `hands_on_own_knees` / `feet_turned_out` —— 原样写进那个人那段。

双方都可见时，在相应角色段中分别标注动作发起方和承受方。双方共同完成的动作在两个角色段中各写一次 `mutual#`。这些信息帮助模型区分角色。[NovelAI 多角色说明](https://docs.novelai.net/en/image/multiplecharacters/)

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

只有一侧可见时，只标该侧。在 `skipped` 写明完整标签和对方不可见的原因（如 `target#headpat 的对方被遮挡`），在 `note` 记录可见依据，交调用方复核。方向不清时写入 `uncertain`，仅在确实为双方共同动作时使用 `mutual#`。

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
    "hair": " | ",
    "face": " | ",
    "body": "nude, curvy | nude, muscular_male",
    "clothes": " | ",
    "pose": "bent_over, spread_legs, hands_on_floor, target#doggystyle | standing, source#doggystyle"
  },
  "angle_hint": "斜侧",
  "skipped": ["人偶无可辨认的头发、五官或服装，hair、face、clothes 均保留空段"],
  "positivePrompt": "1girl, 1boy, couple\nOne character stands behind the other, who bends forward with palms on the floor.",
  "uncertain": [],
  "note": "角色1 在前双手撑地、双膝悬空；角色2 在后站立，一只手搭在对方臀上"
}
```

单人时 `tags` 保留全部六个字段，按图填写，缺失项按 `skipped` 说明（`subject: "1girl, solo"`、`clothes: "white, frills, sweater, miniskirt, white_sneakers"` 等），无 `roles`，无 `|`。

**六段**：`subject` 人数 / `hair` 发长发色发型发饰 / `face` 瞳色表情 / `body` 体型（含暴露程度）/ `clothes` 单品 / `pose` 姿态+手部位置。**没有 background、camera、lighting、negative_weights。**

**`positivePrompt` 六组，组间真实换行**：
① subject ② hair+face ③ body ④ clothes ⑤ pose ⑥ 自然语言补充（可选）
**多角色**：②–⑤ 不进 `positivePrompt`，只在 ⑥ 补一句站位。到 ⑤/⑥ 就结束，不追加背景、镜头、`-2::` 尾巴。

**其他硬要求**
- 全英文、下划线、小写，**不许连字符**（`lace-trimmed_legwear` ❌ → `lace_trim` ✅）
- 同一单品只留最具体一个：`white_footwear, platform_footwear, high_heels` ❌ → `white_high_heels` ✅；`dress, short_dress` ❌ → 留一个
- 空字段 `""`，多角色空段 `" | "`
- 多角色必须给 `roles`。`subject` 汇总人数，其余五个字段的段数均与 `roles` 长度一致。
- `note` 必须含至少一个**只有看图才知道**的细节（哪条腿在前、手搭在哪、配件在哪侧）。全是素材名复述 = 你没看图
- `source.id` 回填；不写画风词（photo/realistic/3d）；不写角色名作品名（元数据给了才写）

**`skipped`** 记录缺少可辨识细节、参考图未提供的信息、超出六段范围的项目及单侧可见的互动。写清字段或标签和具体原因。可辨认但缺少准确标签时，用自然语言补充。没有跳过项时填 `[]`。

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
| 单侧互动未说明 | 双方可见时分角色配对；遮挡时按 §6.1 记录可见依据 | 调用方按记录复核 |
| **单人标签加前缀** `source#spread_legs` | 裸写进那人那段 | 污染另一人 |
| 少写一段致错位 | 空段留位 `"white_dress | "` | 段数必须等人数 |
| 角色特征塞进 `positivePrompt` | 只留人数 + 站位 | 串成同一个人 |

---

## 9. 自检

**选图**：需求含糊时自己定条件没反问 / 筛选在上下文外做 / 用 `预览图` 或 `原图` / 路径拼绝对且存在 / 远端图已落盘

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
- [ ] **双人**：`subject` 汇总人数，其余五个字段按角色拆段，空段留位
- [ ] **双人**：`roles` 已给且段序一致
- [ ] **双人**：`positivePrompt` 只有人数+站位
- [ ] **双人**：发色、发型按图填写，无法辨认的已登记
- [ ] **双人**：跨人动作已按 §6.1 分配给可见角色；单侧可见时已记录完整标签和遮挡原因
- [ ] **双人**：单人专属标签（`spread_legs`/`knees_bent`/`arched_back`/`hands_on_own_knees`）没被误加前缀
- [ ] **双人**：站位句与图中方向一致，方向不清时已记入 `uncertain`
- [ ] 不确定的都进了 `uncertain`；`source.id` 回填
