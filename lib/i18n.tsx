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
  "demo.description": "The current prototype combines a multitrack editor, room notes, event history, version snapshots, audio recording, export, and an AI composition assistant.",
  "demo.launch": "Launch prototype",
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
    "demo.description": "当前原型已整合多轨编辑、房间备注、事件历史、版本快照、录音、导出和 AI 作曲助手。",
    "demo.launch": "启动原型",
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
