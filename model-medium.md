# model-medium.md — medium 机制说明

> 由 [AGENTS.md](AGENTS.md) §1 路由到此文件.
> **日常生图不需要打开本文件** —— 参数在 [AGENTS.md](AGENTS.md) §1.2,模板在 §7.
> 本文只解释"为什么",供排查用.

---

## 1. 这些参数为什么调不动

`nai-diffusion-5-full-medium` 是蒸馏加速档,程序会强制归一化:

| 项 | 强制值 | 原因 |
| --- | --- | --- |
| steps | 14 | 蒸馏模型按 14 步训练,写 28/40 会被**静默**改成 14,不报错 |
| sampler | `k_euler_ancestral` | 同上,固定采样器 |
| ucPreset | 0 (Heavy) | 固定用 Heavy 负面档 |
| cfgRescale | 0 | 固定 |

另有 V5 系通用规则:`noiseSchedule` 一律 `karras`.

**真正可调的只有**:尺寸、`cfgScale`(0–10)、`qualityPreset`、提示词、`stylePrompt`.

如果你看到"设了 28 步但出图明显是 14 步的效果",不是 bug,是这里.

---

## 2. 负面提示词为什么不生效

程序在组包时对 medium 做了这一步(源码 `nai.js:496`):

```js
const effectiveNegative = merge(
  isNAIMediumModel(params.model) ? "" : stripPromptComments(params.negativePrompt),
  ucPresetText(params.model, params.ucPreset)
);
```

也就是说 **medium 下你的 `negativePrompt` 被直接替换成空串**,只保留 ucPreset 0 的内置 Heavy 负面. 不报错、不提示,纯静默丢弃.

要排除元素,只能写进正面提示词的负权重:

```
..., -2::foot_out_of_frame::, -2::wet_skin::, -1::bad_hands::
```

内置 Heavy 负面(程序已自带,**不要重复写**):

```
lowres, artistic error, film grain, scan artifacts, worst quality, bad quality,jpeg artifacts, very displeasing, chromatic aberration, dithering, halftone,screentone, multiple views, logo, too many watermarks, negative space, blank page
```

---

## 3. 风格照常生效

`stylePrompt` 与正面提示词合并后发送,与模型无关. 艺术家写法见 [AGENTS.md](AGENTS.md) §2.

---

## 4. 成本

Opus 档、1216×832、14 步:**0 Anlas**
(实测 2026-11-06,`quote_generation` 回报 `base text-to-image generation is free for this size/step request`).
超免费区间或非 Opus 档另算.

---

## 5. 什么时候该切回 full

- 需要精确控制步数(比如 28 步的稳定出图质感)
- 需要用 `negativePrompt` 精细排除,不想挤在正面里
- 需要 ucPreset 换档(Heavy / Light / 关闭)

切过去之前先读 [`model-full.md`](model-full.md).
