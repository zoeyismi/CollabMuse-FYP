# CollabMuse Dissertation Outline

## Proposed title

**Design and Evaluation of an Event-Synchronised Web Platform with AI-Assisted Tools for Collaborative Music Creation**

## Central argument

CollabMuse investigates whether synchronising meaningful editing actions, rather than continuously streaming raw audio, can provide a practical and understandable collaboration model for early-stage online music creation. The system combines persistent project rooms, shared audio-editing state, room-scoped communication and an AI composition copilot in one web workflow.

## Research questions

1. How can event-based synchronisation support collaborative music editing in a browser?
2. How effectively can a shared room interface communicate collaborators' actions and current project state?
3. How useful and controllable is an AI composition assistant when it produces playable musical suggestions inside the collaboration workflow?
4. What usability, latency and trust issues emerge when users evaluate the prototype?

## Suggested chapter structure

### 1. Introduction

- Context: remote music collaboration and fragmented creative tools.
- Problem: file sharing, communication and arrangement state are often separated.
- Aim, objectives, research questions and project scope.
- Contributions and dissertation structure.

### 2. Literature review

- Computer-supported cooperative work and awareness in shared workspaces.
- Real-time web applications, event-based synchronisation and consistency.
- Browser audio systems, waveform visualisation and Web Audio API.
- Generative AI and human-AI co-creation in music.
- Comparison with existing DAWs, cloud music platforms and AI music tools.
- Research gap: lightweight event synchronisation plus transparent AI assistance in one room-based workflow.

### 3. Requirements and methodology

- Target users and representative collaboration scenarios.
- Functional and non-functional requirements.
- Iterative prototyping and user-centred design method.
- Ethical considerations: uploaded audio, account data, AI attribution and copyright.
- Evaluation plan and success criteria.

### 4. System design

- Architecture: Next.js client, Node server, Socket.io and JSON persistence.
- Data model: users, sessions, rooms, events, notes, tracks, timeline regions and compositions.
- Authentication and room ownership.
- Event flow and cross-window synchronisation sequence diagram.
- Audio upload, playback and waveform extraction pipeline.
- AI copilot pipeline, structured output, local fallback and playable note synthesis.
- UI rationale and responsive interaction design.

### 5. Implementation

- Landing, authentication and dashboard flow.
- Dynamic room creation and shareable URLs.
- Real-time presence, events, notes and editing-state updates.
- Persistent audio, room history and project state.
- AI melody generation and Web Audio playback.
- Important implementation decisions and limitations.

### 6. Testing and evaluation

- Unit/API tests for authentication, rooms and persistence.
- Integration tests using two browser windows.
- Task-based usability test with approximately 5-8 participants if permitted.
- Suggested tasks: register, create/join a room, upload audio, move a region, add a note, generate and play an AI idea.
- Metrics: task completion, errors, perceived usability, collaboration awareness, AI usefulness/control and qualitative feedback.
- Technical measurements: event delivery latency and state recovery after refresh.

### 7. Results and discussion

- Present quantitative results and thematic findings separately.
- Relate findings back to each research question.
- Compare results with literature and competing tools.
- Discuss AI usefulness without claiming autonomous creativity.
- Identify threats to validity and prototype limitations.

### 8. Conclusion and future work

- Summarise findings and contributions.
- Answer the research questions directly.
- Future work: database deployment, role permissions, audio transport, version history, richer arrangement tools and evaluated AI models.

## Evidence to collect from now on

- Architecture and event-sequence diagrams.
- Screenshots of each completed workflow.
- Git commit history and implementation milestones.
- Two-window Socket.io test records.
- API and build test results.
- User-test script, consent material and anonymised results.
- A feature comparison table against selected existing platforms.
- Design iterations showing why interface decisions changed.

## Claims to avoid

- Do not describe the prototype as a full DAW.
- Do not claim low-latency live audio streaming; the contribution is synchronised actions and shared state.
- Do not call local deterministic generation “AI”. Clearly distinguish OpenAI output from the offline fallback.
- Do not claim improved collaboration until user evaluation provides evidence.
