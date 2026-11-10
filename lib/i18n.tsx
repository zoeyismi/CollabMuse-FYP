"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export const languages = [
  ["en", "English"],
  ["zh", "中文"],
  ["es", "Español"],
  ["fr", "Français"],
  ["de", "Deutsch"],
  ["ja", "日本語"],
  ["ko", "한국어"],
  ["pt", "Português"],
] as const;

export type Language = (typeof languages)[number][0];

const en = {
  "language.label": "Language",
  "brand.subtitle": "Event-based music rooms",
  "nav.features": "Features",
  "nav.workflow": "Workflow",
  "nav.dashboard": "Dashboard",
  "nav.login": "Log in",
  "nav.logout": "Log out",
  "nav.workspace": "Open workspace",
  "nav.start": "Start creating",
  "hero.eyebrow": "Event-based music rooms",
  "hero.title": "make your music",
  "hero.description": "Create shared rooms, arrange clips, and keep every creative action synchronized without raw live audio streaming.",
  "hero.dashboard": "Open dashboard",
  "hero.demo": "Enter demo room",
  "room.demoSampleNotice": "Demo room: example regions are visual placeholders, not audio. Upload or generate a clip to hear music.",
  "room.demoPlayableNotice": "Demo room: some example regions are placeholders. Your uploaded or generated audio is ready to play.",
  "music.title": "Music Generator",
  "music.heading": "Generate a complete music track",
  "music.builtinDescription": "Built-in rule-based arranger: creates instrumental audio from selected settings, not an AI music model.",
  "music.externalDescription": "ElevenLabs Music uses an external AI service and requires a configured, paid API account.",
  "music.promptHelp": "Recognizes piano, no drums and BPM in the prompt; use the controls below for style, mood and key.",
  "music.describe": "Describe the music",
  "music.placeholder": "Genre, instruments, tempo, structure, atmosphere...",
  "music.generate": "Generate music",
  "music.generating": "Arranging and rendering audio...",
  "music.settings": "Tune style, key and length",
  "music.engine": "Engine",
  "music.builtin": "Built-in arranger - rule-based",
  "music.paid": "ElevenLabs Studio - paid API",
  "music.style": "Style",
  "music.mood": "Mood",
  "music.key": "Key",
  "music.length": "Length",
  "music.instrumental": "Instrumental only",
  "music.instrumentalBuiltin": "Instrumental only (built-in arranger)",
  "music.preview": "Preview generated track",
  "music.add": "Add generated music to workstation",
  "music.adding": "Adding...",
  "music.added": "Added to workstation",
  "inspector.notes": "Notes",
  "inspector.events": "Events",
  "inspector.versions": "History",
  "inspector.copilot": "Copilot",
  "inspector.open": "Open",
  "inspector.resolved": "Resolved",
  "inspector.all": "All",
  "inspector.emptyOpen": "All feedback is resolved.",
  "inspector.emptyOther": "No notes in this view.",
  "inspector.notePlaceholder": "Add a note...",
  "inspector.viewOnly": "View-only access",
  "inspector.savingNote": "Saving note",
  "inspector.sendNote": "Send note",
  "features.kicker": "Core collaboration",
  "features.title1": "One room for every take,",
  "features.title2": "note and decision.",
  "features.summary": "Upload clips, shape the arrangement and leave feedback exactly where it belongs. Everyone sees the same session, from first idea to final mix.",
  "features.action": "Open a room",
  "features.roomStatus": "Room 01 · Sunset demo",
  "features.roomImage": "A young musician holding a vinyl record",
  "features.clipsImage": "A musician playing a keyboard",
  "features.eventsImage": "A close-up of a record player",
  "features.notesImage": "A musician wearing headphones at a keyboard",
  "features.online": "4 online",
  "features.rooms": "01 · Rooms",
  "features.roomTitle": "A shared home for unfinished ideas.",
  "features.roomDescription": "Invite collaborators, keep every file together and return to the same creative context.",
  "features.take": "Verse take 03",
  "features.clips": "02 · Clips",
  "features.clipsTitle": "Build the track together.",
  "features.clipsDescription": "Upload, arrange and compare each take without losing the thread.",
  "features.version": "Version 12 saved",
  "features.now": "Now",
  "features.synced": "2 edits synced",
  "features.events": "03 · Events",
  "features.eventsTitle": "Review your changes.",
  "features.note": "Try the softer chord here. I left a second take below.",
  "features.notes": "04 · Notes",
  "features.notesTitle": "Feedback stays on time.",
  "workflow.eyebrow": "Workflow",
  "workflow.title": "A focused collaboration loop for making music together.",
  "workflow.description": "Upload clips, shape an arrangement, leave time-based notes, and keep every room member aligned through synchronized actions.",
  "workflow.step1.title": "Create a room",
  "workflow.step1.description": "Start a private project space and invite collaborators with clear room access.",
  "workflow.step2.title": "Build the track",
  "workflow.step2.description": "Upload audio, arrange clips on the timeline, record ideas, and ask the music copilot for suggestions.",
  "workflow.step3.title": "Stay synchronized",
  "workflow.step3.description": "Share edits, notes, transport changes, and version history across the room in real time.",
  "demo.eyebrow": "Working prototype",
  "demo.title": "One room for the music and the conversation.",
  "demo.description": "Explore the demo room to try the timeline, audio clips, feedback and music generator.",
  "demo.launch": "Open demo room",
  "footer.left": "CollabMuse · Final Year Project prototype",
  "footer.right": "Collaborative composition through synchronized events",
} as const;

type TranslationKey = keyof typeof en;
type Dictionary = Record<TranslationKey, string>;

const dictionaries: Record<Language, Dictionary> = {
  en,
  zh: {
    "language.label": "语言",
    "brand.subtitle": "事件驱动的音乐协作空间",
    "nav.features": "功能",
    "nav.workflow": "工作流程",
    "nav.dashboard": "工作台",
    "nav.login": "登录",
    "nav.logout": "退出登录",
    "nav.workspace": "打开工作台",
    "nav.start": "开始创作",
    "hero.eyebrow": "事件驱动的音乐协作空间",
    "hero.title": "创作你的音乐",
    "hero.description": "创建共享房间、编排音频片段，让每一次创作操作都实时同步，无需传输原始实时音频。",
    "hero.dashboard": "打开工作台",
    "hero.demo": "进入演示房间",
    "room.demoSampleNotice": "演示房间：示例片段仅用于展示，不含音频。上传或生成音频后即可播放。",
    "room.demoPlayableNotice": "演示房间：部分示例片段仅供展示；上传或生成的音频可以播放。",
    "music.title": "音乐生成器",
    "music.heading": "生成一段完整音乐",
    "music.builtinDescription": "内置规则编曲器根据所选设置生成纯音乐，并非 AI 音乐模型。",
    "music.externalDescription": "ElevenLabs Music 使用外部 AI 服务，需要配置付费 API 账号。",
    "music.promptHelp": "可识别提示中的钢琴、无鼓和 BPM；风格、情绪和调性请在下方设置。",
    "music.describe": "描述你想要的音乐",
    "music.placeholder": "曲风、乐器、节奏、结构、氛围……",
    "music.generate": "生成音乐",
    "music.generating": "正在编曲并生成音频……",
    "music.settings": "设置风格、调性和时长",
    "music.engine": "生成引擎",
    "music.builtin": "内置编曲器 - 基于规则",
    "music.paid": "ElevenLabs Studio - 付费 API",
    "music.style": "风格",
    "music.mood": "情绪",
    "music.key": "调性",
    "music.length": "时长",
    "music.instrumental": "仅纯音乐",
    "music.instrumentalBuiltin": "仅纯音乐（内置编曲器）",
    "music.preview": "试听生成的音乐",
    "music.add": "将生成的音乐加入工作台",
    "music.adding": "正在添加……",
    "music.added": "已加入工作台",
    "inspector.notes": "留言",
    "inspector.events": "动态",
    "inspector.versions": "历史",
    "inspector.copilot": "助手",
    "inspector.open": "待处理",
    "inspector.resolved": "已解决",
    "inspector.all": "全部",
    "inspector.emptyOpen": "没有待处理的反馈。",
    "inspector.emptyOther": "这里还没有留言。",
    "inspector.notePlaceholder": "添加留言...",
    "inspector.viewOnly": "仅查看权限",
    "inspector.savingNote": "正在保存留言",
    "inspector.sendNote": "发送留言",
    "features.kicker": "核心协作",
    "features.title1": "每一次录音、每一条备注，",
    "features.title2": "都在同一个房间。",
    "features.summary": "上传片段、调整编曲，并在需要的地方留下反馈。从最初的灵感到最终混音，所有人都能看到同一个项目。",
    "features.action": "打开房间",
    "features.roomStatus": "房间 01 · 日落演示",
    "features.roomImage": "手拿黑胶唱片的年轻音乐人",
    "features.clipsImage": "正在弹奏键盘的音乐人",
    "features.eventsImage": "唱片机特写",
    "features.notesImage": "戴着耳机弹奏键盘的音乐人",
    "features.online": "4 人在线",
    "features.rooms": "01 · 房间",
    "features.roomTitle": "为未完成的灵感找到共同的家。",
    "features.roomDescription": "邀请协作者，集中保存文件，随时回到共同的创作空间。",
    "features.take": "主歌录音 03",
    "features.clips": "02 · 音频片段",
    "features.clipsTitle": "一起完成作品。",
    "features.clipsDescription": "上传、编排并比较每个录音版本，让创作思路保持连贯。",
    "features.version": "版本 12 已保存",
    "features.now": "刚刚",
    "features.synced": "2 项编辑已同步",
    "features.events": "03 · 动态",
    "features.eventsTitle": "回顾每一次修改。",
    "features.note": "这里试试更柔和的和弦，我在下面留了第二个版本。",
    "features.notes": "04 · 留言",
    "features.notesTitle": "让反馈对应音乐时间点。",
    "workflow.eyebrow": "工作流程",
    "workflow.title": "为共同创作而设计的清晰协作流程。",
    "workflow.description": "上传片段、完成编曲、留下时间点备注，并通过同步操作让房间成员始终保持一致。",
    "workflow.step1.title": "创建房间",
    "workflow.step1.description": "建立私密项目空间，并邀请拥有明确权限的协作者。",
    "workflow.step2.title": "制作音乐",
    "workflow.step2.description": "上传音频、编排时间线、录制灵感，并向音乐 Copilot 获取建议。",
    "workflow.step3.title": "实时同步",
    "workflow.step3.description": "在房间中实时共享编辑、备注、播放状态和版本历史。",
    "demo.eyebrow": "可运行原型",
    "demo.title": "让音乐和讨论都集中在一个房间。",
    "demo.description": "进入演示房间，体验时间线、音频片段、协作留言和音乐生成。",
    "demo.launch": "打开演示房间",
    "footer.left": "CollabMuse · 毕业设计原型",
    "footer.right": "通过同步事件实现协作式音乐创作",
  },
  es: translate(en, { "hero.title": "crea tu música", "language.label": "Idioma", "nav.features": "Funciones", "nav.workflow": "Flujo", "nav.dashboard": "Panel", "nav.login": "Iniciar sesión", "nav.start": "Empezar a crear", "hero.dashboard": "Abrir panel", "hero.demo": "Entrar en la demo" }),
  fr: translate(en, { "hero.title": "créez votre musique", "language.label": "Langue", "nav.features": "Fonctions", "nav.workflow": "Processus", "nav.dashboard": "Tableau de bord", "nav.login": "Connexion", "nav.start": "Commencer", "hero.dashboard": "Ouvrir le tableau", "hero.demo": "Voir la démo" }),
  de: translate(en, { "hero.title": "mach deine Musik", "language.label": "Sprache", "nav.features": "Funktionen", "nav.workflow": "Ablauf", "nav.dashboard": "Dashboard", "nav.login": "Anmelden", "nav.start": "Jetzt erstellen", "hero.dashboard": "Dashboard öffnen", "hero.demo": "Demo-Raum öffnen" }),
  ja: translate(en, { "hero.title": "音楽をつくろう", "language.label": "言語", "nav.features": "機能", "nav.workflow": "流れ", "nav.dashboard": "ダッシュボード", "nav.login": "ログイン", "nav.start": "制作を始める", "hero.dashboard": "ダッシュボードを開く", "hero.demo": "デモルームへ" }),
  ko: translate(en, { "hero.title": "음악을 만들어 보세요", "language.label": "언어", "nav.features": "기능", "nav.workflow": "워크플로", "nav.dashboard": "대시보드", "nav.login": "로그인", "nav.start": "창작 시작", "hero.dashboard": "대시보드 열기", "hero.demo": "데모 룸 입장" }),
  pt: translate(en, { "hero.title": "crie a sua música", "language.label": "Idioma", "nav.features": "Recursos", "nav.workflow": "Fluxo", "nav.dashboard": "Painel", "nav.login": "Entrar", "nav.start": "Começar a criar", "hero.dashboard": "Abrir painel", "hero.demo": "Entrar na demo" }),
};

function translate(base: Dictionary, overrides: Partial<Dictionary>): Dictionary {
  return { ...base, ...overrides };
}

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    const saved = window.localStorage.getItem("collabmuse-language") as Language | null;
    const browserLanguage = navigator.language.split("-")[0] as Language;
    const next = languages.some(([code]) => code === saved) ? saved : languages.some(([code]) => code === browserLanguage) ? browserLanguage : "en";
    setLanguageState(next ?? "en");
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    window.localStorage.setItem("collabmuse-language", language);
  }, [language]);

  const setLanguage = useCallback((next: Language) => setLanguageState(next), []);
  const value = useMemo(() => ({ language, setLanguage, t: (key: TranslationKey) => dictionaries[language][key] }), [language, setLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}
