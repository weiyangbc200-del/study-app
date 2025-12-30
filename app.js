/***********************
 *  戰力診斷系統 Web版
 *  - GitHub Pages 可直接跑
 *  - 資料存 localStorage
 ************************/

/** ========= Storage Keys ========= */
const K = {
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
};

/** ========= Default Data ========= */
const DEFAULTS = {
  goals: [
    { id: crypto.randomUUID(), subject: "行政法", total: 50, completed: 0 },
    { id: crypto.randomUUID(), subject: "政治學", total: 30, completed: 0 },
    { id: crypto.randomUUID(), subject: "行政學", total: 40, completed: 0 },
    { id: crypto.randomUUID(), subject: "公共政策", total: 20, completed: 0 },
  ],
  lawScore: 0,
  vocabCount: 0,
  wakeTime: "07:00",
  sleepTime: "23:30",
  events: [],
  pomodoroDone: 0,
  pomodoroFailed: 0,
  dailyLogs: {}, // {YYYYMMDD: {score, summary, characterAnalysis}}
  apiKey: "",
  bgURL: "https://images.unsplash.com/photo-1542051841857-5f90071e7989?q=80&w=2070",
  reportMsg: "戰略報告準備中...",
  analysisTime: "",
  focusMsg: "全職考生，你沒有退路。",
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
  goals: loadJSON(K.goals, DEFAULTS.goals),
  lawScore: loadNum(K.law, DEFAULTS.lawScore),
  vocabCount: loadNum(K.vocab, DEFAULTS.vocabCount),
  wakeTime: loadStr(K.wake, DEFAULTS.wakeTime),
  sleepTime: loadStr(K.sleep, DEFAULTS.sleepTime),
  events: loadJSON(K.events, DEFAULTS.events), // store ISO strings
  pomodoroDone: loadNum(K.done, DEFAULTS.pomodoroDone),
  pomodoroFailed: loadNum(K.failed, DEFAULTS.pomodoroFailed),
  dailyLogs: loadJSON(K.dailyLogs, DEFAULTS.dailyLogs),
  apiKey: loadStr(K.apiKey, DEFAULTS.apiKey),
  bgURL: loadStr(K.bgURL, DEFAULTS.bgURL),
  reportMsg: loadStr(K.reportMsg, DEFAULTS.reportMsg),
  analysisTime: loadStr(K.analysisTime, DEFAULTS.analysisTime),
  focusMsg: loadStr(K.focusMsg, DEFAULTS.focusMsg),
};

function persistAll(){
  saveJSON(K.goals, data.goals);
  localStorage.setItem(K.law, String(data.lawScore));
  localStorage.setItem(K.vocab, String(data.vocabCount));
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
  // Sunday = 0
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
  // ensure fields exist; keep ISO strings
  data.events = (data.events || []).map(e => ({
    id: e.id || crypto.randomUUID(),
    title: e.title || "未命名任務",
    date: e.date,          // ISO
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

  const todayKey = dateKey(new Date());
  const todayDone = data.events
    .filter(e => dateKey(new Date(e.date)) === todayKey && e.isDone)
    .map(e => e.title)
    .join(", ");

  const histLog = buildHistLog(5);

  const prompt = `
【身分】高考全職考生，28歲，之前賺的存款都快花光了。
【分析當下時間】：${currentTimeStr}
【今日數據】：完課：${todayDone || "（無）"}。專注成功：${data.pomodoroDone}。失敗：${data.pomodoroFailed}。
【使用者本日反思】：${state.reflection?.trim() ? state.reflection.trim() : "（無）"}
【歷史校正資料】：${histLog}。
【要求】：
1. 產出 200 字內深度學習診斷。點出不足與做得好的地方。Markdown **粗體** 關鍵字。
2. 回應使用者的「本日反思」並對話。
3. 進行性格與習性分析。
4. 會根據當下時間給予適當的回饋
5. 會參考過去五天的histLog給予整體回饋
6. 目標在督促學習和令人有動力學習
【結尾格式】：
SCORE: [0-100]
LOG: [50字今日總結]
CHAR: [性格習性分析，不超過100字]
`.trim();

  try{
    const fullMsg = await geminiGenerate(prompt);

    // 跟 Swift 版相同：畫面顯示 SCORE 前的段落
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

      data.dailyLogs[todayKey] = { score, summary: log, characterAnalysis: char };
      saveJSON(K.dailyLogs, data.dailyLogs);
    }

    data.reportMsg = reportText;
    data.analysisTime = currentTimeStr;
    persistAll();

    // 清空反思（跟 Swift 版一致）
    state.reflection = "";
  }catch(err){
    data.reportMsg = "**（AI 連線失敗）** 先把今天最重要的兩件事做完，再回來提交。";
    persistAll();
  }finally{
    state.isReportLoading = false;
    render();
  }
}

/** ========= UI Rendering ========= */
const elContent = document.getElementById("content");
const elTitle = document.getElementById("pageTitle");
const elSubtitle = document.getElementById("pageSubtitle");
const elTopbarRight = document.getElementById("topbarRight");
const elBg = document.getElementById("bg");

function setTab(tab){
  state.tab = tab;
  render();
}

function renderTopbar(){
  const map = {
    calendar: ["日程規劃", "用月曆抓節奏，點選日期管理任務"],
    focus: ["專注模式", "開始就別停，全職考生沒有退路"],
    dashboard: ["戰力診斷中心", "提交反思 → 產出教官戰術報告"],
    history: ["學習與性格履歷", "用分數點亮你的月曆"],
    settings: ["設定", "API Key / 背景 / 資料管理"],
  };

  const [t, s] = map[state.tab] || ["", ""];
  elTitle.textContent = t;
  elSubtitle.textContent = s;

  // 右上角：倒數天數（對應 Swift：目標 2026/01/31）
  const target = new Date(2026, 0, 31);
  const today = new Date();
  const diff = Math.ceil((target - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / (1000*60*60*24));
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
  // background
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
  // 若從日程帶任務名進來
  if(state.activeTaskFromSchedule){
    state.focusTaskName = state.activeTaskFromSchedule;
    state.activeTaskFromSchedule = "";
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
  const todayKey = dateKey(new Date());
  const todayDone = data.events.filter(e => dateKey(new Date(e.date)) === todayKey && e.isDone);
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
      <h3>進度計數器</h3>
      ${data.goals.map(g => counterRowHtml(g.subject, g.completed, g.total, `goal:${g.id}`, 1)).join("")}
      <div class="divider"></div>
      ${counterRowHtml("法學緒論", data.lawScore, 100, "law", 25)}
      ${counterRowHtml("英文單字", data.vocabCount, 0, "vocab", 10)}
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

function counterRowHtml(title, value, total, key, step){
  const display = total > 0 ? `${value}/${total}` : `${value}`;
  return `
    <div class="row-between" style="padding:10px 0;">
      <div><b>${escapeHtml(title)}</b></div>
      <div class="row" style="gap:8px;">
        <button class="btn" data-action="counterDec" data-key="${escapeAttr(key)}" data-step="${step}">－</button>
        <div class="mono" style="min-width:90px; text-align:center; font-weight:900;">${escapeHtml(display)}</div>
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

  // 月內 logs（新到舊）
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

let dialogMode = "add"; // add/edit
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
  // month nav (calendar + history 共用)
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

  // counters
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

  // settings
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
  if(key.startsWith("goal:")){
    const id = key.split(":")[1];
    const g = data.goals.find(x=> x.id === id);
    if(!g) return;
    g.completed = Math.max(0, g.completed + delta);
    // 可以限制不超過 total：若你想一致，就打開下面一行
    // g.completed = Math.min(g.total, g.completed);
    persistAll();
    return;
  }
  if(key === "law"){
    data.lawScore = Math.max(0, data.lawScore + delta);
    persistAll();
    return;
  }
  if(key === "vocab"){
    data.vocabCount = Math.max(0, data.vocabCount + delta);
    persistAll();
    return;
  }
}

/** ========= Focus timer logic ========= */
function toggleFocus(){
  const name = (document.getElementById("focusTaskName")?.value || state.focusTaskName || "").trim();
  state.focusTaskName = name;

  if(!state.isFocusing){
    // start
    state.isFocusing = true;
    state.focusStartTime = new Date();
    state.timeLeft = state.totalTime;
    startTimer();
  }else{
    // pause
    state.isFocusing = false;
    stopTimer();
  }
  render();
}

function startTimer(){
  stopTimer();
  state.timerId = setInterval(()=>{
    if(!state.isFocusing) return;
    state.timeLeft = Math.max(0, state.timeLeft - 1);

    if(state.timeLeft === 0){
      // success
      state.isFocusing = false;
      stopTimer();

      const taskTitle = state.focusTaskName || "未命名任務";
      const start = state.focusStartTime || new Date();

      // 如果有同名未完成讀書任務 → 直接完成它
      const idx = data.events.findIndex(e => e.title === taskTitle && e.type === "Study" && !e.isDone);
      if(idx >= 0){
        data.events[idx].isDone = true;
        data.events[idx].endTime = new Date().toISOString();
        persistAll();
      }else{
        upsertEvent({
          id: crypto.randomUUID(),
          title: taskTitle,
          date: start.toISOString(),
          endTime: new Date().toISOString(),
          type: "Study",
          isDone: true,
        });
      }

      data.pomodoroDone += 1;
      persistAll();

      fetchFocusJab(`任務達成：${taskTitle}`);

      // reset to total time (like Swift)
      state.timeLeft = state.totalTime;
      render();
    }else{
      // re-render occasionally for smooth-ish update
      if(state.timeLeft % 1 === 0) render();
    }
  }, 1000);
}

function stopTimer(){
  if(state.timerId){
    clearInterval(state.timerId);
    state.timerId = null;
  }
}

function abandonTask(){
  const taskTitle = (document.getElementById("focusTaskName")?.value || state.focusTaskName || "").trim() || "未命名任務";
  const start = state.focusStartTime || new Date();

  // Insert failed record (like Swift)
  upsertEvent({
    id: crypto.randomUUID(),
    title: taskTitle,
    date: start.toISOString(),
    endTime: new Date().toISOString(),
    type: "Study",
    isDone: false,
  });

  state.isFocusing = false;
  stopTimer();
  state.timeLeft = state.totalTime;

  data.pomodoroFailed += 1;
  persistAll();

  fetchFocusJab(`任務失敗：${taskTitle}`);
  render();
}

/** ========= Export/Import/Reset ========= */
function exportData(){
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      goals: data.goals,
      lawScore: data.lawScore,
      vocabCount: data.vocabCount,
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

  data.goals = Array.isArray(d.goals) ? d.goals : DEFAULTS.goals;
  data.lawScore = Number(d.lawScore ?? DEFAULTS.lawScore) || 0;
  data.vocabCount = Number(d.vocabCount ?? DEFAULTS.vocabCount) || 0;
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
  persistAll();
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

/** ========= Init ========= */
(function init(){
  checkDailyReset();
  normalizeEvents();
  persistAll(); // ensure defaults exist

  // initialize timer to default total time
  state.totalTime = 1500;
  state.timeLeft = 1500;

  // If user switches tab while focusing, we DO NOT auto-abandon (web differs from SwiftUI onDisappear),
  // but你要一致也可以在 setTab 時自動 abandon。
  render();

  // page visibility: if hidden, keep timer running (browser may throttle). We'll just keep state.
})();
