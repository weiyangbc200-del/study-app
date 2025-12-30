let state = {
    tab: 2,
    apiKey: localStorage.getItem('apiKey') || '',
    bgURL: localStorage.getItem('bgURL') || 'https://images.unsplash.com/photo-1542051841857-5f90071e7989?q=80&w=2070',
    law: parseInt(localStorage.getItem('law')) || 0,
    goals: JSON.parse(localStorage.getItem('goals')) || [
        {subject:"行政法", total:50, completed:0}, {subject:"政治學", total:30, completed:0},
        {subject:"行政學", total:40, completed:0}, {subject:"公共政策", total:20, completed:0}
    ],
    events: JSON.parse(localStorage.getItem('events')) || [],
    dailyLogs: JSON.parse(localStorage.getItem('dailyLogs')) || {},
    done: parseInt(localStorage.getItem('pomodoroDone')) || 0,
    failed: parseInt(localStorage.getItem('pomodoroFailed')) || 0,
    selectedDate: new Date(),
    reflection: '', reportMsg: '教官待命中...', focusMsg: '全職考生，你沒有退路。',
    loading: false, isActive: false, timeLeft: 1500, totalTime: 1500, focusTask: ''
};

function sync() {
    localStorage.setItem('apiKey', state.apiKey); localStorage.setItem('bgURL', state.bgURL);
    localStorage.setItem('goals', JSON.stringify(state.goals)); localStorage.setItem('law', state.law);
    localStorage.setItem('events', JSON.stringify(state.events)); localStorage.setItem('logs', JSON.stringify(state.dailyLogs));
    localStorage.setItem('pomodoroDone', state.done); localStorage.setItem('pomodoroFailed', state.failed);
}

// 渲染月曆 HTML
function getCalendarHTML() {
    const d = state.selectedDate; const year = d.getFullYear(); const month = d.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    let grid = `<div class="calendar-grid">`;
    ['日','一','二','三','四','五','六'].forEach(w => grid += `<div class="text-[10px] text-gray-600 font-bold mb-2">${w}</div>`);
    for (let i = 0; i < firstDay; i++) grid += `<div></div>`;
    for (let i = 1; i <= daysInMonth; i++) {
        const isSel = d.getDate() === i;
        const isToday = today.getFullYear()===year && today.getMonth()===month && today.getDate()===i;
        grid += `<div onclick="selectDay(${i})" class="day-cell ${isSel?'day-selected':''} ${isToday?'day-today':''}">${i}</div>`;
    }
    return `<div class="calendar-container">
        <div class="flex justify-between items-center mb-4 px-2">
            <button onclick="changeMonth(-1)"><i class="bi bi-chevron-left text-gray-500"></i></button>
            <span class="font-bold text-sm">${year}年 ${month+1}月</span>
            <button onclick="changeMonth(1)"><i class="bi bi-chevron-right text-gray-500"></i></button>
        </div>${grid}</div></div>`;
}

// AI 連線 (100% 原始 Prompt)
async function fetchAI(type, reason="") {
    if (!state.apiKey) return alert("請設定 API Key");
    if (type === 'report') state.loading = true; render();
    const nowStr = new Date().toLocaleString();
    const todayKey = new Date().toISOString().split('T')[0].replace(/-/g,'');
    const todayTasks = state.events.filter(e => e.date.startsWith(todayKey) && e.isDone).map(e => e.title).join(',');
    const getPK = (n) => { let x = new Date(); x.setDate(x.getDate()-n); return x.toISOString().split('T')[0].replace(/-/g,''); };
    const histLog = `昨日：${state.dailyLogs[getPK(1)]?.summary || "無"}, 前日：${state.dailyLogs[getPK(2)]?.summary || "無"}`;

    let prompt = type==='jab' ? `身分：高冷嚴厲教官。分析時間：${nowStr}。任務狀態：${reason}。成功：${state.done}。請給予一句 20 字內的反饋（請使用 Markdown **粗體**）。` :
    `【身分】高考全職考生，28歲，之前賺的存款都快花光了。\n【分析當下時間】：${nowStr}\n【今日數據】：完課：${todayTasks}。專注成功：${state.done}。失敗：${state.failed}。\n【使用者本日反思】：${state.reflection || "（無）"}\n【歷史校正資料】：${histLog}。\n【要求】：\n1. 產出 200 字內深度學習診斷。點出不足與做得好的地方。Markdown **粗體** 關鍵字。\n2. 回應使用者的「本日反思」並對話。\n3. 進行性格與習性分析。\n4. 會根據當下時間給予適當的回饋\n5. 會參考過去五天的histLog給予整體回饋\n6. 目標在督促學習和令人有動力學習\n【結尾格式】：\nSCORE: [0-100]\nLOG: [50字今日總結]\nCHAR: [性格習性分析，不超過100字]`;

    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${state.apiKey}`, {
            method: 'POST', body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await res.json();
        const fullMsg = data.candidates[0].content.parts[0].text;
        if (type === 'report') {
            const comps = fullMsg.split("SCORE:");
            state.reportMsg = (comps[0] || fullMsg).replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
            if (comps.length > 1) {
                const scComp = comps[1].split("LOG:");
                const score = parseInt(scComp[0].trim());
                const logComp = scComp[1].split("CHAR:");
                state.dailyLogs[todayKey] = { score, summary: logComp[0]?.trim(), char: logComp[1]?.trim() };
            }
        } else { state.focusMsg = fullMsg.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>'); }
    } catch (e) { state.reportMsg = "分析失敗。"; }
    state.loading = false; sync(); render();
}

function render() {
    document.getElementById('main-bg').style.backgroundImage = `url('${state.bgURL}')`;
    const container = document.getElementById('content');
    const selKey = state.selectedDate.toISOString().split('T')[0].replace(/-/g,'');

    if (state.tab === 0) {
        container.innerHTML = `<div class="glass p-2 mb-6">${getCalendarHTML()}</div>
            <div class="space-y-4">
                ${state.events.filter(e => e.date.startsWith(selKey)).map(e => `
                <div class="glass p-4 flex items-center gap-4">
                    <i onclick="toggleDone('${e.id}')" class="bi ${e.isDone?'bi-check-circle-fill text-cyan-400':'bi-circle'} text-2xl"></i>
                    <div class="flex-1"><p class="font-bold text-sm ${e.isDone?'line-through text-gray-500':''}">${e.title}</p><p class="text-[9px] text-gray-500 uppercase">Mission</p></div>
                    <button onclick="deleteEv('${e.id}')" class="text-red-900 opacity-40"><i class="bi bi-trash3"></i></button>
                </div>`).join('')}
                <button onclick="addEv()" class="w-full py-5 border-2 border-dashed border-white/10 rounded-2xl text-gray-500 font-bold">+ 加入日程規劃</button>
            </div>`;
    } else if (state.tab === 1) {
        const circ = 2 * Math.PI * 45; const offset = circ - (state.timeLeft / state.totalTime) * circ;
        container.innerHTML = `<div class="timer-wrapper">
            <input id="f-task" class="w-full text-center p-4 rounded-xl mb-12 glass font-bold" placeholder="攻克目標..." value="${state.focusTask}">
            <div class="timer-circle-box">
                <svg class="progress-svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="3"/><circle cx="50" cy="50" r="45" fill="none" stroke="#22d3ee" stroke-width="3" stroke-dasharray="${circ}" stroke-dashoffset="${offset}" stroke-linecap="round"/></svg>
                <span class="timer-text">${Math.floor(state.timeLeft/60)}:${String(state.timeLeft%60).padStart(2,'0')}</span>
            </div>
            <div class="report-content italic text-center text-cyan-400 px-10 h-12 mb-10 flex items-center justify-center">${state.focusMsg}</div>
            <div class="flex items-center gap-10">
                <button onclick="adjT(-300)" class="bi bi-dash-circle text-2xl text-gray-600"></button>
                <button onclick="toggleF()" class="bg-cyan-600 px-12 py-3 rounded-2xl font-bold shadow-lg">${state.isActive?'暫停':'開始'}</button>
                <button onclick="adjT(300)" class="bi bi-plus-circle text-2xl text-gray-600"></button>
            </div><button onclick="abandon()" class="mt-16 text-red-500 opacity-40 text-[10px] font-bold tracking-widest">放棄本次專注</button></div>`;
    } else if (state.tab === 2) {
        container.innerHTML = `<h1 class="text-3xl font-black italic mb-6">戰力診斷</h1>
            <textarea oninput="state.reflection=this.value" class="w-full p-4 rounded-2xl glass h-28 mb-6 text-sm" placeholder="本日自省...">${state.reflection}</textarea>
            <div class="glass p-5 border-l-4 border-cyan-400 mb-8 bg-black/50"><div class="report-content">${state.loading ? '閱卷中...' : state.reportMsg}</div></div>
            <div class="glass p-5 space-y-4 mb-8">
                ${state.goals.map((g,i)=>`<div class="flex justify-between text-sm items-center"><span>${g.subject}</span><div class="flex items-center gap-5"><button onclick="addGoal(${i},-1)">-</button><span class="w-16 text-center font-bold text-cyan-400">${g.completed}/${g.total}</span><button onclick="addGoal(${i},1)">+</button></div></div>`).join('')}
                <div class="flex justify-between text-sm border-t border-white/5 pt-5"><span>法學緒論</span><div class="flex items-center gap-5"><button onclick="addLaw(-25)">-</button><span class="w-16 text-center font-bold text-cyan-400">${state.law}/100</span><button onclick="addLaw(25)">+</button></div></div>
            </div><button onclick="fetchAI('report')" class="w-full py-5 bg-cyan-600/40 rounded-2xl font-black shadow-xl">提交診斷報告</button>`;
    } else if (state.tab === 3) {
        const log = state.dailyLogs[selKey];
        container.innerHTML = `<div class="glass p-2 mb-6">${getCalendarHTML()}</div>
            ${log ? `<div class="glass p-6 space-y-6"><div class="flex justify-between items-center text-gray-400 font-bold uppercase text-xs"><span>教官評分</span><span class="text-4xl font-black text-green-400">${log.score}</span></div><p class="text-sm leading-relaxed">${log.summary}</p><p class="text-sm italic text-cyan-200/60 border-t border-white/5 pt-4">${log.char || ""}</p></div>` : `<p class="text-center text-gray-600 py-20 italic">選取日無數據</p>`}`;
    } else if (state.tab === 4) {
        container.innerHTML = `<h2 class="text-xl font-bold mb-10 italic">軍情室設定</h2><div class="space-y-10"><div><label class="text-[10px] text-gray-500 font-bold block mb-2 tracking-widest uppercase">Gemini API Key</label><input type="password" onchange="state.apiKey=this.value;sync()" class="w-full p-5 glass rounded-2xl font-mono text-xs" value="${state.apiKey}"></div><div><label class="text-[10px] text-gray-500 font-bold block mb-2 tracking-widest uppercase">背景 URL</label><input onchange="state.bgURL=this.value;sync();render()" class="w-full p-5 glass rounded-2xl text-[10px]" value="${state.bgURL}"></div></div>`;
    }
    for(let i=0; i<5; i++) document.getElementById('t'+i).className = `tab-btn ${state.tab===i?'tab-active':''}`;
}

function switchTab(i) { if(state.isActive && i!==1) abandon(); state.tab=i; render(); }
function changeMonth(v) { state.selectedDate.setMonth(state.selectedDate.getMonth() + v); render(); }
function selectDay(d) { state.selectedDate.setDate(d); render(); }
function addGoal(i, v) { state.goals[i].completed = Math.max(0, state.goals[i].completed + v); sync(); render(); }
function addLaw(v) { state.law = Math.max(0, Math.min(100, state.law + v)); sync(); render(); }
function toggleDone(id) { const idx=state.events.findIndex(e=>e.id===id); state.events[idx].isDone = !state.events[idx].isDone; sync(); render(); }
function deleteEv(id) { state.events = state.events.filter(e=>e.id!==id); sync(); render(); }
function addEv() { const t=prompt("任務內容?"); if(t){ state.events.unshift({id:Date.now().toString(), title:t, date:state.selectedDate.toISOString().replace(/\D/g,'').slice(0,8)+"0000", isDone:false}); sync(); render(); }}

let timer;
function toggleF() {
    state.isActive = !state.isActive; state.focusTask = document.getElementById('f-task')?.value || "戰術攻堅";
    if(state.isActive) { timer = setInterval(() => { if(state.timeLeft > 0) { state.timeLeft--; render(); } else { clearInterval(timer); state.isActive=false; state.done++; state.timeLeft=state.totalTime; fetchAI('jab', "任務完成"); sync(); render(); } }, 1000); } 
    else clearInterval(timer); render();
}
function adjT(v) { if(!state.isActive) { state.totalTime = Math.max(60, state.totalTime + v); state.timeLeft = state.totalTime; render(); } }
function abandon() { clearInterval(timer); state.isActive=false; state.failed++; state.events.unshift({id:Date.now().toString(), title:state.focusTask||"分心任務", date:new Date().toISOString().replace(/\D/g,'').slice(0,12), isDone:false}); state.timeLeft=state.totalTime; fetchAI('jab', "放棄任務"); sync(); render(); }

window.onload = () => { render(); };
