# CollabMuse 第四章初稿与网站对照

版本日期：2026 年 9 月 28 日。目标：供 10 月 15 日初稿前讨论修改。

这份文件先写第四章 Development and Implementation。英文段落是报告正文候选内容；每节末的中文引用块是给作者看的网站对照，正式提交时删除。章节名称和编号暂沿用此前报告方向，收到 final report 模板后再调整。图号位置是待补图提示，不代表图片已经完成。

本稿依据当前源代码核对，未在本轮执行浏览器测试，也不包含虚构的用户评价、延迟数据或功能测试结果。正文重点描述自己的实现，因此本轮未新增未经核实的外部文献。

## 章节与页面速查

| 章节 | 网站对应部分 | 本节要解释的问题 |
| --- | --- | --- |
| 4.1 Overview | 整体流程 | 系统实现了什么，范围是什么 |
| 4.2 Application Structure | 前端页面、后端与存储 | 各部分如何连接 |
| 4.3 Accounts and Room State | Auth、Dashboard、Share room | 如何进入并保存一个共享项目 |
| 4.4 Synchronisation | 多窗口编辑、Events、连接状态 | 一个修改如何传到其他窗口 |
| 4.5 Audio and Arrangement | 播放栏、轨道、时间线、Clips | 文件如何变成可管理和试听的素材 |
| 4.6 Notes and Activity | Notes、Events | 如何表达反馈并理解修改 |
| 4.7 Undo and Versions | Undo、Redo、History | 如何回到之前的状态 |
| 4.8 Melody Suggestions | Copilot | 如何生成、试听和修改旋律建议 |
| 4.9 Interface Integration | 编辑器整体布局 | 如何把上述操作放在同一工作区 |
| 4.10 Summary | 下一章评估的入口 | 做到了什么，接下来验证什么 |

## Chapter 4 Development and Implementation


### 4.1 Overview

This chapter describes the implementation of CollabMuse, a browser-based platform for collaborative music creation. The implementation brings room management, shared arrangement state, audio-clip storage, contextual notes and melody suggestions into a common workspace. Its main collaboration mechanism distributes editing updates between clients connected to the same room. Audio files are uploaded and retrieved separately from these updates.

The following sections explain the application structure and the development of its principal modules. They also distinguish implemented mechanisms from properties that require evaluation, particularly concurrent editing, state recovery and the usefulness of generated musical suggestions.

> **中文对照｜对应网站：整个网站的工作流程**
>
> **你可以这样对照：** 从首页进入 Dashboard，创建或进入 Room，再上传、编辑、批注和试听。
>
> **写作说明与证据：** 本节交代第四章范围，不逐个介绍按钮。

### 4.2 Application Structure

The application uses Next.js and React for its web interface, with TypeScript used in the client components. A custom Node.js server handles backend routes and hosts Socket.IO connections. The interface is organised around a landing page, authentication, a project dashboard and room workspaces. Dynamic room routes allow the workspace component to load a room using its identifier.

HTTP endpoints handle operations such as authentication, audio transfer and version storage. Socket.IO distributes room updates and presence information. This division allows an editing update to carry project data without repeatedly transferring the underlying audio file. However, some updates contain complete collections, including the timeline-region array, rather than minimal editing operations. Consequently, event-based communication alone does not establish efficient scaling or conflict-free editing.

[Figure 4.1: Architecture showing browser clients, HTTP and Socket.IO connections, the Node.js server, JSON stores and audio files.]

> **中文对照｜对应网站：网站背后的前后端结构**
>
> **你可以这样对照：** 页面来自 app；编辑器由 components 组成；server.mjs 处理 HTTP、Socket.IO 和存储。
>
> **写作说明与证据：** 这一节适合架构图，而不是页面截图。代码定位：package.json、server.mjs、app/room/[roomId]/page.tsx。

### 4.3 Accounts and Room State

The server implements registration, login, logout and session lookup. Passwords are processed using scrypt with a salt, and session identifiers are stored in an HTTP-only cookie. Account and session information is persisted separately from room data. These mechanisms provide an account workflow. However, the current room-list and room-join paths do not require an authenticated session. Accounts therefore do not yet constitute a complete private-room permission system.

A room groups the state needed by the collaboration workspace, including tracks, timeline regions, notes, activity events, audio-clip metadata and a generated composition. Room and account records are stored in local JSON files, while uploaded audio is stored in the filesystem. This provides a straightforward persistence mechanism for the prototype. The file-based implementation does not provide database transactions, and overlapping read-modify-write operations require particular attention during testing.



The dashboard retrieves the stored room list and provides search by room title, identifier or uploaded filename. Creating a room sends its identifier and title to the server before navigating to the dynamic room URL. The room header allows that URL to be copied for sharing. This makes the room identifier the common reference used by routing, backend requests and socket messages.

The client interface also offers room deletion with a confirmation dialogue. Deletion and sharing introduce different requirements: deletion must handle associated data, while sharing must eventually be reconciled with a defined access policy. The prototype’s open room workflow should therefore be distinguished from invitation-only collaboration.

> **中文对照｜对应网站：登录注册页和 Dashboard 房间列表**
>
> **你可以这样对照：** /auth 的 Create account / Log in；/dashboard 的 Create new room、Search rooms、Saved rooms；房间顶部 Share room。
>
> **写作说明与证据：** 对应 AuthWorkspace.tsx、app/dashboard/page.tsx、server.mjs。账户存在不代表房间已有完整权限保护，不能写成私密邀请系统。截图建议：注册页、创建房间后出现的真实列表。

### 4.4 Synchronisation of Editing State

When a client connects, it emits a room-join message. The server joins the socket to the requested room and returns a snapshot containing the stored workspace state. Subsequent messages distinguish different categories of update, including timeline changes, tracks, notes, clips and compositions. Room presence is calculated from connected sockets; the resulting count should therefore be interpreted as connections rather than a count of distinct people.

For a timeline edit, the client updates its local region state and records an activity event. If the socket is connected, it sends the region collection and event to the server. The server stores the new timeline state and forwards the update to other clients in the room. Receiving clients replace their local timeline state with the received collection. An HTTP PATCH path is also present when the socket is unavailable.

This implementation supports a direct workflow for sharing arrangement changes, but it does not implement operational transformation or a conflict-free replicated data type. Two clients can submit collections based on different earlier states, so one update may overwrite another. The HTTP fallback also needs evaluation for error reporting and propagation to other connected clients. These limitations define specific test cases rather than evidence of guaranteed consistency.

[Figure 4.2: Sequence diagram of a timeline edit from client A through the server to client B, including persistence.]

> **中文对照｜对应网站：两个浏览器打开同一 Room 后的编辑更新**
>
> **你可以这样对照：** 移动时间线片段，再查看另一窗口的片段位置和右侧 Events。连接成功时客户端请求 room:snapshot；编辑时发送 room:timeline。
>
> **写作说明与证据：** 对应 DemoRoomWorkspace.tsx 的 publishTimelineChange 和 server.mjs 的 room:join / room:timeline。拖动结束时提交更新，不是每一个鼠标位置都广播。建议配时序图及双窗口测试，尚未声称测试通过。

### 4.5 Audio Clips and Arrangement Controls

The audio workflow includes file upload, server-side storage, clip metadata and browser retrieval. Client-side audio decoding supports waveform extraction and basic signal analysis. The analysis calculates duration, RMS-derived level and heuristic energy and dynamics categories. A periodicity-based calculation estimates tempo. These values can supply context for melody generation, but their musical accuracy has not yet been established through evaluation.

The arrangement interface supports movement and resizing of timeline regions, while track controls maintain properties such as volume, mute and solo. Region placement is represented using relative positions and widths in the interface. The playback controller maps a clip region’s relative starting position to a time within the calculated timeline duration. It uses HTML audio elements for uploaded clips and JavaScript timers for delayed starts. Track mute, solo and volume are consulted when scheduling clip playback. This provides a basic arrangement playback mechanism, whose timing accuracy still requires measurement.

Region width is not currently used to limit the duration of the corresponding audio playback. Resizing therefore modifies shared visual arrangement data but does not implement complete audio trimming or time stretching. Similarly, the Bar and Beat snapping options use a fixed proportional grid; the current grid is not recalculated from the playback tempo. These distinctions define the present scope of the editor.

[Figure 4.3: Annotated workspace with the timeline, tracks, clip library and contextual notes.]

> **中文对照｜对应网站：顶部播放栏、左侧轨道、中间时间线和底部 Clips**
>
> **你可以这样对照：** 顶部 Upload audio 是房间音频路径；底部 Clips 是多片段素材库路径。轨道有音量、Mute、Solo；时间线有移动、拉伸和吸附。
>
> **写作说明与证据：** 对应 ControlPanel.tsx、TrackList.tsx、WorkstationTimeline.tsx、ClipLibrary.tsx、DemoRoomWorkspace.tsx。当前拉伸不等于裁剪真实音频；同一波形数据还会被复用于多个视觉片段，不能声称每个片段都是独立精确波形。

### 4.6 Notes and Activity Awareness

Room notes and activity events provide context for shared changes. Notes can reference a position in the workspace, and selecting a note updates the visual playhead position. This callback does not seek the audio playback controller, so note navigation currently acts as a visual reference. Activity entries describe actions such as timeline changes and version restoration. Together, these mechanisms are intended to help collaborators understand what changed and where feedback applies. Whether participants can interpret this information effectively remains an evaluation question.

> **中文对照｜对应网站：右侧 Notes 和 Events 标签页**
>
> **你可以这样对照：** Notes 输入文字并选择百分比位置；Events 显示编辑记录。点击批注移动视觉播放线。
>
> **写作说明与证据：** 对应 WorkstationInspector.tsx 和 DemoRoomWorkspace.tsx。这里应写位置关联批注，不夸大为完整聊天系统，也不写成点击批注就跳转音频播放。

### 4.7 Undo and Version Snapshots

Timeline undo and redo use client-side history stacks. Applying a previous layout publishes it as a new timeline update, so undo can affect the shared workspace. This is different from selectively reversing only one contributor's changes and should be tested with overlapping edits from multiple clients.

The server also supports named version snapshots containing tracks, timeline regions, composition data and clip metadata, retaining up to twenty versions per room. Restoration replaces these parts of the current room state. The snapshots reference audio assets rather than preserving independent copies of the audio files. Consequently, the report should describe this as project-state restoration and examine what happens when a referenced clip has subsequently been deleted.

> **中文对照｜对应网站：顶部 Undo / Redo 和右侧 History**
>
> **你可以这样对照：** Undo / Redo 操作时间线历史；History 输入版本名后 Save，再通过 Restore 恢复。
>
> **写作说明与证据：** 对应 DemoRoomWorkspace.tsx、WorkstationInspector.tsx 和 server.mjs 的 versions 路由。保存的是状态快照，不是所有音频文件的独立备份；删除原文件后的恢复需要单独测试。

### 4.8 Melody Suggestions

The composition module accepts a creative prompt and parameters such as key, mood, style and length. When the external service is configured, the server requests structured composition data containing note pitches, beat durations and velocities. The client uses Web Audio oscillators and gain envelopes to audition the resulting melody. The panel also provides note-editing operations and can add a track record linked to the generated composition. Melody audition is implemented within the Copilot panel; adding the track record does not connect those notes to the main uploaded-audio playback scheduler.

When no API key is configured, the server uses a local deterministic generator. A service failure also invokes a local fallback. This generator uses scale intervals and seeded note selection; it is not a trained generative model. The implementation records the provider as either local or OpenAI, enabling evaluation records to identify which mechanism produced a suggestion. The existence of the integration does not establish that an external model was used successfully in a particular test.

[Figure 4.4: Prompt and parameters, server generation branch, structured notes, audition and workspace insertion.]

> **中文对照｜对应网站：右侧 Copilot 及 Clips 关联输入**
>
> **你可以这样对照：** 输入旋律描述、调性、风格等，生成后试听和编辑音符；可把素材分析作为上下文，也可添加关联轨道。
>
> **写作说明与证据：** 对应 MusicAgentPanel.tsx、server.mjs 的 generateAiComposition / generateLocalComposition。正文区分外部模型与本地规则生成；面板试听与主时间线播放目前是不同路径。

### 4.9 Interface Integration

The room interface places track controls on the left, the arrangement timeline in the centre and contextual tools on the right. The right-hand inspector switches between Notes, Events, History and Copilot, while the clip library expands below the workspace. This organisation keeps editing and feedback accessible within the same page and limits the need to navigate away from the current project. The layout uses responsive grid rules to allocate space to these areas at different viewport widths.

The header presents the room title, a connected-socket count, undo and redo controls, and a share action that copies the current room URL. Status messages describe operations such as saving and broadcasting. These messages communicate application activity, but they are not equivalent to server acknowledgements or measured delivery guarantees. The avatar initials shown in the header are currently fixed examples and should not be presented as verified collaborator identities.

The landing page introduces the product, and the dashboard provides entry to stored rooms. Within the dashboard, the room library is loaded from the backend, whereas decorative project presentation should be distinguished from persisted room records. Evaluation should focus on whether users can find and complete the intended workflow, rather than treating visual polish as evidence of usability.

[Figure 4.5: Room workspace annotated with track controls, timeline, inspector tabs, transport controls and clip library.]

> **中文对照｜对应网站：编辑器整体布局和导航**
>
> **你可以这样对照：** 左轨道、中时间线、右侧四个标签，底部折叠 Clips；顶部房间名、分享、在线连接数。
>
> **写作说明与证据：** 对应 DemoRoomWorkspace.tsx 和 app/globals.css。头像字母是固定示例，online 计数是 socket 连接数，不能写成真实成员名单或独立用户数。

### 4.10 Summary

The implementation combines room-based editing updates with persistent project data, stored audio assets and contextual collaboration tools. Its main technical decisions make the prototype suitable for examining a shared browser workflow while leaving identifiable limitations in concurrent updates, storage reliability and audio behaviour. The evaluation chapter will investigate these properties through recorded functional and multi-client tests, with usability findings reported only where participant data has actually been collected.

> **中文对照｜对应网站：整章总结，为第五章测试作铺垫**
>
> **你可以这样对照：** 总结做出了哪些机制，下一章再验证同步、播放、恢复和使用体验。
>
> **写作说明与证据：** 这里不提前写“明显提升效率”或“用户满意”，等有真实结果再下结论。


## 给作者的阅读建议

第一次阅读先看 4.3、4.5、4.6、4.7、4.8，这几节最容易和网站按钮对应。再读 4.2 和 4.4，理解架构与同步流程。你不需要照背代码，但需要能解释为什么使用房间、为什么音频上传和编辑消息分开、为什么两个用户同时编辑仍可能冲突。

下一轮应优先补五类证据：真实房间操作截图；双窗口编辑记录；上传音频与播放结果；版本保存和恢复结果；标明 provider 的旋律生成记录。测试前只记录预期，测试后再填实际结果和问题。

目前最影响正文措辞的实现边界是：房间权限尚不完整；时间线宽度未控制真实音频裁剪；批注定位只更新视觉播放线；添加 AI 轨道不等于主播放栏会播放该旋律；本地生成不能当作外部 AI 调用。这些是对当前代码的说明，本轮没有修改网站实现。
