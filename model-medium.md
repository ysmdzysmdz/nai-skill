# model-medium.md — NAI Diffusion V5 medium

## 1.参数表

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
| 尺寸 | 1216×832 ／ 832×1216 ／ 1024×1024 |
|maxAnlas|120(✅ 可调)|
- ⚠️ 的几项**不要去调**,调了也不会生效.

---

## 2. 负面提示词

- **medium**:自定义 `negativePrompt` **不发送**,把需要排除的元素写成正面负权重(`-2::xxx::`).
- 程序会按 `ucPreset` 自动带内置负面词,**不要重复写**.

Heavy :
```
lowres, artistic error, film grain, scan artifacts,worst quality, bad quality,jpeg artifacts, very displeasing, chromatic aberration, dithering, halftone, screentone, multiple views, logo, too many watermarks, negative space, blank page
```

- 常见排除方向:防服饰错 `modern_clothes`;防镜头相反 `from_below`;防解剖崩坏 `bad_hands`;防水印`watermark`;防文字`text`.
- 不要加能显著改变画面风格的词,例如`photo`,`3d`,`realistic`等等,除非用户明确要求

---
## 3. 风格

`stylePrompt` 照常生效(与正面提示词合并后发送).

---

## 4. 成本

Opus 档、1216×832、28 步:**0 Anlas**
超免费区间或非 Opus 档另算.

---

## 5. 快速模板

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
    "positivePrompt": "ultra complexity, high complexity, best quality, amazing quality, masterpiece, top aesthetic, highres, absurdres, highly detailed\n1girl, solo, ...\n<头发/面部>\n<身体特征>\n<服饰>\n<姿势>\n<背景>\n<镜头>\n-2::<仅增量负面>::",
    "negativePrompt": "",
    "stylePrompt": "artist:xxx, artist:yyy, year 2025, year 2026"
  },
  "charCaptions": [],
  "count": 1,
  "maxAnlas": 120
}
```