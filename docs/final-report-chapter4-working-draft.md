# CollabMuse final report working draft

Prepared on 28 September 2026 for discussion before the 15 October first-draft deadline.

Status: provisional chapter numbering, pending the final report template. The English text below is based on source inspection, not a completed runtime evaluation. Figure placeholders and evaluation tasks must be completed before submission. Earlier report references have not yet been independently verified.

## 写作方向

建议延续 progress report 的主线：基于事件同步的浏览器音乐协作平台。AI 旋律建议作为扩展模块。先写第四章，再以实际实现反推设计、需求和引言，但保留 proposal 中的原始目标，解释开发过程中发生的范围变化。

每个模块按“需求—实现—设计取舍—证据—限制”展开，避免只描述按钮和页面。

## Chapter 4 Development and Implementation

### 4.1 Overview

This chapter describes the implementation of CollabMuse, a browser-based platform for collaborative music creation. The implementation brings room management, shared arrangement state, audio-clip storage, contextual notes and melody suggestions into a common workspace. Its main collaboration mechanism distributes editing updates between clients connected to the same room. Audio files are uploaded and retrieved separately from these updates.

The following sections explain the application structure and the development of its principal modules. They also distinguish implemented mechanisms from properties that require evaluation, particularly concurrent editing, state recovery and the usefulness of generated musical suggestions.

### 4.2 Application Structure

The application uses Next.js and React for its web interface, with TypeScript used in the client components. A custom Node.js server handles backend routes and hosts Socket.IO connections. The interface is organised around a landing page, authentication, a project dashboard and room workspaces. Dynamic room routes allow the workspace component to load a room using its identifier.

HTTP endpoints handle operations such as authentication, audio transfer and version storage. Socket.IO distributes room updates and presence information. This division allows an editing update to carry project data without repeatedly transferring the underlying audio file. However, some updates contain complete collections, including the timeline-region array, rather than minimal editing operations. Consequently, event-based communication alone does not establish efficient scaling or conflict-free editing.

[Figure 4.1: Architecture showing browser clients, HTTP and Socket.IO connections, the Node.js server, JSON stores and audio files.]

### 4.3 Accounts and Room State

The server implements registration, login, logout and session lookup. Passwords are processed using scrypt with a salt, and session identifiers are stored in an HTTP-only cookie. Account and session information is persisted separately from room data. These mechanisms provide an account workflow, although the existence of login functionality does not demonstrate that every room endpoint and socket operation enforces appropriate authorisation.

A room groups the state needed by the collaboration workspace, including tracks, timeline regions, notes, activity events, audio-clip metadata and a generated composition. Room and account records are stored in local JSON files, while uploaded audio is stored in the filesystem. This provides a straightforward persistence mechanism for the prototype. The file-based implementation does not provide database transactions, and overlapping read-modify-write operations require particular attention during testing.

### 4.4 Synchronisation of Editing State

When a client connects, it emits a room-join message. The server joins the socket to the requested room and returns a snapshot containing the stored workspace state. Subsequent messages distinguish different categories of update, including timeline changes, tracks, notes, clips and compositions. Room presence is calculated from connected sockets; the resulting count should therefore be interpreted as connections rather than a count of distinct people.

For a timeline edit, the client updates its local region state and records an activity event. If the socket is connected, it sends the region collection and event to the server. The server stores the new timeline state and forwards the update to other clients in the room. Receiving clients replace their local timeline state with the received collection. An HTTP PATCH path is also present when the socket is unavailable.

This implementation supports a direct workflow for sharing arrangement changes, but it does not implement operational transformation or a conflict-free replicated data type. Two clients can submit collections based on different earlier states, so one update may overwrite another. The HTTP fallback also needs evaluation for error reporting and propagation to other connected clients. These limitations define specific test cases rather than evidence of guaranteed consistency.

[Figure 4.2: Sequence diagram of a timeline edit from client A through the server to client B, including persistence.]

### 4.5 Audio Clips and Arrangement Controls

The audio workflow includes file upload, server-side storage, clip metadata and browser retrieval. Client-side audio decoding supports waveform extraction and basic signal analysis. The analysis calculates duration, RMS-derived level and heuristic energy and dynamics categories. A periodicity-based calculation estimates tempo. These values can supply context for melody generation, but their musical accuracy has not yet been established through evaluation.

The arrangement interface supports movement and resizing of timeline regions, while track controls maintain properties such as volume, mute and solo. Region placement is represented using relative positions and widths in the interface. The report should explain this representation alongside the playback mapping, using a verified example to demonstrate how a visible region corresponds to an audible result. Visual editing controls alone are insufficient evidence of accurate audio scheduling.

[Figure 4.3: Annotated workspace with the timeline, tracks, clip library and contextual notes.]

### 4.6 Notes and Activity Awareness

Room notes and activity events provide context for shared changes. Notes can reference a position in the workspace, and selecting a note updates the playhead position. Activity entries describe actions such as timeline changes and version restoration. Together, these mechanisms are intended to help collaborators understand what changed and where feedback applies. Whether participants can interpret this information effectively remains an evaluation question.

### 4.7 Undo and Version Snapshots

Timeline undo and redo use client-side history stacks. Applying a previous layout publishes it as a new timeline update, so undo can affect the shared workspace. This is different from selectively reversing only one contributor's changes and should be tested with overlapping edits from multiple clients.

The server also supports named version snapshots containing tracks, timeline regions, composition data and clip metadata, retaining up to twenty versions per room. Restoration replaces these parts of the current room state. The snapshots reference audio assets rather than preserving independent copies of the audio files. Consequently, the report should describe this as project-state restoration and examine what happens when a referenced clip has subsequently been deleted.

### 4.8 Melody Suggestions

The composition module accepts a creative prompt and parameters such as key, mood, style and length. When the external service is configured, the server requests structured composition data containing note pitches, beat durations and velocities. The client uses Web Audio oscillators and gain envelopes to audition the resulting melody. Generated ideas can also be added to the workspace.

When no API key is configured, the server uses a local deterministic generator. A service failure also invokes a local fallback. This generator uses scale intervals and seeded note selection; it is not a trained generative model. The implementation records the provider as either local or OpenAI, enabling evaluation records to identify which mechanism produced a suggestion. The existence of the integration does not establish that an external model was used successfully in a particular test.

[Figure 4.4: Prompt and parameters, server generation branch, structured notes, audition and workspace insertion.]

### 4.9 Summary

The implementation combines room-based editing updates with persistent project data, stored audio assets and contextual collaboration tools. Its main technical decisions make the prototype suitable for examining a shared browser workflow while leaving identifiable limitations in concurrent updates, storage reliability and audio behaviour. The evaluation chapter will investigate these properties through recorded functional and multi-client tests, with usability findings reported only where participant data has actually been collected.

## Evidence and next drafting steps

| Section | Source to inspect further | Evidence still required |
| --- | --- | --- |
| Application structure | package.json, server.mjs, app routes | Architecture diagram and tested startup configuration |
| Accounts and rooms | server.mjs, AuthWorkspace.tsx, dashboard | Account and room workflow screenshots; access checks |
| Synchronisation | server.mjs, DemoRoomWorkspace.tsx | Two-client edits, conflicting edits, disconnect and refresh records |
| Audio and arrangement | ControlPanel.tsx, WorkstationTimeline.tsx | Audible playback checks; region timing; mute, solo and volume checks |
| Notes and awareness | WorkstationInspector.tsx | Positional note and received activity examples |
| Recovery | Version routes and timeline history | Restore after edits and after asset deletion |
| Melody suggestions | MusicAgentPanel.tsx, generation functions | Provider-specific generation and playback records |

Suggested schedule: 28–30 September confirm template and scope; 1–4 October develop Chapter 4 with figures; 5–8 October record technical tests and draft evaluation; 9–11 October align requirements, design and verified literature; 12–13 October revise introduction and conclusion and write abstract; 14 October check numbering, citations and formatting; 15 October deliver the first draft. Participant testing depends on applicable course ethics requirements and available recruitment time; no participant results should be presumed.
