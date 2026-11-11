# 可以直接用的开源项目（对照 Audiotool / Soundtrap）

整理日期：2026-11-11。许可证和最近更新时间来自 GitHub / npm，用之前再核对一次。

## 结论

- **不要整套搬一个开源 DAW 进来。** 最像 Audiotool 的开源项目 openDAW（Audiotool 创始人 André Michelle 写的）和 GridSound 都是 **AGPL-3.0**：部署到网上就要把整个项目源码按 AGPL 公开，而且把别人的 DAW 换上去，毕设里“自己做了什么”就说不清了。它们适合**看代码学做法**，不适合直接拿来用。
- **用库来补“作曲”这一块。** 现在缺的是：音符级别的声部、和弦、钢琴卷帘、能跟着和弦走的生成。下面这些都是 MIT / Apache / BSD，可以直接装进项目，在论文里写明用了哪些库即可。
- 云端的 `composition-features` 分支到了以后先看它用了什么，再决定加哪些，避免重复。

## 两个参考网站有什么，CollabMuse 缺什么

| 功能 | Audiotool | Soundtrap | CollabMuse 现在 | 可以用的开源 |
|---|---|---|---|---|
| 多人实时编辑同一项目 | 有 | 有（含视频和聊天） | 有（Socket.IO） | 已有，不用换 |
| 钢琴卷帘 / MIDI 编辑 | 有 | 有 | **没有** | Tone.js + 自己写；参考 Signal |
| 合成器、采样乐器 | 有 | 有 | **没有**（只有音频片段） | Tone.js、smplr |
| 鼓机 / 步进音序器 | 有 | 有（Beatmaker） | **没有** | Tone.js |
| 和弦、调式 | 有 | 有 | **没有** | Tonal |
| Loop 素材库 | 有 | 有（免版税） | 没有 | 需要有授权的素材（例如 Freesound 上 CC0 的） |
| 录音 | 有 | 有 | 有 | 已有 |
| 哼唱/录音转成音符 | — | — | 没有 | Basic Pitch |
| AI 续写旋律 / 变奏 | — | — | 只有整段音频生成 | Magenta.js |
| 评论 | — | 有 | 有 | 已有 |
| Fork / Remix 并链接原作 | 有 | — | 只有“复制房间” | 自己加：复制时记录来源房间 |
| MIDI 导出 | 有 | 有 | 没有（只有 WAV） | @tonejs/midi |

## 推荐的库

### 作曲核心（最优先）

| 库 | 用途 | 许可证 | 状态 |
|---|---|---|---|
| [Tone.js](https://github.com/Tonejs/Tone.js) | 播放音符声部、合成器、节拍器、按小节对齐的走带 | MIT | 很活跃，约 1.5 万星 |
| [Tonal](https://github.com/tonaljs/tonal) | 和弦、音阶、调式运算：和弦轨、“贝斯跟着和弦走”、检查音符是否在调内 | MIT | 活跃 |
| [smplr](https://www.npmjs.com/package/smplr) | 真实采样的钢琴、鼓组、管弦乐器，给音符声部发声 | MIT | 活跃 |
| [@tonejs/midi](https://github.com/Tonejs/Midi) | 读写 MIDI 文件：导出 MIDI、导入别人的 MIDI | MIT | 稳定，最近没有更新 |

这四个就能把系统最小单位从“音频片段”变成“可编辑的音符”，这正是她说的 composition tool 缺的那一层。

### 钢琴卷帘

- [Signal](https://github.com/ryohey/signal)（MIT，活跃）：完整的网页 MIDI 编辑器。**整套太大，不要嵌入**，但钢琴卷帘的交互（拖动、拉长、吸附、多选）可以照着它的代码学。
- [webaudio-pianoroll](https://github.com/g200kg/webaudio-pianoroll)（Apache-2.0）：现成的 Web Component，最快能放进页面，但项目小、2024 年后没更新，样式也要改。
- 建议：自己用 React 写一个简单的钢琴卷帘（画布上画格子和音符块），数据用 Tonal 校验，用 Tone.js 播放。这部分也是论文里最能体现“自己做的”地方。

### 让生成更像“作曲”

| 库 | 用途 | 许可证 | 注意 |
|---|---|---|---|
| [Magenta.js](https://github.com/magenta/magenta-js) | 在浏览器里续写旋律（MusicRNN，可以按和弦走）、生成变奏（MusicVAE） | Apache-2.0 | npm 包 2022 年后没发新版，依赖 TensorFlow.js，比较重，但还能用 |
| [Basic Pitch](https://github.com/spotify/basic-pitch-ts) | 把录音或哼唱转成 MIDI 音符，直接变成可编辑的声部 | Apache-2.0 | Spotify 出品，2023 年后少更新 |

搭配方式：ElevenLabs / 本地编曲器继续负责“整段音频”，Magenta 负责“在这几小节续写 / 来个变奏 / 按和弦配旋律”，产出的都是音符，能在钢琴卷帘里改。这样“AI 生成”就从一次性的音频，变成可以和人一起编辑的音符。

### 协作与波形（可选）

- [Yjs](https://github.com/yjs/yjs) + y-websocket（MIT）：专门做多人同时编辑的 CRDT 库，自带光标和撤销。现在的 Socket.IO 同步能用，**不建议整体替换**；如果钢琴卷帘要支持很多人同时拖音符，可以只给音符数据用 Yjs。
- [wavesurfer.js](https://github.com/katspaugh/wavesurfer.js)（BSD-3）：波形显示和区域选择，可替换现在自己画的波形。
- [waveform-playlist](https://github.com/naomiaro/waveform-playlist)（MIT）：多轨音频编辑器，可参考它的剪切、淡入淡出。

## 只参考、不要直接用

| 项目 | 原因 |
|---|---|
| [openDAW](https://github.com/andremichelle/openDAW) | AGPL-3.0（有商业授权）；整套 DAW，换上去等于换掉她的项目 |
| [GridSound](https://github.com/gridsound/daw) | AGPL-3.0；同上 |
| Strudel 等 live-coding 工具 | AGPL，而且方向不同 |
| MusicGen（Meta audiocraft） | 模型权重是 CC-BY-NC，非商业；要 GPU 服务器，不适合放进网页 |

## 建议顺序

1. 等 `composition-features` 分支到了，看它已经做了段落、和弦轨、音符声部里的哪些。
2. 加 Tone.js + Tonal + smplr：音符声部能发声、和弦轨能驱动贝斯和键盘。
3. 自己写钢琴卷帘（参考 Signal），Copilot 草稿用橙色虚线，保留后变蓝。
4. 加 @tonejs/midi 导出 MIDI。
5. 有余力再加 Magenta 续写/变奏和 Basic Pitch 哼唱转音符。

论文里要列出用到的开源库和许可证；直接参考别人代码的地方要注明出处。
