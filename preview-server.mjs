import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const port = 3000;
const clients = new Map();

const rooms = new Map();

function makeRoom(name = "Midnight Sketch") {
  const id = Math.random().toString(36).slice(2, 8);
  const room = {
    id,
    name,
    updatedAt: new Date().toISOString(),
    collaborators: ["ZZ", "FC", "LM"],
    tracks: [
      { id: "drums", name: "Drum texture" },
      { id: "bass", name: "Warm bass" },
      { id: "keys", name: "Glass keys" },
      { id: "vox", name: "Vocal chops" },
    ],
    clips: [
      { id: "c1", trackId: "drums", name: "kick pattern", start: 6, width: 20 },
      { id: "c2", trackId: "drums", name: "rim ghost", start: 34, width: 18 },
      { id: "c3", trackId: "bass", name: "sub pulse", start: 18, width: 26 },
      { id: "c4", trackId: "bass", name: "bass lift", start: 52, width: 21 },
      { id: "c5", trackId: "keys", name: "chord shimmer", start: 8, width: 34 },
      { id: "c6", trackId: "keys", name: "reverse keys", start: 48, width: 28 },
      { id: "c7", trackId: "vox", name: "vocal air", start: 24, width: 22 },
      { id: "c8", trackId: "vox", name: "hook idea", start: 62, width: 18 },
    ],
    messages: [
      { author: "Ziyi", text: "Moved the bass lift into bar 9.", time: "11:20" },
      { author: "Franky", text: "Keep the prototype focused on action sync.", time: "11:22" },
      { author: "Lina", text: "Uploaded a short vocal chop.", time: "11:24" },
    ],
  };
  rooms.set(id, room);
  return room;
}

const demoRoom = makeRoom();

function listRooms() {
  return [...rooms.values()].map((room) => ({
    id: room.id,
    name: room.name,
    clips: room.clips.length,
    tracks: room.tracks.length,
    updatedAt: room.updatedAt,
  }));
}

function sendJson(res, value, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value));
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function broadcast(roomId, event) {
  const room = rooms.get(roomId);
  if (room) room.updatedAt = new Date().toISOString();
  const sockets = clients.get(roomId) ?? new Set();
  for (const res of sockets) {
    res.write(`event: update\ndata: ${JSON.stringify(event)}\n\n`);
  }
}

const baseCss = `
*{box-sizing:border-box}body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont;color:#fffaf8;background:radial-gradient(circle at 18% 22%,rgba(214,207,96,.12),transparent 22rem),radial-gradient(circle at 80% 20%,rgba(157,196,209,.18),transparent 24rem),radial-gradient(circle at 72% 80%,rgba(64,68,68,.22),transparent 24rem),linear-gradient(180deg,#020303 0%,#070909 52%,#030404 100%);min-height:100vh}a{color:inherit;text-decoration:none}button,input{font:inherit}.nav{position:sticky;top:0;z-index:5;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(3,4,6,.58);backdrop-filter:blur(22px)}.nav-inner{max-width:1180px;margin:auto;padding:16px 20px;display:flex;align-items:center;justify-content:space-between}.brand{display:flex;gap:12px;align-items:center}.logo{width:42px;height:42px;border-radius:16px;border:1px solid rgba(255,255,255,.18);background:linear-gradient(145deg,rgba(122,86,184,.55),rgba(102,174,134,.45));display:grid;place-items:center;color:#fff;box-shadow:inset 0 1px 1px rgba(255,255,255,.2),0 18px 45px rgba(143,80,190,.22)}.links{display:flex;gap:24px;color:rgba(255,255,255,.62);font-size:14px}.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:999px;padding:12px 18px;border:1px solid rgba(255,255,255,.18);background:linear-gradient(145deg,rgba(110,105,140,.38),rgba(102,174,134,.22));color:#fff;backdrop-filter:blur(18px);box-shadow:inset 0 1px 1px rgba(255,255,255,.18),0 24px 80px rgba(0,0,0,.32);font-weight:650;font-size:14px;transition:.2s;cursor:pointer}.btn:hover{transform:translateY(-1px);background:rgba(255,255,255,.16)}.btn.primary{background:linear-gradient(135deg,#fff7f5 0%,#e8dfe2 46%,#b9c8ff 100%);color:#101018}.wrap{max-width:1180px;margin:auto;padding:72px 20px}.hero{display:grid;grid-template-columns:.9fr 1.1fr;gap:48px;align-items:center}.eyebrow,.tag{display:inline-flex;border:1px solid rgba(255,255,255,.18);background:linear-gradient(135deg,rgba(98,116,170,.32),rgba(102,174,134,.24));border-radius:999px;padding:9px 14px;color:rgba(255,255,255,.78);font-size:14px}.h1{font-size:clamp(46px,6vw,76px);line-height:1.02;margin:24px 0 0;font-weight:760;letter-spacing:0}.lead{font-size:18px;line-height:1.75;color:rgba(255,255,255,.68);max-width:650px}.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:30px}.glass{position:relative;overflow:hidden;border:1px solid rgba(255,255,255,.16);background:linear-gradient(145deg,rgba(98,105,137,.26),rgba(16,20,28,.2));box-shadow:inset 0 1px 1px rgba(255,255,255,.18),inset 0 -1px 1px rgba(255,255,255,.05),0 30px 90px rgba(0,0,0,.42);backdrop-filter:blur(34px) saturate(145%);border-radius:28px}.glass:after{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 22% 12%,rgba(169,126,229,.34),transparent 32%),radial-gradient(circle at 78% 72%,rgba(100,174,134,.26),transparent 30%),linear-gradient(180deg,rgba(255,255,255,.09),transparent 44%);mix-blend-mode:screen}.glass>*{position:relative;z-index:1}.hero-panel{min-height:470px;padding:22px;background:linear-gradient(155deg,rgba(82,78,126,.43),rgba(7,10,15,.25) 48%,rgba(122,190,226,.28));border-radius:34px}.hero-panel:before{content:"";position:absolute;inset:0;background:url('/waveform-panel.png') center/cover;opacity:.18;filter:blur(2px) saturate(1.05);mix-blend-mode:screen}.hero-panel:after{background:radial-gradient(circle at 22% 12%,rgba(169,126,229,.30),transparent 32%),radial-gradient(circle at 78% 72%,rgba(126,199,235,.30),transparent 32%),linear-gradient(180deg,rgba(255,255,255,.09),transparent 44%)}.panel-head{display:flex;justify-content:space-between;align-items:center;border:1px solid rgba(255,255,255,.18);background:linear-gradient(135deg,rgba(102,86,130,.46),rgba(122,190,226,.26));border-radius:24px;padding:16px}.hero-panel .tag{background:linear-gradient(135deg,rgba(98,116,170,.32),rgba(132,204,238,.24))}.lanes{position:relative;margin-top:22px;display:grid;gap:12px}.lane{display:grid;grid-template-columns:82px 1fr;align-items:center;gap:12px}.lane span{color:rgba(255,255,255,.46);font-size:13px}.track-preview{height:64px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.055);border-radius:18px;position:relative;overflow:hidden}.clip-preview{position:absolute;top:13px;height:38px;border-radius:14px;border:1px solid rgba(255,255,255,.16);background:linear-gradient(90deg,rgba(255,185,207,.82),rgba(132,204,238,.70));box-shadow:0 0 24px rgba(132,204,238,.22)}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}.card{padding:24px}.card h3{margin:18px 0 10px}.card:nth-child(1),.room-card:nth-child(1){background:radial-gradient(circle at 70% 8%,rgba(214,242,75,.22),transparent 18%),linear-gradient(155deg,rgba(99,80,124,.56),rgba(172,91,124,.48))}.card:nth-child(2),.room-card:nth-child(2){background:radial-gradient(circle at 74% 48%,rgba(90,174,125,.34),transparent 28%),linear-gradient(155deg,rgba(96,168,127,.46),rgba(94,105,116,.36))}.card:nth-child(3),.room-card:nth-child(3){background:radial-gradient(circle at 50% 40%,rgba(3,6,18,.78),transparent 36%),linear-gradient(155deg,rgba(48,99,225,.7),rgba(21,32,88,.5))}.card:nth-child(4),.room-card:nth-child(4){background:radial-gradient(circle at 78% 40%,rgba(56,87,245,.46),transparent 28%),linear-gradient(155deg,rgba(221,88,118,.68),rgba(123,59,45,.48))}.muted{color:rgba(255,255,255,.62);line-height:1.65}.section-title{font-size:40px;line-height:1.1;margin:12px 0}.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.dashboard-grid{display:grid;grid-template-columns:1fr .42fr;gap:16px}.room-card{display:block;padding:22px;min-height:230px}.avatars{display:flex;margin-top:24px}.avatar{width:36px;height:36px;margin-right:-8px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#f3d074,#e46b92);color:#fff;border:1px solid rgba(0,0,0,.35);font-weight:800;font-size:12px}.avatar:nth-child(2){background:linear-gradient(135deg,#9adcba,#526172)}.avatar:nth-child(3){background:linear-gradient(135deg,#76b982,#5d6c68)}.workflow-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:0;margin-top:26px}.workflow-step{padding:8px 34px 4px;border-left:1px dashed rgba(255,255,255,.26)}.workflow-step:first-child{border-left:0;padding-left:0}.workflow-step b{font-size:22px}.editor{padding:16px;display:grid;grid-template-columns:280px 1fr 330px;gap:16px}.sidebar,.chat,.timeline{min-height:520px;padding:18px}.track-row,.message,.stat{border:1px solid rgba(255,255,255,.14);background:linear-gradient(135deg,rgba(88,148,118,.24),rgba(20,25,34,.22));border-radius:18px;padding:16px;margin-top:12px;box-shadow:inset 0 1px 1px rgba(255,255,255,.1)}.track-row input{width:100%;border:1px dashed rgba(255,255,255,.26);border-radius:12px;background:rgba(255,255,255,.055);color:#fff;font-weight:800;outline:none;padding:8px 10px;margin:-4px 0 8px}.track-row input:hover,.track-row input:focus{border-color:rgba(154,220,188,.62);background:rgba(154,220,188,.09);box-shadow:0 0 0 3px rgba(154,220,188,.08)}.rename-hint{display:inline-flex;align-items:center;gap:6px;margin-top:6px;font-size:12px;color:rgba(255,255,255,.48)}.rename-hint:before{content:"✎";font-size:11px}.timeline-grid{height:448px;position:relative;overflow:hidden;background-color:rgba(0,0,0,.16);background-image:linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.07) 1px,transparent 1px),radial-gradient(circle at 44% 48%,rgba(75,102,245,.16),transparent 32%);background-size:100% 72px,72px 100%,100% 100%;border-top:1px solid rgba(255,255,255,.1)}.audio{position:absolute;height:48px;border-radius:18px;padding:14px;border:1px solid rgba(255,255,255,.16);background:linear-gradient(135deg,rgba(93,117,237,.78),rgba(102,174,134,.58));box-shadow:inset 0 1px 1px rgba(255,255,255,.2),0 16px 38px rgba(0,0,0,.32);font-size:12px;cursor:grab;user-select:none}.audio:nth-child(3n+2){background:linear-gradient(135deg,rgba(131,156,148,.72),rgba(171,185,161,.48))}.audio:nth-child(3n){background:linear-gradient(135deg,rgba(218,96,58,.78),rgba(60,83,222,.58))}.feature-title{display:flex;align-items:center;gap:10px}.feature-icon{width:30px;height:30px;border-radius:12px;display:inline-grid;place-items:center;border:1px solid rgba(255,255,255,.18);background:linear-gradient(135deg,rgba(215,156,184,.42),rgba(132,204,238,.28));box-shadow:inset 0 1px 1px rgba(255,255,255,.14);color:#fff}.feature-icon svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round;opacity:.92}.topbar,.editor>.glass,.editor>div>.glass,.editor aside.glass,.editor section.glass{background:linear-gradient(145deg,rgba(76,77,112,.40),rgba(18,26,38,.30) 52%,rgba(82,151,186,.22));border-color:rgba(170,198,230,.20)}.topbar:after,.editor .glass:after{background:radial-gradient(circle at 18% 12%,rgba(151,124,202,.30),transparent 34%),radial-gradient(circle at 78% 70%,rgba(132,204,238,.22),transparent 32%),linear-gradient(180deg,rgba(255,255,255,.08),transparent 44%)}.editor .card{background:linear-gradient(135deg,rgba(84,73,118,.44),rgba(122,190,226,.20) 58%,rgba(214,125,158,.16))}.track-row,.message,.stat{border-color:rgba(188,213,235,.16);background:linear-gradient(135deg,rgba(75,86,121,.30),rgba(19,27,39,.26));box-shadow:inset 0 1px 1px rgba(255,255,255,.10)}.track-row input:hover,.track-row input:focus{border-color:rgba(132,204,238,.62);background:rgba(132,204,238,.09);box-shadow:0 0 0 3px rgba(132,204,238,.08)}.chat .message:nth-child(odd),.sidebar .track-row:nth-child(odd){background:linear-gradient(135deg,rgba(79,88,126,.30),rgba(31,48,65,.24))}.audio{background:linear-gradient(90deg,rgba(215,156,184,.80),rgba(132,204,238,.66));box-shadow:inset 0 1px 1px rgba(255,255,255,.20),0 16px 38px rgba(0,0,0,.32)}.audio:nth-child(3n+2){background:linear-gradient(90deg,rgba(156,141,192,.72),rgba(132,204,238,.58))}.audio:nth-child(3n){background:linear-gradient(90deg,rgba(225,143,174,.74),rgba(116,132,218,.62))}.topbar{margin:16px auto;max-width:1800px;padding:16px 20px;display:flex;align-items:center;justify-content:space-between}.footer{padding:36px 20px;color:rgba(255,255,255,.44);display:flex;justify-content:space-between;max-width:1180px;margin:auto}.status{font-size:12px;color:rgba(255,255,255,.5);margin-top:10px}.formline{display:flex;gap:10px;margin-top:14px}.field{width:100%;border:1px solid rgba(255,255,255,.14);border-radius:999px;background:rgba(255,255,255,.08);color:#fff;padding:12px 14px;outline:none}.file{font-size:13px;color:rgba(255,255,255,.68)}body{background:radial-gradient(circle at 18% 10%,rgba(218,212,112,.18),transparent 20rem),radial-gradient(circle at 78% 22%,rgba(125,164,180,.34),transparent 32rem),radial-gradient(circle at 54% 86%,rgba(158,168,168,.16),transparent 26rem),linear-gradient(180deg,#05080a 0%,#071015 45%,#030506 100%)}.btn{background:linear-gradient(145deg,rgba(126,158,173,.34),rgba(186,187,161,.16));border-color:rgba(218,232,238,.20)}.btn.primary{background:linear-gradient(135deg,#fffdf6 0%,#e9e3bd 52%,#b8d4dc 100%);color:#111719}.topbar,.editor>.glass,.editor>div>.glass,.editor aside.glass,.editor section.glass{background:linear-gradient(145deg,rgba(123,158,174,.42),rgba(33,47,55,.34) 52%,rgba(194,190,116,.10));border-color:rgba(218,234,240,.23);box-shadow:inset 0 1px 1px rgba(255,255,255,.18),inset 0 -1px 1px rgba(255,255,255,.05),0 30px 90px rgba(0,0,0,.42)}.topbar:after,.editor .glass:after{background:radial-gradient(circle at 18% 10%,rgba(222,214,105,.22),transparent 28%),radial-gradient(circle at 74% 42%,rgba(135,179,196,.30),transparent 36%),radial-gradient(circle at 52% 82%,rgba(172,180,176,.16),transparent 30%),linear-gradient(180deg,rgba(255,255,255,.10),transparent 44%)}.editor .card{background:linear-gradient(135deg,rgba(117,151,168,.40),rgba(38,52,60,.32) 54%,rgba(215,207,116,.14))}.track-row,.message,.stat{border-color:rgba(215,230,236,.17);background:linear-gradient(135deg,rgba(128,157,170,.30),rgba(24,35,42,.28));box-shadow:inset 0 1px 1px rgba(255,255,255,.11)}.chat .message:nth-child(odd),.sidebar .track-row:nth-child(odd){background:linear-gradient(135deg,rgba(135,164,176,.30),rgba(34,46,53,.26))}.track-row input:hover,.track-row input:focus{border-color:rgba(225,219,137,.62);background:rgba(225,219,137,.09);box-shadow:0 0 0 3px rgba(225,219,137,.08)}.timeline-grid{background-color:rgba(5,8,10,.24);background-image:linear-gradient(rgba(222,232,236,.065) 1px,transparent 1px),linear-gradient(90deg,rgba(222,232,236,.075) 1px,transparent 1px),radial-gradient(circle at 44% 48%,rgba(126,164,180,.20),transparent 34%)}.audio{background:linear-gradient(90deg,rgba(218,209,124,.78),rgba(135,184,205,.70));box-shadow:inset 0 1px 1px rgba(255,255,255,.22),0 16px 38px rgba(0,0,0,.32)}.audio:nth-child(3n+2){background:linear-gradient(90deg,rgba(158,168,168,.70),rgba(139,184,202,.62))}.audio:nth-child(3n){background:linear-gradient(90deg,rgba(210,203,122,.70),rgba(104,142,160,.66))}.avatar{background:linear-gradient(135deg,#eee39b,#87b2c2);color:#fff}.avatar:nth-child(2){background:linear-gradient(135deg,#a8bac0,#6f929e)}.avatar:nth-child(3){background:linear-gradient(135deg,#d7cf7a,#7f9aa0)}.topbar,.editor>.glass,.editor>div>.glass,.editor aside.glass,.editor section.glass{background:linear-gradient(145deg,rgba(130,165,181,.50),rgba(42,56,63,.38) 56%,rgba(198,195,132,.16))!important;border-color:rgba(224,238,242,.28)!important}.topbar:after,.editor .glass:after{background:radial-gradient(circle at 20% 10%,rgba(224,218,132,.24),transparent 30%),radial-gradient(circle at 76% 42%,rgba(142,183,199,.38),transparent 38%),radial-gradient(circle at 52% 82%,rgba(184,190,185,.18),transparent 32%),linear-gradient(180deg,rgba(255,255,255,.11),transparent 46%)!important}.editor .card{background:linear-gradient(135deg,rgba(128,160,176,.46),rgba(45,59,66,.36) 58%,rgba(218,211,134,.18))!important}.track-row,.message,.stat{background:linear-gradient(135deg,rgba(130,158,170,.34),rgba(27,38,44,.30))!important;border-color:rgba(218,232,238,.20)!important}.chat .message:nth-child(odd),.sidebar .track-row:nth-child(odd){background:linear-gradient(135deg,rgba(139,166,176,.34),rgba(36,48,54,.28))!important}.timeline-grid{background-color:rgba(5,8,10,.28)!important;background-image:linear-gradient(rgba(226,236,239,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(226,236,239,.08) 1px,transparent 1px),radial-gradient(circle at 48% 48%,rgba(126,164,180,.24),transparent 36%)!important}.audio{background:linear-gradient(90deg,rgba(217,211,133,.72),rgba(143,185,202,.76))!important;border-color:rgba(230,241,244,.30)!important}.audio:nth-child(3n+2){background:linear-gradient(90deg,rgba(167,176,174,.74),rgba(138,180,196,.70))!important}.audio:nth-child(3n){background:linear-gradient(90deg,rgba(209,204,135,.70),rgba(116,153,169,.74))!important}.btn{background:linear-gradient(145deg,rgba(130,160,174,.38),rgba(190,188,142,.18))!important;border-color:rgba(224,238,242,.24)!important}.btn.primary{background:linear-gradient(135deg,#fffdf5 0%,#e8e0ad 48%,#b5d0d8 100%)!important;color:#111719!important}.avatar{background:linear-gradient(135deg,#ede29b,#86afbd)!important}.avatar:nth-child(2){background:linear-gradient(135deg,#bcc7c9,#789aa5)!important}.avatar:nth-child(3){background:linear-gradient(135deg,#d8d07d,#8aa3a7)!important}.track-row input:hover,.track-row input:focus{border-color:rgba(228,222,142,.70)!important;background:rgba(228,222,142,.10)!important;box-shadow:0 0 0 3px rgba(228,222,142,.08)!important}body{background-color:#050606!important;background-image:radial-gradient(circle at 20% 8%,rgba(255,255,255,.10),transparent 18rem),radial-gradient(circle at 76% 30%,rgba(126,185,205,.18),transparent 24rem),radial-gradient(circle at 8% 70%,rgba(255,255,255,.06),transparent 20rem),radial-gradient(rgba(255,255,255,.11) 1px,transparent 1px)!important;background-size:auto,auto,auto,30px 30px!important;color:#f4f6f2!important}.topbar,.editor>.glass,.editor>div>.glass,.editor aside.glass,.editor section.glass{background:linear-gradient(145deg,rgba(255,255,255,.12),rgba(48,50,49,.34) 46%,rgba(7,8,8,.44))!important;border:1px solid rgba(255,255,255,.22)!important;box-shadow:inset 0 1px 1px rgba(255,255,255,.20),inset 0 -1px 1px rgba(255,255,255,.06),0 34px 90px rgba(0,0,0,.55)!important;backdrop-filter:blur(38px) saturate(125%)!important}.topbar:after,.editor .glass:after{background:radial-gradient(circle at 18% 8%,rgba(255,255,255,.22),transparent 24%),radial-gradient(circle at 72% 34%,rgba(132,198,220,.28),transparent 28%),radial-gradient(circle at 2% 92%,rgba(255,255,255,.14),transparent 18%),linear-gradient(180deg,rgba(255,255,255,.10),transparent 48%)!important;mix-blend-mode:screen!important}.editor .card{background:linear-gradient(145deg,rgba(255,255,255,.16),rgba(44,45,43,.36) 52%,rgba(5,6,6,.48))!important}.track-row,.message,.stat{background:linear-gradient(145deg,rgba(255,255,255,.12),rgba(43,45,44,.30) 48%,rgba(10,11,11,.42))!important;border:1px solid rgba(255,255,255,.20)!important;box-shadow:inset 0 1px 1px rgba(255,255,255,.16),0 14px 34px rgba(0,0,0,.28)!important}.chat .message:nth-child(odd),.sidebar .track-row:nth-child(odd){background:linear-gradient(145deg,rgba(255,255,255,.15),rgba(50,51,49,.32) 45%,rgba(12,13,13,.42))!important}.track-row input{background:rgba(255,255,255,.06)!important;border:1px solid rgba(255,255,255,.28)!important;color:#fff!important}.track-row input:hover,.track-row input:focus{border-color:rgba(156,218,236,.78)!important;background:rgba(156,218,236,.10)!important;box-shadow:0 0 0 3px rgba(156,218,236,.10),0 0 26px rgba(156,218,236,.20)!important}.btn{background:linear-gradient(145deg,rgba(255,255,255,.14),rgba(55,56,54,.30))!important;border:1px solid rgba(255,255,255,.22)!important;color:#f7f8f4!important;box-shadow:inset 0 1px 1px rgba(255,255,255,.18),0 18px 45px rgba(0,0,0,.35)!important}.btn.primary{background:linear-gradient(135deg,#d8f3fb 0%,#8ed0e5 55%,#f4fbfd 100%)!important;color:#07100a!important;box-shadow:0 0 28px rgba(142,208,229,.30),inset 0 1px 1px rgba(255,255,255,.40)!important}.timeline-grid{background-color:rgba(2,3,3,.50)!important;background-image:linear-gradient(rgba(255,255,255,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.055) 1px,transparent 1px),radial-gradient(rgba(255,255,255,.12) 1px,transparent 1px),radial-gradient(circle at 68% 34%,rgba(126,190,212,.20),transparent 32%)!important;background-size:100% 72px,72px 100%,26px 26px,100% 100%!important;border-top:1px solid rgba(255,255,255,.14)!important}.audio{background:linear-gradient(145deg,rgba(255,255,255,.58),rgba(206,212,208,.30) 45%,rgba(80,84,82,.26))!important;border:1px solid rgba(255,255,255,.45)!important;color:#ffffff!important;box-shadow:inset 0 1px 1px rgba(255,255,255,.45),0 20px 40px rgba(0,0,0,.34)!important}.audio:nth-child(3n+2){background:linear-gradient(145deg,rgba(255,255,255,.46),rgba(150,211,231,.40) 48%,rgba(32,72,86,.44))!important;border-color:rgba(160,222,238,.64)!important;box-shadow:0 0 32px rgba(142,208,229,.28),inset 0 1px 1px rgba(255,255,255,.38)!important}.audio:nth-child(3n){background:linear-gradient(145deg,rgba(255,255,255,.44),rgba(190,195,191,.30) 50%,rgba(28,30,29,.42))!important}.field{background:rgba(255,255,255,.10)!important;border-color:rgba(255,255,255,.24)!important;color:#fff!important}.avatar{background:linear-gradient(135deg,#bceaf4,#4f93a8)!important;color:#07100a!important;border-color:rgba(255,255,255,.36)!important;box-shadow:0 0 22px rgba(142,208,229,.30)!important}.avatar:nth-child(2){background:linear-gradient(135deg,#f6f6f0,#7e8581)!important;color:#0b0d0c!important}.avatar:nth-child(3){background:linear-gradient(135deg,#a7ddeb,#8e9691)!important;color:#07100a!important}.muted,.status{color:rgba(244,246,242,.64)!important}.topbar h1,.sidebar h2,.timeline h2,.chat h2{color:#fff!important;text-shadow:0 0 24px rgba(255,255,255,.08)!important}.room-page{position:relative;isolation:isolate;overflow:hidden;min-height:100vh}.room-page .topbar,.room-page .editor{position:relative;z-index:1}.room-page:before{content:"♪";position:fixed;left:-6vw;top:24vh;font-size:38rem;font-weight:800;color:rgba(221,213,92,.24);filter:blur(30px);transform:rotate(-16deg);z-index:0;line-height:1;pointer-events:none}.room-page:after{content:"♫";position:fixed;right:-4vw;bottom:2vh;font-size:35rem;font-weight:800;color:rgba(41,44,44,.54);filter:blur(24px);transform:rotate(14deg);z-index:0;line-height:1;pointer-events:none}.room-page .topbar{background:linear-gradient(112deg,rgba(250,252,251,.78) 0%,rgba(212,232,237,.62) 24%,rgba(139,177,190,.60) 49%,rgba(78,120,136,.42) 72%,rgba(247,250,249,.26) 100%)!important;border-color:rgba(248,252,252,.42)!important;box-shadow:inset 0 1px 1px rgba(255,255,255,.50),0 30px 86px rgba(0,0,0,.44)!important}.room-page .topbar:after{background:radial-gradient(circle at 12% 14%,rgba(255,255,255,.44),transparent 26%),radial-gradient(circle at 68% 48%,rgba(122,176,194,.36),transparent 36%),linear-gradient(180deg,rgba(255,255,255,.16),transparent 54%)!important}.room-page .sidebar,.room-page .chat{background:linear-gradient(145deg,rgba(242,244,240,.38),rgba(156,164,162,.25) 42%,rgba(18,21,21,.42) 100%)!important;border-color:rgba(244,246,242,.30)!important}.room-page .sidebar:after,.room-page .chat:after{background:radial-gradient(circle at 18% 10%,rgba(255,255,255,.38),transparent 24%),radial-gradient(circle at 72% 76%,rgba(151,163,161,.22),transparent 36%),linear-gradient(180deg,rgba(255,255,255,.12),transparent 50%)!important}.room-page .editor>div>.glass,.room-page .timeline{background:linear-gradient(145deg,rgba(160,196,207,.50),rgba(92,139,154,.42) 48%,rgba(24,38,43,.46) 100%)!important;border-color:rgba(220,241,245,.34)!important}.room-page .editor>div>.glass:after,.room-page .timeline:after{background:radial-gradient(circle at 20% 8%,rgba(255,255,255,.26),transparent 28%),radial-gradient(circle at 72% 54%,rgba(139,194,212,.32),transparent 40%),linear-gradient(180deg,rgba(255,255,255,.10),transparent 52%)!important}.room-page .track-row,.room-page .message,.room-page .stat{background:linear-gradient(145deg,rgba(237,239,235,.24),rgba(118,130,130,.18) 44%,rgba(15,17,17,.34) 100%)!important;border-color:rgba(244,246,242,.24)!important}.room-page .chat .message:nth-child(odd),.room-page .sidebar .track-row:nth-child(odd){background:linear-gradient(145deg,rgba(255,255,255,.28),rgba(133,145,145,.18) 45%,rgba(18,21,21,.36) 100%)!important}.room-page .timeline-grid{background-color:rgba(104,154,169,.46)!important;background-image:linear-gradient(rgba(238,248,250,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(238,248,250,.08) 1px,transparent 1px),radial-gradient(rgba(255,255,255,.14) 1px,transparent 1px),radial-gradient(circle at 34% 28%,rgba(224,213,93,.12),transparent 30%),radial-gradient(circle at 76% 72%,rgba(45,49,49,.30),transparent 34%)!important;background-size:100% 72px,72px 100%,28px 28px,100% 100%,100% 100%!important}.room-page .audio{background:linear-gradient(145deg,rgba(245,247,245,.50),rgba(161,192,202,.38) 48%,rgba(70,95,104,.34) 100%)!important;border-color:rgba(244,250,250,.42)!important}.room-page .audio:nth-child(3n+2){background:linear-gradient(145deg,rgba(245,247,245,.46),rgba(179,199,202,.36) 48%,rgba(70,76,76,.34) 100%)!important}.room-page .audio:nth-child(3n){background:linear-gradient(145deg,rgba(224,213,93,.30),rgba(158,190,202,.38) 48%,rgba(52,65,69,.38) 100%)!important}.room-page .btn.primary{background:linear-gradient(135deg,#f8fbfb 0%,#cfe8ee 46%,#8fbfd0 100%)!important;color:#081014!important}.room-page .btn{background:linear-gradient(145deg,rgba(242,246,246,.24),rgba(134,154,158,.22),rgba(26,30,31,.24))!important}.room-page .avatar{background:linear-gradient(135deg,#f2f4ef,#94c8d8)!important;color:#081014!important}.room-page .avatar:nth-child(2){background:linear-gradient(135deg,#f5f6f2,#9da6a5)!important}.room-page .avatar:nth-child(3){background:linear-gradient(135deg,#d9cf59,#6c7474)!important;color:#10110a!important}
/* clean fog-blue room refresh */
body:has(.room-page){
  background:#7fa3b0!important;
  background-image:radial-gradient(circle at 18% 10%,rgba(230,224,112,.30),transparent 16rem),linear-gradient(180deg,#88abba 0%,#779aa7 48%,#6f8f9b 100%)!important;
}
.room-page{background:linear-gradient(180deg,#88abba 0%,#789ca8 58%,#6d8d99 100%)!important;}
.room-page:before,.room-page:after{display:none!important;content:none!important;}
.room-page .glass:after{opacity:.18!important;background:linear-gradient(180deg,rgba(255,255,255,.16),transparent 54%)!important;}
.room-page .topbar{
  background:linear-gradient(115deg,rgba(237,244,246,.82) 0%,rgba(169,197,206,.84) 38%,rgba(119,158,171,.82) 100%)!important;
  border:1px solid rgba(255,255,255,.52)!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.55),0 22px 50px rgba(48,70,78,.20)!important;
  backdrop-filter:blur(10px) saturate(110%)!important;
}
.room-page .sidebar,.room-page .chat{
  background:linear-gradient(145deg,rgba(229,234,233,.86),rgba(188,200,201,.78) 42%,rgba(126,148,153,.70) 100%)!important;
  border:1px solid rgba(255,255,255,.50)!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.55),0 18px 44px rgba(46,64,70,.18)!important;
  backdrop-filter:blur(8px) saturate(105%)!important;
}
.room-page .editor>div>.glass,.room-page .timeline{
  background:linear-gradient(145deg,rgba(151,185,197,.88),rgba(123,163,177,.82) 52%,rgba(96,131,143,.78) 100%)!important;
  border:1px solid rgba(239,249,250,.46)!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.36),0 18px 42px rgba(45,67,76,.18)!important;
  backdrop-filter:blur(8px) saturate(105%)!important;
}
.room-page .timeline-grid{
  background-color:rgba(129,169,183,.72)!important;
  background-image:linear-gradient(rgba(255,255,255,.16) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.16) 1px,transparent 1px)!important;
  background-size:100% 72px,72px 100%!important;
}
.room-page .track-row,.room-page .message,.room-page .stat{
  background:linear-gradient(145deg,rgba(236,241,241,.66),rgba(159,178,181,.52))!important;
  border:1px solid rgba(255,255,255,.44)!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.38)!important;
}
.room-page .track-row input{
  background:rgba(255,255,255,.24)!important;
  border:1px solid rgba(255,255,255,.46)!important;
  color:#fff!important;
}
.room-page .btn,.room-page .btn.primary,.room-page label.btn{
  background:#f8fbfb!important;
  color:#111820!important;
  border:1px solid rgba(255,255,255,.78)!important;
  box-shadow:0 14px 30px rgba(45,69,78,.16),inset 0 1px 0 rgba(255,255,255,.88)!important;
  backdrop-filter:none!important;
}
.room-page .btn:hover{background:#ffffff!important;transform:translateY(-1px);}
.room-page .audio{
  background:linear-gradient(145deg,rgba(247,250,250,.74),rgba(174,204,214,.62))!important;
  border:1px solid rgba(255,255,255,.58)!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.62),0 10px 22px rgba(52,78,88,.16)!important;
  color:#fff!important;
}
.room-page .audio:nth-child(3n),.room-page .audio:nth-child(3n+2){
  background:linear-gradient(145deg,rgba(245,248,248,.68),rgba(145,184,198,.62))!important;
}
.room-page .field{
  background:rgba(255,255,255,.28)!important;
  border:1px solid rgba(255,255,255,.44)!important;
  color:#fff!important;
}
.room-page .field::placeholder{color:rgba(255,255,255,.68)!important;}
.room-page .avatar{background:linear-gradient(135deg,#f8fbfb,#a7cfdb)!important;color:#111820!important;box-shadow:0 8px 20px rgba(45,69,78,.18)!important;}
.room-page .avatar:nth-child(2),.room-page .avatar:nth-child(3){background:linear-gradient(135deg,#ffffff,#b8c7ca)!important;color:#111820!important;}
.room-page .muted,.room-page .status,.room-page .rename-hint{color:rgba(255,255,255,.78)!important;}
.room-page h1,.room-page h2,.room-page b,.room-page strong{color:#fff!important;}

/* dark clean fog-blue room refinement */
body:has(.room-page){
  background:#020405!important;
  background-image:radial-gradient(circle at 78% 22%,rgba(78,129,147,.18),transparent 26rem),radial-gradient(circle at 18% 72%,rgba(52,91,106,.12),transparent 24rem),linear-gradient(180deg,#020405 0%,#04080a 48%,#020405 100%)!important;
}
.room-page{
  background:linear-gradient(180deg,#020405 0%,#04080a 55%,#020405 100%)!important;
}
.room-page:before,.room-page:after{display:none!important;content:none!important;}
.room-page .glass:after{opacity:.10!important;background:linear-gradient(180deg,rgba(166,207,219,.12),transparent 58%)!important;}
.room-page .topbar{
  background:linear-gradient(118deg,rgba(34,65,76,.92) 0%,rgba(22,45,54,.94) 52%,rgba(9,18,23,.96) 100%)!important;
  border:1px solid rgba(133,181,195,.30)!important;
  box-shadow:inset 0 1px 0 rgba(185,224,234,.20),0 22px 52px rgba(0,0,0,.30)!important;
  backdrop-filter:blur(8px) saturate(105%)!important;
}
.room-page .sidebar,.room-page .chat{
  background:linear-gradient(145deg,rgba(31,61,72,.92),rgba(19,39,48,.94) 48%,rgba(8,18,23,.96) 100%)!important;
  border:1px solid rgba(126,174,188,.26)!important;
  box-shadow:inset 0 1px 0 rgba(180,220,230,.14),0 18px 46px rgba(0,0,0,.28)!important;
  backdrop-filter:blur(6px) saturate(105%)!important;
}
.room-page .editor>div>.glass,.room-page .timeline{
  background:linear-gradient(145deg,rgba(34,72,85,.92),rgba(24,54,66,.94) 50%,rgba(9,21,28,.96) 100%)!important;
  border:1px solid rgba(130,184,199,.28)!important;
  box-shadow:inset 0 1px 0 rgba(190,230,238,.14),0 18px 44px rgba(0,0,0,.30)!important;
  backdrop-filter:blur(6px) saturate(105%)!important;
}
.room-page .timeline-grid{
  background-color:rgba(15,36,45,.86)!important;
  background-image:linear-gradient(rgba(127,180,196,.10) 1px,transparent 1px),linear-gradient(90deg,rgba(127,180,196,.10) 1px,transparent 1px)!important;
  background-size:100% 72px,72px 100%!important;
}
.room-page .track-row,.room-page .message,.room-page .stat{
  background:linear-gradient(145deg,rgba(37,72,83,.78),rgba(15,34,43,.84))!important;
  border:1px solid rgba(137,187,201,.22)!important;
  box-shadow:inset 0 1px 0 rgba(185,226,236,.12)!important;
}
.room-page .track-row input{
  background:rgba(15,35,44,.64)!important;
  border:1px solid rgba(137,187,201,.28)!important;
  color:#fff!important;
}
.room-page .btn,.room-page .btn.primary,.room-page label.btn{
  background:#f7fbfc!important;
  color:#061116!important;
  border:1px solid rgba(255,255,255,.88)!important;
  box-shadow:0 12px 26px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.90)!important;
  backdrop-filter:none!important;
}
.room-page .btn:hover{background:#ffffff!important;transform:translateY(-1px);}
.room-page .audio,.room-page .audio:nth-child(3n),.room-page .audio:nth-child(3n+2){
  background:linear-gradient(145deg,rgba(91,144,160,.82),rgba(40,82,96,.84))!important;
  border:1px solid rgba(158,210,224,.34)!important;
  box-shadow:inset 0 1px 0 rgba(220,247,252,.18),0 10px 22px rgba(0,0,0,.22)!important;
  color:#fff!important;
}
.room-page .field{
  background:rgba(14,33,42,.78)!important;
  border:1px solid rgba(134,183,197,.25)!important;
  color:#fff!important;
}
.room-page .field::placeholder{color:rgba(224,242,247,.56)!important;}
.room-page .avatar,.room-page .avatar:nth-child(2),.room-page .avatar:nth-child(3){
  background:linear-gradient(135deg,#dff6fb,#78b6c8)!important;
  color:#061116!important;
  box-shadow:0 8px 20px rgba(0,0,0,.22)!important;
}
.room-page .muted,.room-page .status,.room-page .rename-hint{color:rgba(224,242,247,.70)!important;}
.room-page h1,.room-page h2,.room-page b,.room-page strong{color:#fff!important;text-shadow:none!important;}

/* remove gray cast: pure dark fog-blue surfaces */
.room-page .sidebar,.room-page .chat{
  background:linear-gradient(145deg,#183642 0%,#102934 48%,#071920 100%)!important;
  border-color:rgba(111,169,187,.34)!important;
}
.room-page .editor>div>.glass,.room-page .timeline{
  background:linear-gradient(145deg,#1f4654 0%,#153744 50%,#08202a 100%)!important;
  border-color:rgba(123,188,207,.34)!important;
}
.room-page .topbar{
  background:linear-gradient(118deg,#1f4654 0%,#153744 46%,#071920 100%)!important;
  border-color:rgba(123,188,207,.34)!important;
}
.room-page .sidebar:after,.room-page .chat:after,.room-page .editor>div>.glass:after,.room-page .timeline:after,.room-page .topbar:after{
  opacity:.06!important;
  background:linear-gradient(180deg,rgba(191,232,243,.18),transparent 55%)!important;
}
.room-page .track-row,.room-page .message,.room-page .stat{
  background:linear-gradient(145deg,#1c3f4c 0%,#102d38 100%)!important;
  border-color:rgba(123,188,207,.28)!important;
}
.room-page .track-row input{
  background:#102b35!important;
  border-color:rgba(143,203,219,.30)!important;
}
.room-page .timeline-grid{
  background-color:#12323d!important;
  background-image:linear-gradient(rgba(151,207,222,.10) 1px,transparent 1px),linear-gradient(90deg,rgba(151,207,222,.10) 1px,transparent 1px)!important;
}
.room-page .audio,.room-page .audio:nth-child(3n),.room-page .audio:nth-child(3n+2){
  background:linear-gradient(145deg,#77afc0 0%,#3f7f94 100%)!important;
  border-color:rgba(205,242,248,.36)!important;
}

/* solid clean fog-blue panels */
.room-page .topbar{background:#143441!important;}
.room-page .sidebar,.room-page .chat{background:#12313d!important;}
.room-page .editor>div>.glass,.room-page .timeline{background:#163b49!important;}
.room-page .sidebar:after,.room-page .chat:after,.room-page .editor>div>.glass:after,.room-page .timeline:after,.room-page .topbar:after{display:none!important;content:none!important;}
.room-page .track-row,.room-page .message,.room-page .stat{background:#173a47!important;}
.room-page .track-row:nth-child(even),.room-page .message:nth-child(even){background:#1a4250!important;}
.room-page .timeline-grid{background-color:#143845!important;}

/* final blue lift without brightness */
.room-page .topbar{background:#173b49!important;}
.room-page .sidebar,.room-page .chat{background:#183f4d!important;}
.room-page .editor>div>.glass,.room-page .timeline{background:#1a4757!important;}
.room-page .track-row,.room-page .message,.room-page .stat{background:#1d4b5b!important;}
.room-page .track-row:nth-child(even),.room-page .message:nth-child(even){background:#225769!important;}
.room-page .track-row input{background:#173b49!important;}
.room-page .timeline-grid{background-color:#1c4d5d!important;}

/* approved clean room palette: reference mockup applied */
body:has(.room-page){
  background:#020707!important;
  background-image:
    radial-gradient(circle at 76% 24%,rgba(118,159,171,.17),transparent 28rem),
    radial-gradient(circle at 18% 82%,rgba(118,159,171,.08),transparent 24rem),
    radial-gradient(rgba(210,232,238,.16) 1px,transparent 1px),
    linear-gradient(180deg,#020707 0%,#050909 52%,#020606 100%)!important;
  background-size:100% 100%,100% 100%,28px 28px,100% 100%!important;
}
.room-page{
  background:transparent!important;
}
.room-page:before,.room-page:after{display:none!important;content:none!important;}
.room-page .glass:after{display:none!important;content:none!important;}
.room-page .topbar{
  background:linear-gradient(135deg,#dceff4 0%,#aac9d3 48%,#81a9b8 100%)!important;
  border:1px solid rgba(255,255,255,.58)!important;
  box-shadow:0 24px 64px rgba(0,0,0,.30),inset 0 1px 0 rgba(255,255,255,.62)!important;
  backdrop-filter:none!important;
}
.room-page .sidebar,.room-page .chat{
  background:linear-gradient(145deg,#f7fbfb 0%,#dfe8e8 58%,#b9c9cb 100%)!important;
  border:1px solid rgba(255,255,255,.66)!important;
  box-shadow:0 24px 64px rgba(0,0,0,.30),inset 0 1px 0 rgba(255,255,255,.72)!important;
  backdrop-filter:none!important;
}
.room-page .editor>div>.glass,.room-page .timeline{
  background:linear-gradient(145deg,#9ab9c4 0%,#7fa4b2 48%,#678b99 100%)!important;
  border:1px solid rgba(216,238,243,.48)!important;
  box-shadow:0 24px 64px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.30)!important;
  backdrop-filter:none!important;
}
.room-page .timeline-grid{
  background-color:rgba(120,159,174,.70)!important;
  background-image:
    linear-gradient(rgba(216,238,243,.23) 1px,transparent 1px),
    linear-gradient(90deg,rgba(216,238,243,.23) 1px,transparent 1px)!important;
  background-size:100% 72px,72px 100%!important;
}
.room-page .track-row,.room-page .message,.room-page .stat{
  background:#edf4f5!important;
  border:1px solid rgba(255,255,255,.78)!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.62)!important;
}
.room-page .track-row:nth-child(even),.room-page .message:nth-child(even){
  background:#e4eef0!important;
}
.room-page .track-row input{
  background:#c9dee5!important;
  border:1px solid rgba(255,255,255,.74)!important;
  color:#13252b!important;
}
.room-page .track-row input:hover,.room-page .track-row input:focus{
  background:#bdd6df!important;
  border-color:rgba(255,255,255,.88)!important;
  box-shadow:0 0 0 3px rgba(129,169,184,.18)!important;
}
.room-page .btn,.room-page .btn.primary,.room-page label.btn{
  background:#ffffff!important;
  color:#111820!important;
  border:1px solid rgba(255,255,255,.90)!important;
  box-shadow:0 14px 30px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.92)!important;
  backdrop-filter:none!important;
}
.room-page .btn:hover{background:#f8fbfb!important;transform:translateY(-1px);}
.room-page .audio,.room-page .audio:nth-child(3n),.room-page .audio:nth-child(3n+2){
  background:linear-gradient(145deg,rgba(233,245,247,.80),rgba(174,205,215,.74))!important;
  border:1px solid rgba(255,255,255,.62)!important;
  color:#31515d!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.64),0 10px 24px rgba(0,0,0,.18)!important;
}
.room-page .field{
  background:#eef5f6!important;
  border:1px solid rgba(255,255,255,.74)!important;
  color:#17252b!important;
}
.room-page .field::placeholder{color:#7c9198!important;}
.room-page .avatar,.room-page .avatar:nth-child(2),.room-page .avatar:nth-child(3){
  background:linear-gradient(135deg,#e6f6fa,#a7cfdb)!important;
  color:#13252b!important;
  border-color:rgba(255,255,255,.72)!important;
  box-shadow:0 8px 18px rgba(0,0,0,.16)!important;
}
.room-page .sidebar h2,.room-page .chat h2{color:#17252b!important;text-shadow:none!important;}
.room-page .sidebar .muted,.room-page .chat .muted{color:#78909a!important;}
.room-page .track-row b,.room-page .message b,.room-page .track-row strong,.room-page .message strong{color:#13252b!important;}
.room-page .track-row .muted,.room-page .message .muted,.room-page .rename-hint{color:#60747c!important;}
.room-page .topbar h1,.room-page .timeline h2,.room-page .editor>div>.glass .muted,.room-page .timeline .muted{color:#fff!important;text-shadow:none!important;}
.room-page .topbar .muted,.room-page .topbar .status{color:#eef8fa!important;}
.room-page .editor>div>.glass span.muted{color:#eef8fa!important;}
@media(max-width:900px){.hero,.dashboard-grid,.editor{grid-template-columns:1fr}.cards,.grid3,.workflow-steps{grid-template-columns:1fr}.workflow-step{border-left:0;border-top:1px dashed rgba(255,255,255,.24);padding:22px 0}.workflow-step:first-child{border-top:0}.links{display:none}.wrap{padding:44px 16px}.hero-panel{min-height:360px}.topbar{display:block}.footer{display:block}.editor{padding:10px}}
/* absolute final room style override */
.room-page .sidebar,.room-page .chat{background:linear-gradient(145deg,#f7fbfb 0%,#dfe8e8 58%,#b9c9cb 100%)!important;color:#17252b!important;border:1px solid rgba(255,255,255,.66)!important;box-shadow:0 24px 64px rgba(0,0,0,.30),inset 0 1px 0 rgba(255,255,255,.72)!important;}
.room-page .sidebar h2,.room-page .chat h2{color:#17252b!important;}
.room-page .sidebar .muted,.room-page .chat .muted{color:#78909a!important;}
.room-page .track-row,.room-page .message,.room-page .stat{background:#edf4f5!important;color:#13252b!important;border:1px solid rgba(255,255,255,.78)!important;}
.room-page .track-row:nth-child(even),.room-page .message:nth-child(even){background:#e4eef0!important;}
.room-page .track-row input{background:#c9dee5!important;color:#13252b!important;border:1px solid rgba(255,255,255,.74)!important;}
.room-page .track-row b,.room-page .message b{color:#13252b!important;}
.room-page .track-row .muted,.room-page .message .muted,.room-page .rename-hint{color:#60747c!important;}
.room-page .topbar{background:linear-gradient(135deg,#dceff4 0%,#aac9d3 48%,#81a9b8 100%)!important;color:#fff!important;}
.room-page .editor>div>.glass,.room-page .timeline{background:linear-gradient(145deg,#9ab9c4 0%,#7fa4b2 48%,#678b99 100%)!important;}
.room-page .btn,.room-page .btn.primary,.room-page label.btn{background:#fff!important;color:#111820!important;}
`;

const icon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>`;

function layout(title, body, script = "") {
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title><style>${baseCss}</style></head><body>${body}${script}</body></html>`;
}

function nav() {
  return `<header class="nav"><div class="nav-inner"><a class="brand" href="/"><span class="logo">${icon}</span><span><b>CollabMuse</b><br><small style="color:rgba(255,255,255,.5)">Event-based music rooms</small></span></a><div class="links"><a href="/#features">Features</a><a href="/#workflow">Workflow</a><a href="/dashboard">Dashboard</a></div><a class="btn" href="/dashboard">Open workspace</a></div></header>`;
}

function home() {
  return layout("CollabMuse", `${nav()}<main><section class="wrap hero"><div><div class="eyebrow">Collaborative editing · no live audio streaming</div><h1 class="h1">Real-time collaborative music composition.</h1><p class="lead">CollabMuse is a shared workspace for music projects. Create rooms, upload audio clips, edit tracks together, chat, and keep every client aligned through synchronized user actions instead of difficult raw audio streaming.</p><div class="actions"><a class="btn primary" href="/dashboard">Open dashboard</a><a class="btn" href="/room/${demoRoom.id}">Enter demo room</a></div></div><div class="glass hero-panel"><div class="panel-head"><div><small class="muted">Room active</small><h3>Midnight Sketch</h3></div><span class="tag">events synced</span></div><div class="lanes">${["Drums","Bass","Keys","Vocal"].map((n,i)=>`<div class="lane"><span>${n}</span><div class="track-preview"><i class="clip-preview" style="left:${10+i*5}%;width:22%"></i><i class="clip-preview" style="left:${42+i*4}%;width:26%"></i><i class="clip-preview" style="left:${70-i*2}%;width:18%"></i></div></div>`).join("")}</div></div></section><section id="features" class="wrap"><p class="muted">Core features</p><h2 class="section-title">Built around event-based collaboration.</h2><div class="cards">${["Collaboration rooms","Clip management","Event-based sync","Room chat"].map((h,i)=>`<div class="glass card"><h3 class="feature-title"><span class="feature-icon">${[`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12.2l3.1-3.1c.8-.8 2-.9 2.9-.2l1.2.9"/><path d="M19.5 12.2l-3.1-3.1c-.8-.8-2-.9-2.9-.2l-4.2 3.2c-.6.5-.7 1.3-.2 1.9.5.6 1.3.7 1.9.3l2.1-1.5"/><path d="M8.4 14.1l2.6 2.5c.8.8 2.1.8 2.9 0l1.7-1.7"/><path d="M3.2 10.7l3.5 3.6"/><path d="M20.8 10.7l-3.5 3.6"/></svg>`,`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2"/></svg>`,`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="7" r="2.2"/><circle cx="18" cy="7" r="2.2"/><circle cx="12" cy="17" r="2.2"/><path d="M8.2 8.2l2.6 6.4"/><path d="M15.8 8.2l-2.6 6.4"/><path d="M8.6 7h6.8"/></svg>`,`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8.7c0-2 1.8-3.7 4-3.7h6c2.2 0 4 1.7 4 3.7v3.1c0 2-1.8 3.7-4 3.7h-3.5L7 19v-3.5c-1.2-.6-2-1.9-2-3.4V8.7z"/></svg>`][i]}</span>${h}</h3><p class="muted">${["Create focused music rooms where collaborators join the same project state.","Upload, name, organise and reuse short audio clips.","Synchronise clip moves, track edits and timeline changes.","Keep creative decisions beside the timeline."][i]}</p></div>`).join("")}</div></section><section id="workflow" class="wrap"><div class="glass card"><p class="muted">How it works</p><h2 class="section-title">A simple collaboration loop for remote music creation.</h2><div class="workflow-steps">${["Create a room","Add clips and tracks","Sync actions"].map((h,i)=>`<div class="workflow-step"><b>0${i+1}</b><h3>${h}</h3><p class="muted">Share project changes as lightweight room events, so every collaborator stays aligned without streaming raw live audio.</p></div>`).join("")}</div></div></section><footer class="footer"><span>CollabMuse · Collaborative music workspace</span><span>Event synchronization focus · no raw live audio streaming</span></footer></main>`);
}

function dashboard() {
  return layout("Dashboard", `${nav()}<main class="wrap"><p class="muted">Workspace</p><h1 class="h1" style="font-size:52px">Music rooms dashboard</h1><p class="lead">Create collaboration rooms and jump into live synchronized project workspaces.</p><div class="formline"><input id="roomName" class="field" placeholder="New room name" value="Untitled Session"/><button id="createRoom" class="btn primary">Create room</button></div><div class="dashboard-grid" style="margin-top:28px"><div class="glass card"><h2>Recent rooms</h2><div id="rooms" class="grid3"></div></div><aside class="glass card"><h2>Live demo scope</h2>${["Room creation: Ready","Room chat: Ready","Track rename sync: Ready","Clip upload metadata: Ready","Drag-to-move clips: Ready"].map(x=>`<div class="track-row">${x}</div>`).join("")}</aside></div></main>`, `<script>${dashboardScript()}</script>`);
}

function dashboardScript() {
  return `
async function loadRooms(){
  const rooms = await fetch('/api/rooms').then(r=>r.json());
  document.getElementById('rooms').innerHTML = rooms.map((room, index) => '<a class="glass room-card" href="/room/'+room.id+'"><small class="muted">'+(index===0?'Active workspace':'Recent room')+'</small><h3>'+room.name+'</h3><p class="muted">'+room.tracks+' tracks · '+room.clips+' clips</p><div class="avatars"><span class="avatar">ZZ</span><span class="avatar">FC</span><span class="avatar">LM</span></div></a>').join('');
}
document.getElementById('createRoom').addEventListener('click', async () => {
  const name = document.getElementById('roomName').value.trim() || 'Untitled Session';
  const room = await fetch('/api/rooms', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ name }) }).then(r=>r.json());
  location.href = '/room/' + room.id;
});
loadRooms();
`;
}

function roomPage(roomId) {
  const room = rooms.get(roomId) ?? demoRoom;
  return layout(room.name, `<main class="room-page"><div class="glass topbar" style="background:linear-gradient(135deg,#dceff4 0%,#aac9d3 48%,#81a9b8 100%) !important;border:1px solid rgba(255,255,255,.58) !important;"><div><a href="/dashboard" class="btn">Back</a><h1 id="roomTitle">${room.name}</h1><p class="muted">Demo room online · Event sync active</p><p id="status" class="status">Connected locally</p></div><div class="avatars"><span class="avatar">ZZ</span><span class="avatar">FC</span><span class="avatar">LM</span></div></div><section class="editor"><aside class="glass sidebar" style="background:linear-gradient(145deg,#f7fbfb 0%,#dfe8e8 58%,#b9c9cb 100%) !important;color:#17252b !important;border:1px solid rgba(255,255,255,.66) !important;"><p class="muted">Tracks</p><h2 style="color:#17252b !important;">Arrangement</h2><div id="tracks"></div></aside><div><div class="glass card" style="margin-bottom:16px;background:linear-gradient(145deg,#9ab9c4 0%,#7fa4b2 48%,#678b99 100%) !important;border:1px solid rgba(216,238,243,.48) !important;"><button class="btn primary">Play</button><label class="btn">Upload audio<input id="upload" type="file" accept="audio/*" hidden></label><button id="addTrack" class="btn">Add track</button><span class="muted" style="margin-left:12px">92 BPM · 4/4 · Events only</span><p class="status">Drag clips horizontally to broadcast move events.</p></div><section class="glass timeline" style="background:linear-gradient(145deg,#9ab9c4 0%,#7fa4b2 48%,#678b99 100%) !important;border:1px solid rgba(216,238,243,.48) !important;"><p class="muted">Timeline</p><h2>Shared event canvas</h2><div id="timeline" class="timeline-grid"></div></section></div><aside class="glass chat" style="background:linear-gradient(145deg,#f7fbfb 0%,#dfe8e8 58%,#b9c9cb 100%) !important;color:#17252b !important;border:1px solid rgba(255,255,255,.66) !important;"><p class="muted">Room chat</p><h2 style="color:#17252b !important;">Creative notes</h2><div id="messages"></div><div class="formline"><input id="messageInput" class="field" placeholder="Write a room note..."/><button id="sendMessage" class="btn">Send</button></div></aside></section></main>`, `<script>window.__ROOM_ID__=${JSON.stringify(room.id)};${roomScript()}</script>`);
}

function roomScript() {
  return `
let state;
const roomId = window.__ROOM_ID__;
const statusEl = document.getElementById('status');

async function api(path, body) {
  return fetch(path, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) }).then(r=>r.json());
}

async function loadRoom() {
  state = await fetch('/api/rooms/' + roomId).then(r=>r.json());
  render();
}

function render() {
  document.getElementById('roomTitle').textContent = state.name;
  document.getElementById('tracks').innerHTML = state.tracks.map((track, index) => '<div class="track-row"><input data-track="'+track.id+'" value="'+escapeHtml(track.name)+'" title="Edit track name" aria-label="Edit track name"/><small class="muted">'+state.clips.filter(c=>c.trackId===track.id).length+' clips synced</small><span class="rename-hint">click name to rename</span></div>').join('');
  document.querySelectorAll('[data-track]').forEach(input => {
    input.addEventListener('blur', () => saveTrackName(input));
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        input.blur();
      }
    });
  });
  if (window.__FOCUS_TRACK_ID__) {
    const focusInput = document.querySelector('[data-track=\"' + window.__FOCUS_TRACK_ID__ + '\"]');
    if (focusInput) { focusInput.focus(); focusInput.select(); }
    window.__FOCUS_TRACK_ID__ = '';
  }
  document.getElementById('timeline').innerHTML = state.clips.map(clip => {
    const row = Math.max(0, state.tracks.findIndex(t=>t.id===clip.trackId));
    return '<div class="audio" data-clip="'+clip.id+'" style="left:'+clip.start+'%;top:'+(70+row*72)+'px;width:'+clip.width+'%">'+escapeHtml(clip.name)+'</div>';
  }).join('');
  bindDrag();
  document.getElementById('messages').innerHTML = state.messages.map(m => '<div class="message"><b>'+escapeHtml(m.author)+'</b><small class="muted" style="float:right">'+escapeHtml(m.time)+'</small><p class="muted">'+escapeHtml(m.text)+'</p></div>').join('');
  document.getElementById('messages').scrollTop = 9999;
}

async function saveTrackName(input) {
  const name = input.value.trim() || 'Untitled track';
  input.value = name;
  state = await api('/api/rooms/' + roomId + '/track', { trackId: input.dataset.track, name });
  render();
}

function bindDrag() {
  document.querySelectorAll('.audio').forEach(el => {
    let startX = 0;
    let startLeft = 0;
    el.onpointerdown = (event) => {
      el.setPointerCapture(event.pointerId);
      startX = event.clientX;
      startLeft = parseFloat(el.style.left);
      el.style.cursor = 'grabbing';
    };
    el.onpointermove = (event) => {
      if (!el.hasPointerCapture(event.pointerId)) return;
      const delta = ((event.clientX - startX) / el.parentElement.clientWidth) * 100;
      const next = Math.max(0, Math.min(88, startLeft + delta));
      el.style.left = next + '%';
    };
    el.onpointerup = async (event) => {
      if (!el.hasPointerCapture(event.pointerId)) return;
      el.releasePointerCapture(event.pointerId);
      el.style.cursor = 'grab';
      await api('/api/rooms/' + roomId + '/clip/move', { clipId: el.dataset.clip, start: parseFloat(el.style.left) });
    };
  });
}

document.getElementById('sendMessage').addEventListener('click', async () => {
  const input = document.getElementById('messageInput');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  await api('/api/rooms/' + roomId + '/message', { author:'Ziyi', text });
});
document.getElementById('messageInput').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') document.getElementById('sendMessage').click();
});
document.getElementById('upload').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const firstTrack = state.tracks[0]?.id || 'drums';
  await api('/api/rooms/' + roomId + '/clip', { name:file.name.replace(/\\.[^.]+$/, ''), size:file.size, type:file.type, trackId:firstTrack });
  event.target.value = '';
});
document.getElementById('addTrack').addEventListener('click', async () => {
  const room = await api('/api/rooms/' + roomId + '/track/add', { name:'New track' });
  window.__FOCUS_TRACK_ID__ = room.tracks[room.tracks.length - 1].id;
  state = room;
  render();
});

const events = new EventSource('/api/rooms/' + roomId + '/events');
events.addEventListener('open', () => statusEl.textContent = 'Realtime event channel connected');
events.addEventListener('update', async () => {
  statusEl.textContent = 'Received synchronized room event';
  if (document.activeElement?.matches('[data-track]')) return;
  await loadRoom();
});
events.onerror = () => statusEl.textContent = 'Realtime channel reconnecting...';

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
}

loadRoom();
`;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${port}`);

  if (url.pathname === "/waveform-panel.png") {
    const img = fs.readFileSync(path.join(process.cwd(), "public/waveform-panel.png"));
    res.writeHead(200, { "Content-Type": "image/png" });
    res.end(img);
    return;
  }

  if (url.pathname === "/api/rooms" && req.method === "GET") {
    sendJson(res, listRooms());
    return;
  }

  if (url.pathname === "/api/rooms" && req.method === "POST") {
    const body = await readBody(req);
    sendJson(res, makeRoom(body.name || "Untitled Session"));
    return;
  }

  const match = url.pathname.match(/^\/api\/rooms\/([^/]+)(?:\/(.*))?$/);
  if (match) {
    const roomId = match[1];
    const action = match[2] ?? "";
    const room = rooms.get(roomId);
    if (!room) {
      sendJson(res, { error: "Room not found" }, 404);
      return;
    }

    if (!action && req.method === "GET") {
      sendJson(res, room);
      return;
    }

    if (action === "events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write(`event: update\ndata: ${JSON.stringify({ type: "connected" })}\n\n`);
      if (!clients.has(roomId)) clients.set(roomId, new Set());
      clients.get(roomId).add(res);
      req.on("close", () => clients.get(roomId)?.delete(res));
      return;
    }

    const body = await readBody(req);
    if (action === "message") {
      room.messages.push({
        author: body.author || "Ziyi",
        text: body.text || "",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
      broadcast(roomId, { type: "message" });
      sendJson(res, room);
      return;
    }
    if (action === "track") {
      const track = room.tracks.find((item) => item.id === body.trackId);
      if (track) track.name = body.name || track.name;
      broadcast(roomId, { type: "track-renamed" });
      sendJson(res, room);
      return;
    }
    if (action === "track/add") {
      const id = `t${Date.now().toString(36)}`;
      room.tracks.push({ id, name: body.name || "New track" });
      broadcast(roomId, { type: "track-added" });
      sendJson(res, room);
      return;
    }
    if (action === "clip") {
      const id = `c${Date.now().toString(36)}`;
      room.clips.push({
        id,
        trackId: body.trackId || room.tracks[0].id,
        name: body.name || "Uploaded clip",
        start: 10 + (room.clips.length % 4) * 14,
        width: 18,
        size: body.size,
        type: body.type,
      });
      broadcast(roomId, { type: "clip-uploaded" });
      sendJson(res, room);
      return;
    }
    if (action === "clip/move") {
      const clip = room.clips.find((item) => item.id === body.clipId);
      if (clip) clip.start = Math.max(0, Math.min(88, Number(body.start) || 0));
      broadcast(roomId, { type: "clip-moved" });
      sendJson(res, room);
      return;
    }
  }

  if (url.pathname.startsWith("/dashboard")) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(dashboard());
    return;
  }

  if (url.pathname.startsWith("/room/")) {
    const roomId = url.pathname.split("/")[2] || demoRoom.id;
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(roomPage(roomId));
    return;
  }

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(home());
});

server.listen(port, () => {
  console.log(`static-preview-server running at http://localhost:${port}`);
});
