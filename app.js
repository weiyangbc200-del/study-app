/***********************
 *  戰力診斷系統 Web版
 *  - GitHub Pages 可直接跑
 *  - 資料存 localStorage
 *
 *  ✅ 目標系統：
 *   - 長期目標（含截止日）：行政學/政治學...
 *   - 每日目標（每日刷新）：刷題/背單字...
 *   - 全部可在 Settings 自訂新增/編輯/刪除
 *
 *  ✅ 主色調 Theme：
 *   - 使用者可自選 accent 色（套用到 CSS 變數 --cyan）
 *   - 可嘗試「從背景抓平均色」做自動配色（可能遇到跨域限制）
 ************************/

/** ========= Storage Keys ========= */
const K = {
  // legacy
  goals: "goals",
  law: "lawScore",
  vocab: "vocabCount",

  wake: "wakeTime",
  sleep: "sleepTime",
  events: "events",
  done: "pomodoroDone",
  failed: "pomodoroFailed",
  lastReset: "lastResetDate",
  dailyLogs: "dailyLogs",
  apiKey: "apiKey",
  bgURL: "bgURL",
  reportMsg: "reportMsg",
  analysisTime: "analysisTime",
  focusMsg: "focusMsg",

  // new goal system
  longGoals: "longGoals",
  dailyGoals: "dailyGoals",
  dailyGoalProgress: "dailyGoalProgress", // {YYYYMMDD: {goalId: number}}
  examDate: "examDate", // used for D- counter (user-settable)

  // theme
  theme: "theme", // {accent:"#00e5ff", mode:"manual"|"auto"}
};

/** ========= Default Data ========= */
const DEFAULTS = {
  longGoals: [
    { id: crypto.randomUUID(), title: "行政法", total: 50, completed: 0, deadline: "2026-01-31" },
    { id: crypto.randomUUID(), title: "政治學", total: 30, completed: 0, deadline: "2026-01-31" },
    { id: crypto.randomUUID(), title: "行政學", total: 40, completed: 0, deadline: "2026-01-31" },
    { id: crypto.randomUUID(), title: "公共政策", total: 20, completed: 0, deadline: "2026-01-31" },
  ],
  dailyGoals: [
    { id: crypto.randomUUID(), title: "法學緒論刷題", target: 100, step: 25, unit: "題" },
    { id: crypto.randomUUID(), title: "英文刷題", target: 100, step: 10, unit: "題" },
  ],
  dailyGoalProgress: {},

  wakeTime: "07:00",
  sleepTime: "23:30",
  events: [],
  pomodoroDone: 0,
  pomodoroFailed: 0,
  dailyLogs: {}, // {YYYYMMDD: {score, summary, characterAnalysis, goalSnapshot?}}
  apiKey: "",
  bgURL: "https://images.unsplash.com/photo-1542051841857-5f90071e7989?q=80&w=2070",
  reportMsg: "戰略報告準備中...",
  analysisTime: "",
  focusMsg: "全職考生，你沒有退路。",

  examDate: "2026-01-31",
  theme: { accent: "#00e5ff", mode: "manual" },
};

/** ========= App State ========= */
const state = {
  tab: "dashboard",
  selectedDate: new Date(),
  reflection: "",
  activeTaskFromSchedule: "",

  // timer
  isFocusing: false,
  totalTime: 1500,
  timeLeft: 1500,
  timerId: null,
  focusStartTime: null,
  focusTaskName: "",
  isReportLoading: false,

  // persistent focus session
  focusSession: null,
};

/** ========= Load / Save ========= */
function loadJSON(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    if(!raw) return fallback;
    return JSON.parse(raw);
  }catch{ return fallback; }
}
function saveJSON(key, value){
  localStorage.setItem(key, JSON.stringify(value));
}
function loadStr(key, fallback=""){
  const v = localStorage.getItem(key);
  return (v === null || v === undefined) ? fallback : v;
}
function loadNum(key, fallback=0){
  const v = Number(localStorage.getItem(key));
  return Number.isFinite(v) ? v : fallback;
}

const data = {
  // NEW goal system
  longGoals: loadJSON(K.longGoals, null),
  dailyGoals: loadJSON(K.dailyGoals, null),
  dailyGoalProgress: loadJSON(K.dailyGoalProgress, DEFAULTS.dailyGoalProgress),
  examDate: loadStr(K.examDate, DEFAULTS.examDate),

  // rest
  wakeTime: loadStr(K.wake, DEFAULTS.wakeTime),
  sleepTime: loadStr(K.sleep, DEFAULTS.sleepTime),
  events: loadJSON(K.events, DEFAULTS.events),
  pomodoroDone: loadNum(K.done, DEFAULTS.pomodoroDone),
  pomodoroFailed: loadNum(K.failed, DEFAULTS.pomodoroFailed),
  dailyLogs: loadJSON(K.dailyLogs, DEFAULTS.dailyLogs),
  apiKey: loadStr(K.apiKey, DEFAULTS.apiKey),
  bgURL: loadStr(K.bgURL, DEFAULTS.bgURL),
  reportMsg: loadStr(K.reportMsg, DEFAULTS.reportMsg),
  analysisTime: loadStr(K.analysisTime, DEFAULTS.analysisTime),
  focusMsg: loadStr(K.focusMsg, DEFAULTS.focusMsg),

  theme: loadJSON(K.theme, DEFAULTS.theme),

  // legacy for migration
  legacyGoals: loadJSON(K.goals, null),
  legacyLaw: loadNum(K.law, 0),
  legacyVocab: loadNum(K.vocab, 0),
};

function persistAll(){
  saveJSON(K.longGoals, data.longGoals);
  saveJSON(K.dailyGoals, data.dailyGoals);
  saveJSON(K.dailyGoalProgress, data.dailyGoalProgress);
  localStorage.setItem(K.examDate, data.examDate);

  localStorage.setItem(K.wake, data.wakeTime);
  localStorage.setItem(K.sleep, data.sleepTime);
  saveJSON(K.events, data.events);

  localStorage.setItem(K.done, String(data.pomodoroDone));
  localStorage.setItem(K.failed, String(data.pomodoroFailed));
  saveJSON(K.dailyLogs, data.dailyLogs);

  localStorage.setItem(K.apiKey, data.apiKey);
  localStorage.setItem(K.bgURL, data.bgURL);
  localStorage.setItem(K.reportMsg, data.reportMsg);
  localStorage.setItem(K.analysisTime, data.analysisTime);
  localStorage.setItem(K.focusMsg, data.focusMsg);

  saveJSON(K.theme, data.theme);
}

/** ========= Date Helpers ========= */
function pad2(n){ return String(n).padStart(2,"0"); }
function dateKey(d){
  const y = d.getFullYear();
  const m = pad2(d.getMonth()+1);
  const day = pad2(d.getDate());
  return `${y}${m}${day}`;
}
function ymKey(d){
  const y = d.getFullYear();
  const m = pad2(d.getMonth()+1);
  return `${y}${m}`;
}
function startOfMonth(d){
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function daysInMonth(d){
  return new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();
}
function firstWeekdayOfMonth(d){
  return startOfMonth(d).getDay();
}
function addMonths(d, delta){
  return new Date(d.getFullYear(), d.getMonth()+delta, 1);
}
function sameDay(a,b){
  return a.getFullYear()===b.getFullYear()
    && a.getMonth()===b.getMonth()
    && a.getDate()===b.getDate();
}
function combineDateTime(baseDate, hhmm){
  const [hh, mm] = hhmm.split(":").map(Number);
  return new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), hh, mm, 0, 0);
}
function fmtTime(d){
  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  return `${hh}:${mm}`;
}
function fmtDateHuman(key){
  if(!key || key.length!==8) return key;
  return `${key.slice(0,4)}/${key.slice(4,6)}/${key.slice(6,8)}`;
}
function parseISODateOnly(yyyy_mm_dd){
  // safe local date (no timezone shift)
  const [y,m,d] = (yyyy_mm_dd || "").split("-").map(Number);
  if(!y || !m || !d) return null;
  return new Date(y, m-1, d, 0,0,0,0);
}
function daysUntil(yyyy_mm_dd){
  const target = parseISODateOnly(yyyy_mm_dd);
  if(!target) return null;
  const today = new Date();
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0,0,0,0);
  const diff = Math.ceil((target - base) / (1000*60*60*24));
  return diff;
}

/** ========= Daily reset (pomodoro counts) ========= */
function checkDailyReset(){
  const today = dateKey(new Date());
  const last = loadStr(K.lastReset, "");
  if(last !== today){
    data.pomodoroDone = 0;
    data.pomodoroFailed = 0;
    localStorage.setItem(K.lastReset, today);
    persistAll();
  }
}

/** ========= Events helpers ========= */
function normalizeEvents(){
  data.events = (data.events || []).map(e => ({
    id: e.id || crypto.randomUUID(),
    title: e.title || "未命名任務",
    date: e.date,
    endTime: e.endTime || null,
    type: e.type || "Study",
    isDone: !!e.isDone,
  }));
}
function getEventsForDay(dayDate){
  const key = dateKey(dayDate);
  return data.events
    .filter(e => dateKey(new Date(e.date)) === key)
    .sort((a,b)=> new Date(a.date) - new Date(b.date));
}
function upsertEvent(evt){
  const idx = data.events.findIndex(x => x.id === evt.id);
  if(idx >= 0) data.events[idx] = evt;
  else data.events.unshift(evt);
  persistAll();
}
function deleteEvent(id){
  data.events = data.events.filter(e => e.id !== id);
  persistAll();
}

/** ========= Minimal markdown renderer (bold + line breaks) ========= */
function mdToHtml(s){
  if(!s) return "";
  const esc = s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const bolded = esc.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  return bolded.replace(/\n/g, "<br/>");
}

/** ========= Gemini API ========= */
async function geminiGenerate(prompt){
  const key = (data.apiKey || "").trim();
  if(!key) throw new Error("API Key is empty");

  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });

  if(!res.ok){
    const t = await res.text().catch(()=> "");
    throw new Error(`Gemini request failed: ${res.status} ${t}`);
  }

  const json = await res.json();
  return json?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function fetchFocusJab(reason){
  try{
    const now = new Date();
    const timeStr = now.toLocaleString("zh-TW", { hour12:false });
    const prompt =
      `身分：高冷嚴厲教官。分析時間：${timeStr}。任務狀態：${reason}。成功：${data.pomodoroDone}。請給予一句 20 字內的反饋（請使用 Markdown **粗體**）。`;

    const msg = await geminiGenerate(prompt);
    data.focusMsg = msg || data.focusMsg;
    persistAll();
    render();
  }catch(err){
    data.focusMsg = `**（AI 連線失敗）** 先把下一個 25 分鐘跑完。`;
    persistAll();
    render();
  }
}

/** ========= Goal helpers ========= */
function todayKey(){
  return dateKey(new Date());
}
function getDailyProgressFor(dateK){
  return data.dailyGoalProgress?.[dateK] || {};
}
function getTodayDailyProgress(){
  return getDailyProgressFor(todayKey());
}
function setDailyProgress(dateK, goalId, value){
  if(!data.dailyGoalProgress) data.dailyGoalProgress = {};
  if(!data.dailyGoalProgress[dateK]) data.dailyGoalProgress[dateK] = {};
  data.dailyGoalProgress[dateK][goalId] = Math.max(0, Number(value || 0));
  saveJSON(K.dailyGoalProgress, data.dailyGoalProgress);
}

/** ========= Dashboard report input builder ========= */
function buildGoalStatusText(){
  const tKey = todayKey();
  const dp = getDailyProgressFor(tKey);

  const dailyLines = (data.dailyGoals || []).map(g=>{
    const v = Number(dp?.[g.id] || 0);
    const target = Number(g.target || 0);
    const pct = target > 0 ? Math.min(100, Math.round((v/target)*100)) : 0;
    return `- ${g.title}：${v}/${target}${g.unit||""}（${pct}%）`;
  }).join("\n");

  const longLines = (data.longGoals || []).map(g=>{
    const total = Number(g.total || 0);
    const done = Number(g.completed || 0);
    const ddl = g.deadline || data.examDate || "";
    const left = daysUntil(ddl);
    const pct = total > 0 ? Math.min(100, Math.round((done/total)*100)) : 0;
    const leftText = (left === null) ? "（無截止日）" : (left >= 0 ? `（D-${left}）` : `（已過期 ${Math.abs(left)} 天）`);
    return `- ${g.title}：${done}/${total}（${pct}%） 截止：${ddl || "未設定"} ${leftText}`;
  }).join("\n");

  return {
    dailyLines: dailyLines || "（無每日目標）",
    longLines: longLines || "（無長期目標）",
  };
}

function buildHistLog(days=5){
  const cal = new Date();
  let out = [];
  for(let i=1;i<=days;i++){
    const d = new Date(cal);
    d.setDate(d.getDate()-i);
    const k = dateKey(d);
    out.push(`${fmtDateHuman(k)}：${data.dailyLogs?.[k]?.summary || "無"}`);
  }
  return out.join("；");
}

async function fetchDashboardReport(){
  const trimmedKey = (data.apiKey || "").trim();
  if(!trimmedKey) return;

  state.isReportLoading = true;
  render();

  const now = new Date();
  const currentTimeStr = now.toLocaleString("zh-TW", { hour12:false });

  const todayK = todayKey();
  const todayDoneList = data.events
    .filter(e => dateKey(new Date(e.date)) === todayK && e.isDone)
    .map(e => e.title)
    .join(", ");

  const histLog = buildHistLog(5);
  const goalStatus = buildGoalStatusText();

  const prompt = `
【身分】高考全職考生，28歲，之前賺的存款都快花光了。
【分析當下時間】：${currentTimeStr}

【今日任務完成】完課：${todayDoneList || "（無）"}。
【番茄鐘】專注成功：${data.pomodoroDone}。失敗：${data.pomodoroFailed}。

【每日目標（今日進度）】
${goalStatus.dailyLines}

【長期目標（總進度 & 截止日）】
${goalStatus.longLines}

【使用者本日反思】：${state.reflection?.trim() ? state.reflection.trim() : "（無）"}
【歷史校正資料】：${histLog}。

【要求】：
1. 產出 220 字內深度學習診斷。必須把「每日目標達成度」與「長期目標進度/風險」納入評估。Markdown **粗體** 關鍵字。
2. 回應使用者的「本日反思」並對話。
3. 進行性格與習性分析（不超過100字）。
4. 依據時間給出具體下一步（可執行、可量化）。
5. 會參考過去五天的 histLog 給予整體回饋，避免只看一天。
【結尾格式】：
SCORE: [0-100]
LOG: [50字今日總結]
CHAR: [性格習性分析，不超過100字]
`.trim();

  try{
    const fullMsg = await geminiGenerate(prompt);

    let reportText = fullMsg;
    let score = 0, log = "", char = "尚無分析資料。";

    const parts = fullMsg.split("SCORE:");
    reportText = parts[0]?.trim() || fullMsg;

    if(parts.length > 1){
      const scComp = parts[1].split("LOG:");
      score = parseInt((scComp[0] || "0").trim(), 10) || 0;

      if(scComp.length > 1){
        const logComp = scComp[1].split("CHAR:");
        log = (logComp[0] || "").trim();
        if(logComp.length > 1) char = (logComp[1] || "").trim();
      }

      // save snapshot of goals for this day (optional but useful for history)
      const snapshot = {
        daily: getDailyProgressFor(todayK),
        long: (data.longGoals || []).map(g => ({ id:g.id, title:g.title, total:g.total, completed:g.completed, deadline:g.deadline })),
        examDate: data.examDate,
      };

      data.dailyLogs[todayK] = { score, summary: log, characterAnalysis: char, goalSnapshot: snapshot };
      saveJSON(K.dailyLogs, data.dailyLogs);
    }

    data.reportMsg = reportText;
    data.analysisTime = currentTimeStr;
    persistAll();

    state.reflection = "";
  }catch(err){
    data.reportMsg = "**（AI 連線失敗）** 先把今天最重要的兩件事做完，再回來提交。";
    persistAll();
  }finally{
    state.isReportLoading = false;
    render();
  }
}

/** ========= Theme ========= */
function applyTheme(){
  const theme = data.theme || DEFAULTS.theme;
  const accent = (theme.accent || DEFAULTS.theme.accent).trim();

  document.documentElement.style.setProperty("--cyan", accent);

  // 你 CSS 若有用其他衍生色（如 --cyanSoft），也可以在這裡加
  // document.documentElement.style.setProperty("--cyanSoft", accent + "AA");
}

/** attempt auto color from bg (may fail due to CORS) */
async function tryAutoThemeFromBg(){
  const url = (data.bgURL || "").trim();
  if(!url) throw new Error("no bg");

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.decoding = "async";

  const p = new Promise((resolve, reject)=>{
    img.onload = ()=> resolve();
    img.onerror = ()=> reject(new Error("image load failed"));
  });

  img.src = url;
  await p;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently:true });
  const w = 64, h = 64;
  canvas.width = w; canvas.height = h;
  ctx.drawImage(img, 0, 0, w, h);

  const { data: pixels } = ctx.getImageData(0,0,w,h);

  let r=0,g=0,b=0,count=0;
  for(let i=0;i<pixels.length;i+=4){
    const a = pixels[i+3];
    if(a < 10) continue;
    r += pixels[i];
    g += pixels[i+1];
    b += pixels[i+2];
    count++;
  }
  if(count <= 0) throw new Error("no pixels");

  r = Math.round(r/count);
  g = Math.round(g/count);
  b = Math.round(b/count);

  // slightly boost saturation/brightness-ish by nudging towards mid
  const hex = rgbToHex(r,g,b);
  data.theme = { accent: hex, mode: "auto" };
  persistAll();
  applyTheme();
}

function rgbToHex(r,g,b){
  const to = (n)=> n.toString(16).padStart(2,"0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** ========= UI Rendering ========= */
const elContent = document.getElementById("content");
const elTitle = document.getElementById("pageTitle");
const elSubtitle = document.getElementById("pageSubtitle");
const elTopbarRight = document.getElementById("topbarRight");
const elBg = document.getElementById("bg");

function setTab(tab){
  // leaving focus tab while running => arm auto-fail grace (kept from your pomodoro fix version if你有用那份)
  if(state.tab === "focus" && tab !== "focus"){
    if(state.focusSession?.status === "running"){
      armAway("切換頁籤");
    }
  }

  if(tab === "focus"){
    disarmAway();
    reconcileRunningClock();
  }

  state.tab = tab;
  render();
}

function renderTopbar(){
  const map = {
    calendar: ["日程規劃", "用月曆抓節奏，點選日期管理任務"],
    focus: ["專注模式", "開始就別停，全職考生沒有退路"],
    dashboard: ["戰力診斷中心", "提交反思 → 產出教官戰術報告"],
    history: ["學習與性格履歷", "用分數點亮你的月曆"],
    settings: ["設定", "API Key / 背景 / 目標 / 色調 / 資料管理"],
  };

  const [t, s] = map[state.tab] || ["", ""];
  elTitle.textContent = t;
  elSubtitle.textContent = s;

  // ✅ D- from user-config examDate
  const target = parseISODateOnly(data.examDate) || new Date(2026,0,31);
  const today = new Date();
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.ceil((target - base) / (1000*60*60*24));
  const daysLeft = Math.max(0, diff);
  elTopbarRight.innerHTML = `<span class="mono">D-${daysLeft}</span>`;
}

function renderTabbar(){
  document.querySelectorAll(".tabbar .tab").forEach(btn=>{
    btn.classList.toggle("active", btn.dataset.tab === state.tab);
    btn.onclick = ()=> setTab(btn.dataset.tab);
  });
}

function render(){
  applyTheme();

  elBg.style.backgroundImage = `url("${data.bgURL}")`;

  renderTopbar();
  renderTabbar();

  if(state.tab === "calendar") elContent.innerHTML = renderCalendar();
  if(state.tab === "focus") elContent.innerHTML = renderFocus();
  if(state.tab === "dashboard") elContent.innerHTML = renderDashboard();
  if(state.tab === "history") elContent.innerHTML = renderHistory();
  if(state.tab === "settings") elContent.innerHTML = renderSettings();

  bindDynamicHandlers();
}

/** ========= Calendar View ========= */
function renderCalendar(){
  const d = state.selectedDate;
  const monthLabel = `${d.getFullYear()}/${pad2(d.getMonth()+1)}`;
  const first = firstWeekdayOfMonth(d);
  const dim = daysInMonth(d);

  const weekdays = ["日","一","二","三","四","五","六"].map(x=>`<div class="weekday">${x}</div>`).join("");
  let cells = [];
  for(let i=0;i<first;i++) cells.push(`<div class="day empty"></div>`);
  for(let day=1; day<=dim; day++){
    const cellDate = new Date(d.getFullYear(), d.getMonth(), day);
    const isToday = sameDay(cellDate, new Date());
    const isSelected = sameDay(cellDate, state.selectedDate);
    const cls = ["day", isToday?"today":"", isSelected?"selected":""].filter(Boolean).join(" ");
    cells.push(`<div class="${cls}" data-day="${day}">${day}</div>`);
  }

  const selectedEvents = getEventsForDay(state.selectedDate);
  const tasksHtml = selectedEvents.length
    ? selectedEvents.map(e => {
        const st = new Date(e.date);
        const et = e.endTime ? new Date(e.endTime) : null;
        const timeRange = `${fmtTime(st)} - ${et ? fmtTime(et) : ""}`;
        const pill = e.type === "Study" ? `<span class="pill study">讀書</span>` : `<span class="pill life">生活</span>`;
        const titleCls = e.isDone ? "task-title done" : "task-title";
        const checkCls = e.isDone ? "check done" : "check";
        const playBtn = (e.type === "Study" && !e.isDone)
          ? `<button class="iconbtn play" data-action="play" data-id="${e.id}">▶</button>`
          : "";
        return `
          <div class="task">
            <div class="${checkCls}" data-action="toggleDone" data-id="${e.id}">${e.isDone ? "✓" : ""}</div>
            <div class="task-body" data-action="edit" data-id="${e.id}">
              <div class="${titleCls}">${escapeHtml(e.title)} ${pill}</div>
              <div class="task-meta">${timeRange}</div>
            </div>
            <div class="task-actions">
              ${playBtn}
              <button class="iconbtn" data-action="edit" data-id="${e.id}">編輯</button>
            </div>
          </div>
        `;
      }).join("")
    : `<div class="small">尚無日程。</div>`;

  return `
    <div class="card">
      <div class="row-between">
        <button class="btn" data-action="monthPrev">◀</button>
        <div class="mono" style="font-weight:900">${monthLabel}</div>
        <button class="btn" data-action="monthNext">▶</button>
      </div>

      <div class="calendar-grid" style="margin-top:12px;">
        ${weekdays}
      </div>
      <div class="calendar-grid">
        ${cells.join("")}
      </div>
    </div>

    <div class="card">
      <div class="row-between">
        <h3 style="margin:0">當日任務（${fmtDateHuman(dateKey(state.selectedDate))}）</h3>
        <button class="btn primary" data-action="addTask">＋ 新增</button>
      </div>

      <div style="margin-top:12px; display:flex; gap:10px;">
        <div class="card" style="margin:0; padding:12px; flex:1; background:var(--card2)">
          <div class="small">起床</div>
          <input class="input mono" id="wakeInput" value="${data.wakeTime}" />
        </div>
        <div class="card" style="margin:0; padding:12px; flex:1; background:var(--card2)">
          <div class="small">睡覺</div>
          <input class="input mono" id="sleepInput" value="${data.sleepTime}" />
        </div>
      </div>

      <div style="margin-top:12px; display:flex; gap:10px;">
        <button class="btn" data-action="saveWakeSleep">儲存起床/睡覺</button>
      </div>

      <div style="margin-top:14px; display:flex; flex-direction:column; gap:10px;">
        ${tasksHtml}
      </div>
    </div>
  `;
}

/** ========= Focus View ========= */
function renderFocus(){
  if(state.activeTaskFromSchedule){
    state.focusTaskName = state.activeTaskFromSchedule;
    state.activeTaskFromSchedule = "";
    if(state.focusSession){
      state.focusSession.taskName = state.focusTaskName;
      persistAll();
    }
  }

  if(state.focusSession){
    disarmAway();
    reconcileRunningClock();
  }

  const progress = state.totalTime > 0 ? (state.timeLeft / state.totalTime) : 0;
  const radius = 118;
  const circumference = 2 * Math.PI * radius;
  const dash = Math.max(0, Math.min(1, progress)) * circumference;

  const mm = Math.floor(state.timeLeft / 60);
  const ss = state.timeLeft % 60;
  const timeStr = `${mm}:${pad2(ss)}`;

  const hint = mdToHtml(data.focusMsg || "");

  return `
    <div class="card">
      <div class="centerText">
        <div class="small">現在要做什麼？</div>
        <input id="focusTaskName" class="input centerText" value="${escapeAttr(state.focusTaskName || "")}" placeholder="現在要做什麼？" />
      </div>
    </div>

    <div class="card">
      <div class="timerRing">
        <svg viewBox="0 0 260 260">
          <circle cx="130" cy="130" r="${radius}" stroke="rgba(255,255,255,0.08)" stroke-width="12" fill="none"></circle>
          <circle cx="130" cy="130" r="${radius}"
            stroke="var(--cyan)" stroke-width="12" fill="none"
            stroke-dasharray="${dash} ${circumference}"
            stroke-linecap="round"></circle>
        </svg>
        <div class="timerTime">${timeStr}</div>
      </div>

      <div class="centerText small" style="margin-top:10px;">
        <div style="color:var(--cyan); font-style:italic; line-height:1.6;">${hint || ""}</div>
      </div>

      <div class="row" style="justify-content:center; margin-top:14px;">
        <button class="btn" data-action="minus5" ${state.isFocusing ? "disabled" : ""}>-5分</button>
        <div class="mono" style="font-weight:900;">${Math.round(state.totalTime/60)} 分</div>
        <button class="btn" data-action="plus5" ${state.isFocusing ? "disabled" : ""}>+5分</button>
      </div>

      <div class="row" style="justify-content:center; margin-top:14px;">
        <button class="btn primary" data-action="toggleFocus">
          ${state.isFocusing ? "暫停" : "開始"}
        </button>
        <button class="btn danger" data-action="abandon">放棄</button>
      </div>

      <div class="small centerText" style="margin-top:12px;">
        成功：<b style="color:var(--good)">${data.pomodoroDone}</b>　
        失敗：<b style="color:var(--danger)">${data.pomodoroFailed}</b>
      </div>
    </div>
  `;
}

/** ========= Dashboard View ========= */
function renderDashboard(){
  const tKey = todayKey();
  const todayDone = data.events.filter(e => dateKey(new Date(e.date)) === tKey && e.isDone);
  const doneList = todayDone.length
    ? todayDone.map(e=>{
        const st = new Date(e.date);
        const et = e.endTime ? new Date(e.endTime) : null;
        return `
          <div class="row-between" style="padding:8px 0;">
            <div><b>${escapeHtml(e.title)}</b></div>
            <div class="small mono">${fmtTime(st)}${et?` - ${fmtTime(et)}`:""}</div>
          </div>
        `;
      }).join("")
    : `<div class="small">尚未完課。</div>`;

  const reportHtml = mdToHtml(data.reportMsg || "");
  const analysisTime = data.analysisTime ? `<span class="small mono">分析時間: ${escapeHtml(data.analysisTime)}</span>` : "";

  const dp = getDailyProgressFor(tKey);

  const dailyCounters = (data.dailyGoals || []).length
    ? (data.dailyGoals || []).map(g=>{
        const v = Number(dp?.[g.id] || 0);
        const total = Number(g.target || 0);
        const unit = g.unit || "";
        const step = Number(g.step || 1);
        return counterRowHtml(`${g.title}（每日）`, v, total, `daily:${g.id}`, step, unit);
      }).join("")
    : `<div class="small">尚無每日目標。請到「設定」新增。</div>`;

  const longCounters = (data.longGoals || []).length
    ? (data.longGoals || []).map(g=>{
        const ddl = g.deadline || data.examDate || "";
        const left = daysUntil(ddl);
        const leftText = (left === null) ? "" : (left >= 0 ? ` D-${left}` : ` 已過期${Math.abs(left)}天`);
        return counterRowHtml(`${g.title}（長期${leftText}）`, Number(g.completed||0), Number(g.total||0), `long:${g.id}`, 1, "");
      }).join("")
    : `<div class="small">尚無長期目標。請到「設定」新增。</div>`;

  return `
    <div class="card">
      <h3>本日反思與對話</h3>
      <textarea class="textarea" id="reflectionInput" placeholder="向教官報告今天的心情或反省...">${escapeHtml(state.reflection || "")}</textarea>
      <div class="small" style="margin-top:8px;">
        建議：只寫一句「我今天卡住的點」＋一句「我下一步要做什麼」。
      </div>
    </div>

    <div class="card">
      <div class="row-between">
        <h3 style="margin:0">學習診斷報告</h3>
        ${analysisTime}
      </div>
      ${state.isReportLoading ? `<div class="small" style="margin-top:10px;">正在計算勝率...</div>` : ""}
      <div style="margin-top:10px; line-height:1.7; white-space:normal;">
        ${reportHtml}
      </div>
    </div>

    <div class="card">
      <h3>今日實戰回顧</h3>
      ${doneList}
    </div>

    <div class="card">
      <h3>每日目標（今天）</h3>
      ${dailyCounters}
    </div>

    <div class="card">
      <h3>長期目標（累積）</h3>
      ${longCounters}
    </div>

    <div class="card">
      <h3>起床/專注統計</h3>
      <div class="row-between"><div>起床時間</div><div class="mono"><b>${escapeHtml(data.wakeTime)}</b></div></div>
      <div class="row-between" style="margin-top:8px;"><div>專注成功</div><div style="color:var(--good)"><b>${data.pomodoroDone}</b></div></div>
      <div class="row-between" style="margin-top:8px;"><div>分心失敗</div><div style="color:var(--danger)"><b>${data.pomodoroFailed}</b></div></div>
    </div>

    <button class="btn primary" data-action="submitReport" ${state.isReportLoading ? "disabled" : ""}>
      ${state.isReportLoading ? "正在計算勝率..." : "提交反思並產出戰術報告"}
    </button>
  `;
}

function counterRowHtml(title, value, total, key, step, unit=""){
  const display = total > 0 ? `${value}/${total}${unit}` : `${value}${unit}`;
  return `
    <div class="row-between" style="padding:10px 0;">
      <div><b>${escapeHtml(title)}</b></div>
      <div class="row" style="gap:8px;">
        <button class="btn" data-action="counterDec" data-key="${escapeAttr(key)}" data-step="${step}">－</button>
        <div class="mono" style="min-width:120px; text-align:center; font-weight:900;">${escapeHtml(display)}</div>
        <button class="btn primary" data-action="counterInc" data-key="${escapeAttr(key)}" data-step="${step}">＋</button>
      </div>
    </div>
  `;
}

/** ========= History View ========= */
function renderHistory(){
  const d = state.selectedDate;
  const monthLabel = `${d.getFullYear()}/${pad2(d.getMonth()+1)}`;
  const first = firstWeekdayOfMonth(d);
  const dim = daysInMonth(d);

  const weekdays = ["日","一","二","三","四","五","六"].map(x=>`<div class="weekday">${x}</div>`).join("");
  let cells = [];
  for(let i=0;i<first;i++) cells.push(`<div class="day empty"></div>`);
  for(let day=1; day<=dim; day++){
    const cellDate = new Date(d.getFullYear(), d.getMonth(), day);
    const k = dateKey(cellDate);
    const log = data.dailyLogs?.[k];
    const isToday = sameDay(cellDate, new Date());
    const isSelected = sameDay(cellDate, state.selectedDate);

    let dot = "";
    if(log){
      if(log.score > 80) dot = `<span class="dot good"></span>`;
      else if(log.score > 60) dot = `<span class="dot warn"></span>`;
      else dot = `<span class="dot bad"></span>`;
    }

    const cls = ["day", isToday?"today":"", isSelected?"selected":""].filter(Boolean).join(" ");
    cells.push(`
      <div class="${cls}" data-day="${day}">
        <div style="display:flex; flex-direction:column; align-items:center; line-height:1;">
          <div style="font-size:12px; font-weight:900;">${day}</div>
          <div style="margin-top:4px;">${dot}</div>
        </div>
      </div>
    `);
  }

  const monthKeys = Object.keys(data.dailyLogs || {})
    .filter(k => k.startsWith(ymKey(d)))
    .sort((a,b)=> b.localeCompare(a));

  const logsHtml = monthKeys.length ? monthKeys.map(k=>{
    const log = data.dailyLogs[k];
    const score = log?.score ?? 0;
    const sum = log?.summary ?? "無資料";
    const ch = log?.characterAnalysis ?? "無分析";

    const dayEvents = data.events
      .filter(e => dateKey(new Date(e.date)) === k)
      .sort((a,b)=> new Date(a.date) - new Date(b.date));

    const timeline = dayEvents.length ? dayEvents.map(e=>{
      const st = new Date(e.date);
      const overdue = (!e.isDone && st < new Date());
      const title = overdue ? `<span style="text-decoration:line-through; opacity:0.65;">${escapeHtml(e.title)}</span>` : escapeHtml(e.title);
      const typeTag = e.type === "Study" ? `<span class="pill study">讀書</span>` : `<span class="pill life">生活</span>`;
      const dot = e.isDone ? `<span class="dot good"></span>` : `<span class="dot bad"></span>`;
      return `
        <div class="row" style="gap:8px; align-items:center; padding:6px 0;">
          ${dot}
          <span class="mono small">${fmtTime(st)}</span>
          <span style="font-size:13px;">${title}</span>
          <span class="spacer"></span>
          ${typeTag}
        </div>
      `;
    }).join("") : `<div class="small">無記錄</div>`;

    // show daily goals snapshot (if exists)
    let snapshotHtml = "";
    if(log?.goalSnapshot){
      const dp = log.goalSnapshot.daily || {};
      const dailyLines = (data.dailyGoals || []).map(g=>{
        const v = Number(dp?.[g.id] || 0);
        return `<div class="small mono">${escapeHtml(g.title)}：${v}/${g.target}${g.unit||""}</div>`;
      }).join("");
      snapshotHtml = `
        <div class="divider"></div>
        <div class="small">【當日每日目標快照】</div>
        ${dailyLines || `<div class="small">（無）</div>`}
      `;
    }

    return `
      <div class="card">
        <div class="row-between">
          <div style="color:var(--cyan); font-weight:900;">${fmtDateHuman(k)}</div>
          <div style="font-size:18px; font-weight:900; color:var(--good);">評分: ${score}</div>
        </div>
        <div style="margin-top:10px;">
          <div class="small">【總結】</div>
          <div style="line-height:1.6;">${escapeHtml(sum)}</div>
        </div>
        <div style="margin-top:10px;">
          <div class="small">【性格分析】</div>
          <div style="line-height:1.6; color: rgba(0,229,255,0.85); font-style:italic;">${escapeHtml(ch)}</div>
        </div>
        ${snapshotHtml}
        <div class="divider"></div>
        <div class="small">【本日時間軸】</div>
        ${timeline}
      </div>
    `;
  }).join("") : `<div class="card"><div class="small">本月尚無教官評分。</div></div>`;

  return `
    <div class="card">
      <div class="row-between">
        <button class="btn" data-action="monthPrev">◀</button>
        <div class="mono" style="font-weight:900">${monthLabel}</div>
        <button class="btn" data-action="monthNext">▶</button>
      </div>

      <div class="calendar-grid" style="margin-top:12px;">
        ${weekdays}
      </div>
      <div class="calendar-grid">
        ${cells.join("")}
      </div>
    </div>

    ${logsHtml}
  `;
}

/** ========= Settings View ========= */
function renderSettings(){
  const theme = data.theme || DEFAULTS.theme;

  const longList = (data.longGoals || []).map(g=>{
    return `
      <div class="card" style="margin:10px 0; background:var(--card2)">
        <div class="small">長期目標</div>
        <div style="margin-top:8px;">
          <input class="input" data-goal-field="title" data-id="${g.id}" value="${escapeAttr(g.title)}" placeholder="科目/名稱" />
        </div>
        <div class="row" style="margin-top:8px;">
          <input class="input mono" style="flex:1" data-goal-field="total" data-id="${g.id}" value="${escapeAttr(g.total)}" placeholder="總量(堂/章/單元)" />
          <input class="input mono" style="flex:1" data-goal-field="completed" data-id="${g.id}" value="${escapeAttr(g.completed)}" placeholder="已完成" />
        </div>
        <div style="margin-top:8px;">
          <input class="input mono" data-goal-field="deadline" data-id="${g.id}" value="${escapeAttr(g.deadline || "")}" placeholder="截止日 YYYY-MM-DD" />
        </div>
        <div class="row" style="margin-top:10px;">
          <button class="btn primary" data-action="saveLongGoal" data-id="${g.id}">儲存</button>
          <button class="btn danger" data-action="delLongGoal" data-id="${g.id}">刪除</button>
        </div>
      </div>
    `;
  }).join("");

  const dailyList = (data.dailyGoals || []).map(g=>{
    return `
      <div class="card" style="margin:10px 0; background:var(--card2)">
        <div class="small">每日目標</div>
        <div style="margin-top:8px;">
          <input class="input" data-dgoal-field="title" data-id="${g.id}" value="${escapeAttr(g.title)}" placeholder="名稱" />
        </div>
        <div class="row" style="margin-top:8px;">
          <input class="input mono" style="flex:1" data-dgoal-field="target" data-id="${g.id}" value="${escapeAttr(g.target)}" placeholder="每日目標量" />
          <input class="input mono" style="flex:1" data-dgoal-field="step" data-id="${g.id}" value="${escapeAttr(g.step || 1)}" placeholder="步進(+/-)" />
        </div>
        <div style="margin-top:8px;">
          <input class="input" data-dgoal-field="unit" data-id="${g.id}" value="${escapeAttr(g.unit || "")}" placeholder="單位(題/字/頁...)" />
        </div>
        <div class="row" style="margin-top:10px;">
          <button class="btn primary" data-action="saveDailyGoal" data-id="${g.id}">儲存</button>
          <button class="btn danger" data-action="delDailyGoal" data-id="${g.id}">刪除</button>
        </div>
      </div>
    `;
  }).join("");

  return `
    <div class="card">
      <h3>Gemini API</h3>
      <div class="small">注意：API Key 會存於瀏覽器 localStorage（同機器同瀏覽器可見）。</div>
      <div style="margin-top:10px;">
        <input class="input" id="apiKeyInput" value="${escapeAttr(data.apiKey)}" placeholder="Gemini API Key" />
      </div>
      <div style="margin-top:10px;">
        <button class="btn primary" data-action="saveApiKey">儲存 API Key</button>
      </div>
    </div>

    <div class="card">
      <h3>背景圖片</h3>
      <input class="input" id="bgUrlInput" value="${escapeAttr(data.bgURL)}" placeholder="背景 URL" />
      <div class="row" style="margin-top:10px;">
        <button class="btn primary" data-action="saveBg">儲存背景</button>
        <button class="btn" data-action="resetBg">恢復預設</button>
      </div>
    </div>

    <div class="card">
      <h3>考試倒數（D-）</h3>
      <div class="small">右上角 D- 會以這個日期計算。</div>
      <div style="margin-top:10px;">
        <input class="input mono" id="examDateInput" value="${escapeAttr(data.examDate)}" placeholder="YYYY-MM-DD" />
      </div>
      <div style="margin-top:10px;">
        <button class="btn primary" data-action="saveExamDate">儲存日期</button>
      </div>
    </div>

    <div class="card">
      <h3>色調（主色）</h3>
      <div class="small">會套用到重點色（CSS 變數 --cyan）。如果背景換了覺得刺眼，直接換這個。</div>
      <div class="row" style="margin-top:10px; gap:10px; align-items:center;">
        <input class="input mono" id="accentInput" value="${escapeAttr(theme.accent || DEFAULTS.theme.accent)}" placeholder="#RRGGBB" />
        <input type="color" id="accentPicker" value="${escapeAttr(theme.accent || DEFAULTS.theme.accent)}" style="height:42px; width:56px; border:none; background:transparent;" />
      </div>
      <div class="row" style="margin-top:10px;">
        <button class="btn primary" data-action="saveAccent">儲存主色</button>
        <button class="btn" data-action="autoAccent">自動從背景抓色</button>
      </div>
      <div class="small" style="margin-top:8px; opacity:0.85;">
        ※ 自動抓色若失敗，多半是圖片跨域限制，改用手動選色即可。
      </div>
    </div>

    <div class="card">
      <h3>長期目標（可自訂）</h3>
      <div class="small">行政學/政治學這類，會評估進度與截止日風險。</div>

      <div style="margin-top:10px;">
        <input class="input" id="newLongTitle" placeholder="新增：名稱（例：行政學）" />
      </div>
      <div class="row" style="margin-top:8px;">
        <input class="input mono" style="flex:1" id="newLongTotal" placeholder="總量（例：40）" />
        <input class="input mono" style="flex:1" id="newLongDeadline" placeholder="截止日（例：2026-01-31）" />
      </div>
      <div style="margin-top:10px;">
        <button class="btn primary" data-action="addLongGoal">＋ 新增長期目標</button>
      </div>

      <div style="margin-top:10px;">
        ${longList || `<div class="small">（目前沒有長期目標）</div>`}
      </div>
    </div>

    <div class="card">
      <h3>每日目標（可自訂）</h3>
      <div class="small">刷題/背單字這類，每天都要達標，報告會評估達成度。</div>

      <div style="margin-top:10px;">
        <input class="input" id="newDailyTitle" placeholder="新增：名稱（例：英文刷題）" />
      </div>
      <div class="row" style="margin-top:8px;">
        <input class="input mono" style="flex:1" id="newDailyTarget" placeholder="每日目標量（例：100）" />
        <input class="input mono" style="flex:1" id="newDailyStep" placeholder="步進（例：10）" />
      </div>
      <div style="margin-top:8px;">
        <input class="input" id="newDailyUnit" placeholder="單位（例：題）" />
      </div>
      <div style="margin-top:10px;">
        <button class="btn primary" data-action="addDailyGoal">＋ 新增每日目標</button>
      </div>

      <div style="margin-top:10px;">
        ${dailyList || `<div class="small">（目前沒有每日目標）</div>`}
      </div>
    </div>

    <div class="card">
      <h3>資料管理</h3>
      <div class="small">匯出/匯入可以換電腦用；重置會清空所有資料。</div>
      <div class="row" style="margin-top:10px;">
        <button class="btn" data-action="exportData">匯出 JSON</button>
        <button class="btn" data-action="importData">匯入 JSON</button>
        <button class="btn danger" data-action="resetAll">全部重置</button>
      </div>
      <input id="importFile" type="file" accept="application/json" style="display:none;" />
    </div>
  `;
}

/** ========= Dialog (Add/Edit Task) ========= */
const taskDialog = document.getElementById("taskDialog");
const taskDialogTitle = document.getElementById("taskDialogTitle");
const taskTitle = document.getElementById("taskTitle");
const taskStart = document.getElementById("taskStart");
const taskEnd = document.getElementById("taskEnd");
const btnSaveTask = document.getElementById("btnSaveTask");
const btnDeleteTask = document.getElementById("btnDeleteTask");
const segBtns = Array.from(document.querySelectorAll(".segmented .seg"));

let dialogMode = "add";
let dialogEditingId = null;
let dialogType = "Study";
let dialogDate = null;

function openTaskDialog(mode, dateObj, existing=null){
  dialogMode = mode;
  dialogDate = dateObj;
  dialogEditingId = existing?.id || null;

  if(mode === "add"){
    taskDialogTitle.textContent = "新增日程規劃";
    btnDeleteTask.style.display = "none";
    taskTitle.value = "";
    dialogType = "Study";
    taskStart.value = "09:00";
    taskEnd.value = "10:00";
  }else{
    taskDialogTitle.textContent = "編輯日程規劃";
    btnDeleteTask.style.display = "inline-block";
    taskTitle.value = existing?.title || "";
    dialogType = existing?.type || "Study";
    const st = new Date(existing.date);
    const et = existing.endTime ? new Date(existing.endTime) : new Date(st.getTime() + 60*60*1000);
    taskStart.value = fmtTime(st);
    taskEnd.value = fmtTime(et);
  }

  segBtns.forEach(b=> b.classList.toggle("active", b.dataset.type === dialogType));
  taskDialog.showModal();
}

segBtns.forEach(b=>{
  b.onclick = ()=>{
    dialogType = b.dataset.type;
    segBtns.forEach(x=> x.classList.toggle("active", x === b));
  };
});

btnSaveTask.onclick = ()=>{
  const title = taskTitle.value.trim();
  if(!title) return;

  const st = combineDateTime(dialogDate, taskStart.value || "09:00");
  const et = combineDateTime(dialogDate, taskEnd.value || "10:00");

  if(dialogMode === "edit" && dialogEditingId){
    const existing = data.events.find(e=> e.id === dialogEditingId);
    if(existing){
      existing.title = title;
      existing.type = dialogType;
      existing.date = st.toISOString();
      existing.endTime = et.toISOString();
      upsertEvent(existing);
    }
  }else{
    const evt = {
      id: crypto.randomUUID(),
      title,
      date: st.toISOString(),
      endTime: et.toISOString(),
      type: dialogType,
      isDone: false,
    };
    upsertEvent(evt);
  }

  taskDialog.close();
  render();
};

btnDeleteTask.onclick = ()=>{
  if(dialogEditingId){
    deleteEvent(dialogEditingId);
    taskDialog.close();
    render();
  }
};

/** ========= Dynamic handlers ========= */
function bindDynamicHandlers(){
  // month nav (calendar + history)
  elContent.querySelectorAll("[data-action='monthPrev']").forEach(btn=>{
    btn.onclick = ()=>{
      state.selectedDate = addMonths(state.selectedDate, -1);
      render();
    };
  });
  elContent.querySelectorAll("[data-action='monthNext']").forEach(btn=>{
    btn.onclick = ()=>{
      state.selectedDate = addMonths(state.selectedDate, +1);
      render();
    };
  });

  // day click (calendar + history)
  elContent.querySelectorAll(".day[data-day]").forEach(cell=>{
    cell.onclick = ()=>{
      const day = Number(cell.dataset.day);
      state.selectedDate = new Date(state.selectedDate.getFullYear(), state.selectedDate.getMonth(), day);
      render();
    };
  });

  // calendar actions
  elContent.querySelectorAll("[data-action='addTask']").forEach(btn=>{
    btn.onclick = ()=> openTaskDialog("add", state.selectedDate);
  });

  const wakeInput = elContent.querySelector("#wakeInput");
  const sleepInput = elContent.querySelector("#sleepInput");
  const saveWakeSleepBtn = elContent.querySelector("[data-action='saveWakeSleep']");
  if(saveWakeSleepBtn && wakeInput && sleepInput){
    saveWakeSleepBtn.onclick = ()=>{
      data.wakeTime = wakeInput.value || data.wakeTime;
      data.sleepTime = sleepInput.value || data.sleepTime;
      persistAll();
      render();
    };
  }

  // task interactions
  elContent.querySelectorAll("[data-action='toggleDone']").forEach(btn=>{
    btn.onclick = ()=>{
      const id = btn.dataset.id;
      const e = data.events.find(x=> x.id === id);
      if(!e) return;
      e.isDone = !e.isDone;
      upsertEvent(e);
      render();
    };
  });
  elContent.querySelectorAll("[data-action='edit']").forEach(btn=>{
    btn.onclick = ()=>{
      const id = btn.dataset.id;
      const e = data.events.find(x=> x.id === id);
      if(!e) return;
      openTaskDialog("edit", new Date(e.date), e);
    };
  });
  elContent.querySelectorAll("[data-action='play']").forEach(btn=>{
    btn.onclick = ()=>{
      const id = btn.dataset.id;
      const e = data.events.find(x=> x.id === id);
      if(!e) return;
      state.activeTaskFromSchedule = e.title;
      setTab("focus");
    };
  });

  // focus handlers
  const focusTaskInput = elContent.querySelector("#focusTaskName");
  if(focusTaskInput){
    focusTaskInput.oninput = ()=> { state.focusTaskName = focusTaskInput.value; };
  }
  elContent.querySelectorAll("[data-action='minus5']").forEach(btn=>{
    btn.onclick = ()=>{
      if(state.isFocusing) return;
      state.totalTime = Math.max(60, state.totalTime - 300);
      state.timeLeft = state.totalTime;
      render();
    };
  });
  elContent.querySelectorAll("[data-action='plus5']").forEach(btn=>{
    btn.onclick = ()=>{
      if(state.isFocusing) return;
      state.totalTime = Math.min(7200, state.totalTime + 300);
      state.timeLeft = state.totalTime;
      render();
    };
  });
  elContent.querySelectorAll("[data-action='toggleFocus']").forEach(btn=>{
    btn.onclick = ()=> toggleFocus();
  });
  elContent.querySelectorAll("[data-action='abandon']").forEach(btn=>{
    btn.onclick = ()=> abandonTask();
  });

  // dashboard submit
  elContent.querySelectorAll("[data-action='submitReport']").forEach(btn=>{
    btn.onclick = ()=>{
      const input = document.getElementById("reflectionInput");
      state.reflection = input ? input.value : state.reflection;
      fetchDashboardReport();
    };
  });

  // counters (daily + long)
  elContent.querySelectorAll("[data-action='counterInc']").forEach(btn=>{
    btn.onclick = ()=>{
      const key = btn.dataset.key;
      const step = Number(btn.dataset.step || 1);
      counterUpdate(key, +step);
      render();
    };
  });
  elContent.querySelectorAll("[data-action='counterDec']").forEach(btn=>{
    btn.onclick = ()=>{
      const key = btn.dataset.key;
      const step = Number(btn.dataset.step || 1);
      counterUpdate(key, -step);
      render();
    };
  });

  // settings: api/bg
  elContent.querySelectorAll("[data-action='saveApiKey']").forEach(btn=>{
    btn.onclick = ()=>{
      const v = (document.getElementById("apiKeyInput")?.value || "").trim();
      data.apiKey = v;
      persistAll();
      render();
      alert("已儲存 API Key");
    };
  });
  elContent.querySelectorAll("[data-action='saveBg']").forEach(btn=>{
    btn.onclick = ()=>{
      const v = (document.getElementById("bgUrlInput")?.value || "").trim();
      if(!v) return;
      data.bgURL = v;
      persistAll();
      render();
      alert("已儲存背景");
    };
  });
  elContent.querySelectorAll("[data-action='resetBg']").forEach(btn=>{
    btn.onclick = ()=>{
      data.bgURL = DEFAULTS.bgURL;
      persistAll();
      render();
    };
  });

  // settings: exam date
  elContent.querySelectorAll("[data-action='saveExamDate']").forEach(btn=>{
    btn.onclick = ()=>{
      const v = (document.getElementById("examDateInput")?.value || "").trim();
      if(v && !/^\d{4}-\d{2}-\d{2}$/.test(v)){
        alert("日期格式請用 YYYY-MM-DD");
        return;
      }
      data.examDate = v || DEFAULTS.examDate;
      persistAll();
      render();
      alert("已儲存考試日期");
    };
  });

  // settings: theme
  const accentPicker = document.getElementById("accentPicker");
  const accentInput = document.getElementById("accentInput");
  if(accentPicker && accentInput){
    accentPicker.oninput = ()=> { accentInput.value = accentPicker.value; };
  }
  elContent.querySelectorAll("[data-action='saveAccent']").forEach(btn=>{
    btn.onclick = ()=>{
      const v = (document.getElementById("accentInput")?.value || "").trim();
      if(!/^#([0-9a-fA-F]{6})$/.test(v)){
        alert("主色請用 #RRGGBB 格式");
        return;
      }
      data.theme = { accent: v, mode: "manual" };
      persistAll();
      applyTheme();
      render();
      alert("已儲存主色");
    };
  });
  elContent.querySelectorAll("[data-action='autoAccent']").forEach(btn=>{
    btn.onclick = async ()=>{
      try{
        await tryAutoThemeFromBg();
        render();
        alert(`自動配色完成：${data.theme.accent}`);
      }catch(e){
        alert("自動配色失敗（常見原因：圖片跨域不允許讀像素）。請改用手動選色。");
      }
    };
  });

  // settings: add/save/delete long goals
  elContent.querySelectorAll("[data-action='addLongGoal']").forEach(btn=>{
    btn.onclick = ()=>{
      const title = (document.getElementById("newLongTitle")?.value || "").trim();
      const total = Number((document.getElementById("newLongTotal")?.value || "").trim());
      const deadline = (document.getElementById("newLongDeadline")?.value || "").trim() || data.examDate;

      if(!title) return alert("請輸入長期目標名稱");
      if(!Number.isFinite(total) || total <= 0) return alert("總量請輸入正數");
      if(deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return alert("截止日格式請用 YYYY-MM-DD");

      data.longGoals.unshift({
        id: crypto.randomUUID(),
        title,
        total,
        completed: 0,
        deadline: deadline || "",
      });
      persistAll();
      render();
    };
  });

  elContent.querySelectorAll("[data-action='saveLongGoal']").forEach(btn=>{
    btn.onclick = ()=>{
      const id = btn.dataset.id;
      const g = data.longGoals.find(x=> x.id === id);
      if(!g) return;

      const title = (elContent.querySelector(`[data-goal-field="title"][data-id="${id}"]`)?.value || "").trim();
      const total = Number((elContent.querySelector(`[data-goal-field="total"][data-id="${id}"]`)?.value || "").trim());
      const completed = Number((elContent.querySelector(`[data-goal-field="completed"][data-id="${id}"]`)?.value || "").trim());
      const deadline = (elContent.querySelector(`[data-goal-field="deadline"][data-id="${id}"]`)?.value || "").trim();

      if(!title) return alert("名稱不可空白");
      if(!Number.isFinite(total) || total <= 0) return alert("總量請輸入正數");
      if(!Number.isFinite(completed) || completed < 0) return alert("已完成請輸入 >= 0");
      if(deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return alert("截止日格式請用 YYYY-MM-DD");

      g.title = title;
      g.total = total;
      g.completed = Math.max(0, completed);
      g.deadline = deadline;

      persistAll();
      render();
      alert("已儲存長期目標");
    };
  });

  elContent.querySelectorAll("[data-action='delLongGoal']").forEach(btn=>{
    btn.onclick = ()=>{
      const id = btn.dataset.id;
      if(!confirm("確定刪除這個長期目標？")) return;
      data.longGoals = data.longGoals.filter(x=> x.id !== id);
      persistAll();
      render();
    };
  });

  // settings: add/save/delete daily goals
  elContent.querySelectorAll("[data-action='addDailyGoal']").forEach(btn=>{
    btn.onclick = ()=>{
      const title = (document.getElementById("newDailyTitle")?.value || "").trim();
      const target = Number((document.getElementById("newDailyTarget")?.value || "").trim());
      const step = Number((document.getElementById("newDailyStep")?.value || "").trim());
      const unit = (document.getElementById("newDailyUnit")?.value || "").trim();

      if(!title) return alert("請輸入每日目標名稱");
      if(!Number.isFinite(target) || target <= 0) return alert("每日目標量請輸入正數");
      if(!Number.isFinite(step) || step <= 0) return alert("步進請輸入正數");

      data.dailyGoals.unshift({
        id: crypto.randomUUID(),
        title,
        target,
        step,
        unit: unit || "",
      });
      persistAll();
      render();
    };
  });

  elContent.querySelectorAll("[data-action='saveDailyGoal']").forEach(btn=>{
    btn.onclick = ()=>{
      const id = btn.dataset.id;
      const g = data.dailyGoals.find(x=> x.id === id);
      if(!g) return;

      const title = (elContent.querySelector(`[data-dgoal-field="title"][data-id="${id}"]`)?.value || "").trim();
      const target = Number((elContent.querySelector(`[data-dgoal-field="target"][data-id="${id}"]`)?.value || "").trim());
      const step = Number((elContent.querySelector(`[data-dgoal-field="step"][data-id="${id}"]`)?.value || "").trim());
      const unit = (elContent.querySelector(`[data-dgoal-field="unit"][data-id="${id}"]`)?.value || "").trim();

      if(!title) return alert("名稱不可空白");
      if(!Number.isFinite(target) || target <= 0) return alert("每日目標量請輸入正數");
      if(!Number.isFinite(step) || step <= 0) return alert("步進請輸入正數");

      g.title = title;
      g.target = target;
      g.step = step;
      g.unit = unit;

      persistAll();
      render();
      alert("已儲存每日目標");
    };
  });

  elContent.querySelectorAll("[data-action='delDailyGoal']").forEach(btn=>{
    btn.onclick = ()=>{
      const id = btn.dataset.id;
      if(!confirm("確定刪除這個每日目標？（歷史紀錄不會被改掉）")) return;
      data.dailyGoals = data.dailyGoals.filter(x=> x.id !== id);
      persistAll();
      render();
    };
  });

  // data manage
  elContent.querySelectorAll("[data-action='exportData']").forEach(btn=>{
    btn.onclick = exportData;
  });
  elContent.querySelectorAll("[data-action='importData']").forEach(btn=>{
    btn.onclick = ()=> document.getElementById("importFile").click();
  });
  elContent.querySelectorAll("[data-action='resetAll']").forEach(btn=>{
    btn.onclick = resetAll;
  });

  const importFile = document.getElementById("importFile");
  if(importFile){
    importFile.onchange = async (e)=>{
      const file = e.target.files?.[0];
      if(!file) return;
      const text = await file.text();
      try{
        const obj = JSON.parse(text);
        importDataObj(obj);
        alert("匯入完成");
        render();
      }catch{
        alert("匯入失敗：JSON 格式不正確");
      }finally{
        importFile.value = "";
      }
    };
  }
}

/** ========= Counter logic ========= */
function counterUpdate(key, delta){
  const tKey = todayKey();

  if(key.startsWith("long:")){
    const id = key.split(":")[1];
    const g = data.longGoals.find(x=> x.id === id);
    if(!g) return;
    g.completed = Math.max(0, Number(g.completed || 0) + delta);
    persistAll();
    return;
  }

  if(key.startsWith("daily:")){
    const id = key.split(":")[1];
    const v = Number(getDailyProgressFor(tKey)?.[id] || 0);
    setDailyProgress(tKey, id, v + delta);
    persistAll();
    return;
  }
}

/** ========= Focus timer logic (pomodoro version kept) ========= */
const K_FOCUS_SESSION = "focusSession";
const DEFAULT_FOCUS_SESSION = {
  status: "idle",
  sessionId: null,
  taskName: "",
  startedAtISO: null,
  endsAtMs: null,
  totalTimeSec: 1500,
  timeLeftSec: 1500,
  awayArmed: false,
  awayDeadlineMs: null,
  awayReason: "",
};
const FOCUS_GRACE_MS = 30_000;

function nowMs(){ return Date.now(); }
function loadFocusSession(){
  const s = loadJSON(K_FOCUS_SESSION, null);
  return (s && typeof s === "object") ? s : JSON.parse(JSON.stringify(DEFAULT_FOCUS_SESSION));
}
function saveFocusSession(){
  localStorage.setItem(K_FOCUS_SESSION, JSON.stringify(state.focusSession));
}
function syncUIFromSession(){
  const s = state.focusSession;
  state.isFocusing = (s.status === "running");
  state.totalTime = s.totalTimeSec;
  state.timeLeft = s.timeLeftSec;
  state.focusTaskName = s.taskName || state.focusTaskName || "";
  state.focusStartTime = s.startedAtISO ? new Date(s.startedAtISO) : null;
}
function disarmAway(){
  const s = state.focusSession;
  s.awayArmed = false;
  s.awayDeadlineMs = null;
  s.awayReason = "";
  saveFocusSession();
}
function armAway(reason){
  const s = state.focusSession;
  if(s.status !== "running") return;
  s.awayArmed = true;
  s.awayDeadlineMs = nowMs() + FOCUS_GRACE_MS;
  s.awayReason = reason || "離開專注";
  saveFocusSession();
}
function checkAwayAutoFail(){
  const s = state.focusSession;
  if(!s.awayArmed || !s.awayDeadlineMs) return false;
  if(s.status !== "running") { disarmAway(); return false; }
  if(nowMs() >= s.awayDeadlineMs){
    recordPomodoroFail(`離開超過 30 秒：${s.awayReason}`, { auto:true });
    return true;
  }
  return false;
}
function reconcileRunningClock(){
  const s = state.focusSession;
  if(checkAwayAutoFail()) return;

  if(s.status !== "running"){
    syncUIFromSession();
    return;
  }
  if(!Number.isFinite(s.endsAtMs) || s.endsAtMs === null){
    s.endsAtMs = nowMs() + (Number(s.timeLeftSec ?? s.totalTimeSec) * 1000);
  }
  const remainMs = s.endsAtMs - nowMs();
  const remainSec = Math.max(0, Math.ceil(remainMs / 1000));
  s.timeLeftSec = remainSec;
  saveFocusSession();

  syncUIFromSession();

  if(remainSec <= 0){
    recordPomodoroSuccess();
  }
}

function toggleFocus(){
  const name = (document.getElementById("focusTaskName")?.value || state.focusTaskName || "").trim();
  state.focusTaskName = name;

  const s = state.focusSession;
  if(state.tab === "focus") disarmAway();

  if(s.status === "idle"){
    const taskTitle = state.focusTaskName || "未命名任務";
    const start = new Date();

    s.status = "running";
    s.sessionId = crypto.randomUUID();
    s.taskName = taskTitle;
    s.startedAtISO = start.toISOString();
    s.totalTimeSec = state.totalTime;
    s.timeLeftSec = state.totalTime;
    s.endsAtMs = nowMs() + (s.timeLeftSec * 1000);

    disarmAway();
    saveFocusSession();
    syncUIFromSession();
    startTimer();
    render();
    return;
  }

  if(s.status === "running"){
    reconcileRunningClock();
    s.status = "paused";
    s.endsAtMs = null;
    disarmAway();
    saveFocusSession();
    stopTimer();
    syncUIFromSession();
    render();
    return;
  }

  if(s.status === "paused"){
    const taskTitle = state.focusTaskName || s.taskName || "未命名任務";
    s.taskName = taskTitle;

    s.totalTimeSec = state.totalTime;
    s.timeLeftSec = Math.min(s.timeLeftSec || s.totalTimeSec, s.totalTimeSec);
    s.endsAtMs = nowMs() + (s.timeLeftSec * 1000);

    s.status = "running";
    disarmAway();
    saveFocusSession();
    syncUIFromSession();
    startTimer();
    render();
    return;
  }
}

function startTimer(){
  stopTimer();
  state.timerId = setInterval(()=>{
    const s = state.focusSession;
    if(!s) return;

    if(checkAwayAutoFail()){
      return;
    }
    if(s.status !== "running") return;

    reconcileRunningClock();

    if(state.tab === "focus") render();
  }, 250);
}
function stopTimer(){
  if(state.timerId){
    clearInterval(state.timerId);
    state.timerId = null;
  }
}

function recordPomodoroSuccess(){
  const s = state.focusSession;
  if(!s || s.status !== "running") return;

  s.timeLeftSec = 0;
  s.status = "idle";
  s.endsAtMs = null;

  disarmAway();
  stopTimer();

  const taskTitle = s.taskName || "未命名任務";
  const startISO = s.startedAtISO || new Date().toISOString();

  const idx = data.events.findIndex(e => e.title === taskTitle && e.type === "Study" && !e.isDone);
  if(idx >= 0){
    data.events[idx].isDone = true;
    data.events[idx].endTime = new Date().toISOString();
    persistAll();
  }else{
    upsertEvent({
      id: crypto.randomUUID(),
      title: taskTitle,
      date: startISO,
      endTime: new Date().toISOString(),
      type: "Study",
      isDone: true,
    });
  }

  data.pomodoroDone += 1;

  s.sessionId = null;
  s.startedAtISO = null;
  s.timeLeftSec = s.totalTimeSec;

  saveFocusSession();
  persistAll();
  syncUIFromSession();

  fetchFocusJab(`任務達成：${taskTitle}`);
  render();
}

function recordPomodoroFail(reason, { auto=false } = {}){
  const s = state.focusSession;
  if(!s) return;

  // idle 不算失敗
  if(s.status === "idle"){
    data.focusMsg = `**未開始不計失敗。** 直接按「開始」。`;
    persistAll();
    render();
    return;
  }
  if(s.status !== "running" && s.status !== "paused") return;

  stopTimer();

  const taskTitle = (s.taskName || state.focusTaskName || "").trim() || "未命名任務";
  const startISO = s.startedAtISO || new Date().toISOString();

  upsertEvent({
    id: crypto.randomUUID(),
    title: taskTitle,
    date: startISO,
    endTime: new Date().toISOString(),
    type: "Study",
    isDone: false,
  });

  data.pomodoroFailed += 1;

  s.status = "idle";
  s.endsAtMs = null;
  s.sessionId = null;
  s.startedAtISO = null;
  s.timeLeftSec = s.totalTimeSec;

  disarmAway();
  saveFocusSession();
  persistAll();
  syncUIFromSession();

  const tag = auto ? "（自動判負）" : "";
  fetchFocusJab(`任務失敗${tag}：${taskTitle}${reason ? `｜${reason}` : ""}`);
  render();
}

function abandonTask(){
  const s = state.focusSession;
  const taskTitle = (document.getElementById("focusTaskName")?.value || state.focusTaskName || s.taskName || "").trim();
  if(taskTitle) state.focusTaskName = taskTitle;
  if(taskTitle) s.taskName = taskTitle;
  saveFocusSession();
  recordPomodoroFail("手動放棄", { auto:false });
}

/** ========= Export/Import/Reset ========= */
function exportData(){
  const payload = {
    version: 3,
    exportedAt: new Date().toISOString(),
    data: {
      longGoals: data.longGoals,
      dailyGoals: data.dailyGoals,
      dailyGoalProgress: data.dailyGoalProgress,
      examDate: data.examDate,
      theme: data.theme,

      wakeTime: data.wakeTime,
      sleepTime: data.sleepTime,
      events: data.events,
      pomodoroDone: data.pomodoroDone,
      pomodoroFailed: data.pomodoroFailed,
      dailyLogs: data.dailyLogs,
      apiKey: data.apiKey,
      bgURL: data.bgURL,
      reportMsg: data.reportMsg,
      analysisTime: data.analysisTime,
      focusMsg: data.focusMsg,

      focusSession: state.focusSession,
    }
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `study-war-room-export-${dateKey(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importDataObj(obj){
  const d = obj?.data;
  if(!d) throw new Error("invalid");

  data.longGoals = Array.isArray(d.longGoals) ? d.longGoals : DEFAULTS.longGoals;
  data.dailyGoals = Array.isArray(d.dailyGoals) ? d.dailyGoals : DEFAULTS.dailyGoals;
  data.dailyGoalProgress = d.dailyGoalProgress || {};
  data.examDate = d.examDate || DEFAULTS.examDate;
  data.theme = d.theme || DEFAULTS.theme;

  data.wakeTime = d.wakeTime || DEFAULTS.wakeTime;
  data.sleepTime = d.sleepTime || DEFAULTS.sleepTime;
  data.events = Array.isArray(d.events) ? d.events : [];
  data.pomodoroDone = Number(d.pomodoroDone ?? 0) || 0;
  data.pomodoroFailed = Number(d.pomodoroFailed ?? 0) || 0;
  data.dailyLogs = d.dailyLogs || {};
  data.apiKey = d.apiKey || "";
  data.bgURL = d.bgURL || DEFAULTS.bgURL;
  data.reportMsg = d.reportMsg || DEFAULTS.reportMsg;
  data.analysisTime = d.analysisTime || "";
  data.focusMsg = d.focusMsg || DEFAULTS.focusMsg;

  normalizeEvents();

  state.focusSession = d.focusSession || loadFocusSession();
  saveFocusSession();

  persistAll();
  applyTheme();
}

function resetAll(){
  if(!confirm("確定要全部重置？這會清空所有資料。")) return;
  localStorage.clear();
  location.reload();
}

/** ========= Utils ========= */
function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;");
}
function escapeAttr(s){
  return escapeHtml(s).replaceAll("'", "&#39;");
}

/** ========= Migration (legacy -> new goals) ========= */
function migrateIfNeeded(){
  // if new exists, do nothing
  if(Array.isArray(data.longGoals) && Array.isArray(data.dailyGoals)) return;

  // build from legacy
  let longGoals = [];
  if(Array.isArray(data.legacyGoals) && data.legacyGoals.length){
    longGoals = data.legacyGoals.map(g=>({
      id: g.id || crypto.randomUUID(),
      title: g.subject || g.title || "未命名",
      total: Number(g.total || 0) || 1,
      completed: Number(g.completed || 0) || 0,
      deadline: data.examDate || DEFAULTS.examDate,
    }));
  }else{
    longGoals = DEFAULTS.longGoals;
  }

  // daily goals: convert legacy law/vocab as "today progress" (best-effort)
  const dailyGoals = DEFAULTS.dailyGoals.map(x=>({ ...x, id: crypto.randomUUID() }));

  data.longGoals = longGoals;
  data.dailyGoals = dailyGoals;

  // map today's progress from legacy values
  const tK = todayKey();
  data.dailyGoalProgress = data.dailyGoalProgress || {};
  if(!data.dailyGoalProgress[tK]) data.dailyGoalProgress[tK] = {};
  // put legacy into first two daily goals if present
  if(dailyGoals[0]) data.dailyGoalProgress[tK][dailyGoals[0].id] = Number(data.legacyLaw || 0);
  if(dailyGoals[1]) data.dailyGoalProgress[tK][dailyGoals[1].id] = Number(data.legacyVocab || 0);

  // save new
  persistAll();
}

/** ========= Init ========= */
(function init(){
  checkDailyReset();
  normalizeEvents();

  // migrate goals
  migrateIfNeeded();

  // ensure defaults exist if still null
  if(!Array.isArray(data.longGoals)) data.longGoals = DEFAULTS.longGoals;
  if(!Array.isArray(data.dailyGoals)) data.dailyGoals = DEFAULTS.dailyGoals;
  if(!data.dailyGoalProgress) data.dailyGoalProgress = {};

  // theme apply
  applyTheme();

  // focus session init
  state.focusSession = loadFocusSession();
  syncUIFromSession();

  // init timer values from session
  state.totalTime = state.focusSession?.totalTimeSec ?? 1500;
  state.timeLeft = state.focusSession?.timeLeftSec ?? state.totalTime;

  persistAll();

  if(state.focusSession?.status === "running"){
    if(checkAwayAutoFail()){
      // handled
    }else{
      reconcileRunningClock();
      startTimer();
    }
  }

  // visibility events
  document.addEventListener("visibilitychange", ()=>{
    const s = state.focusSession;
    if(!s) return;

    if(document.hidden){
      if(s.status === "running"){
        armAway("切到背景");
      }
    }else{
      if(state.tab === "focus") disarmAway();
      reconcileRunningClock();
      render();
    }
  });
  window.addEventListener("blur", ()=>{
    const s = state.focusSession;
    if(!s) return;
    if(s.status === "running"){
      armAway("視窗失焦");
    }
  });
  window.addEventListener("focus", ()=>{
    if(state.tab === "focus") disarmAway();
    reconcileRunningClock();
    render();
  });

  render();
})();
