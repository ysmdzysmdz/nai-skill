# model-full.md — NAI Diffusion V5 Full(非 medium)

> 由 [AGENTS.md](AGENTS.md) §1 路由到此文件.
> 适用:用户明确要求 full、或需要精细控制步数时.

---

## 1. 参数表

| 项 | 值 | 说明 |
| --- | --- | --- |
| model | `nai-diffusion-5-full` | |
| steps | **28** | ✅ 可调(1–50). 28 是实测最稳组合,**不要擅自提到 30/40** |
| sampler | `k_euler_ancestral` | ✅ 可调 |
| noiseSchedule | `karras` | V5 系一律 karras |
| cfgScale | 6 | ✅ 可调,范围 0–10 |
| cfgRescale | 0 | ✅ 可调 |
| ucPreset | 1 (Light) | ✅ 可调,见 §2 的内置负面说明 |
| 分辨率 | 1216×832(横)／832×1216(竖)／1024×1024(方) | ✅ 可调,规则见 [AGENTS.md](AGENTS.md) §1.1 |
| qualityPreset | `none` | ✅ 可调:standard / light / none |

full 下**全部参数真实生效**,没有被程序静默覆盖的项.

---

## 2. 负面提示词:正常发送

`negativePrompt` **会发送**,只写需要额外排除的词. 程序的默认负面词由 `ucPreset` 决定:

| ucPreset | 含义 | 内置负面 |
| --- | --- | --- |
| 0 | Heavy(最严) | 见下方列表 |
| **1** | **Light(默认)** | 见下方列表 |
| 3 | 不使用内置负面 | 空 |

Heavy :
```
lowres, artistic error, film grain, scan artifacts,worst quality, bad quality,jpeg artifacts, very displeasing, chromatic aberration, dithering, halftone, screentone, multiple views, logo, too many watermarks, negative space, blank page
```

Light 默认负面(程序已自带,**不要重复写**):

```
lowres, artistic error, scan artifacts, worst quality, bad quality, jpeg artifacts, multiple views, very displeasing, too many watermarks, negative space, blank page
```

`negativePrompt` 增量示例:

- 防服饰错误:`modern_clothes, school_uniform, kimono`
- 防镜头相反:`from_below`(当要求俯视时)
- 防解剖崩坏:`bad_hands, extra_fingers, deformed`
- 不要加能显著改变画面风格的词,例如`photo`, `3d`, `realistic`等等,除非用户明确要求

正面负权重(`-2::xxx::`)在 full 下同样可用,和 `negativePrompt` 二选一即可.

---

## 3. 风格

`stylePrompt` 照常生效(与正面提示词合并后发送),艺术家写法见 [AGENTS.md](AGENTS.md) §2.

---

## 4. 成本

Opus 档、1216×832、28 步:**0 Anlas**
(实测 2026-11-06,`quote_generation` 回报 `base text-to-image generation is free for this size/step request`).
超免费区间或非 Opus 档另算.

---

## 5. 快速模板

```jsonc
{
  "parameters": {
    "model": "nai-diffusion-5-full",
    "width": 1216,
    "height": 832,
    "steps": 28,
    "cfgScale": 6,
    "cfgRescale": 0,
    "sampler": "k_euler_ancestral",
    "noiseSchedule": "karras",
    "ucPreset": 1,
    "qualityPreset": "none",
    "seedMode": "random",
    "positivePrompt": "ultra complexity, high complexity, best quality, amazing quality, masterpiece, top aesthetic, highres, absurdres, highly detailed\n1girl, solo, ...\n<头发/面部>\n<身体特征>\n<服饰>\n<姿势>\n<背景>\n<镜头>",
    "negativePrompt": "<仅增量>",
    "stylePrompt": "artist:xxx, artist:yyy, year 2025, year 2026"
  },
  "count": 1,
  "maxAnlas": 120
}
```

---

## 6. 本模型专项清单

- [ ] steps = 28(没擅自提到 30/40)
- [ ] ucPreset 按需选(默认 1=Light;要更严选 0=Heavy)
- [ ] 负面词只写增量,未重复 Light 列表
- [ ] 确认参数来自**本文件**,不是 `model-medium.md`

---

## 7. 换成其他非 medium 模型时

`nai-diffusion-5-curated` / `4-5-full` / `4-5-curated` / `4-full` / `4-curated` / `3` 的参数结构与本文件相同(无强制归一化),但:

- 内置负面列表**随模型不同**,换之前先确认 `ucPreset` 对应的实际文本
- V5 curated 是 V5 full 的另一种裁剪,审核与风格偏好不同,提示词结构可沿用
- V3 与 V4/V4.5 不支持 `charCaptions`,多角色需换回 V5
