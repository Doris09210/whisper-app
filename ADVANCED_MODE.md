# Whisper 高级模式部署说明

高级模式用于把消息转换成你的克隆声音。安全原则是：ElevenLabs API Key 只放在 Cloudflare Worker 环境变量里，不能写进 `index.html`，也不要提交到 GitHub。

## 1. 先处理旧 Key

如果旧 Key 曾经出现在前端代码或 GitHub Pages 中，请在 ElevenLabs 后台撤销它，然后重新创建一个新的 API Key。

建议权限：

- Text to Speech：必须
- Voices Read：建议
- User / Subscription Read：用于网页显示剩余额度
- Voice Clone：只在创建克隆声音时临时开启，用完后换成更小权限的 Key

## 2. 创建你的声音

在 ElevenLabs 创建 Instant Voice Clone 或 Professional Voice Clone，得到 `voice_id`。

## 3. 部署 Cloudflare Worker

1. Cloudflare Dashboard 里创建一个 Worker。
2. 把本目录的 `worker.js` 粘贴进去并部署。
3. 在 Worker 的 Variables / Secrets 里添加：

```text
ELEVENLABS_API_KEY=你的新 ElevenLabs API Key
ELEVENLABS_VOICE_ID=你的 voice_id
ALLOWED_ORIGIN=https://doris09210.github.io
```

可选：

```text
ELEVENLABS_MODEL=eleven_flash_v2_5
```

默认模型使用 `eleven_flash_v2_5`，优先省额度和降低延迟。

## 4. 在 Whisper 页面启用

1. 打开 Whisper。
2. 进入房间。
3. 打开右上角设置。
4. 模式选择“我的声音”。
5. 在“接口”里填入 Worker 地址，例如：

```text
https://your-worker-name.your-account.workers.dev
```

6. 点“额度”查看剩余额度，点“测试”听效果。

## 额度保护

Worker 默认限制单条消息最多 240 个字符。高级模式失败或额度不足时，前端会自动回退到普通系统朗读。

为了更省额度，建议日常默认用“普通朗读”，只有想用克隆声音时再切到“我的声音”。
