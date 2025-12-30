let state = {
    tab: 2,
    apiKey: localStorage.getItem('key') || '',
    bg: localStorage.getItem('bg') || 'https://images.unsplash.com/photo-1542051841857-5f90071e7989?q=80&w=2070',
    goals: JSON.parse(localStorage.getItem('goals')) || [
        {subject: "行政法", total: 50, completed: 0},
        {subject: "政治學", total: 30, completed: 0},
        {subject: "行政學", total: 40, completed: 0},
        {subject: "公共政策", total: 20, completed: 0}
    ],
    law: parseInt(localStorage.getItem('law')) || 0,
    events: JSON.parse(localStorage.getItem('events')) || [],
    dailyLogs: JSON.parse(localStorage.getItem('logs')) || {},
    done: parseInt(localStorage.getItem('done')) || 0,
    failed: parseInt(localStorage.getItem('failed')) || 0,
    selectedDate: new Date(),
    reflection: '', report: '戰略報告準備中...', focusMsg: '全職考生，你沒有退路。', loading: false,
    isActive: false, timeLeft: 1500, totalTime: 1500, focusTask: ''
};

function sync() {
    localStorage.setItem('key', state.apiKey); localStorage.setItem('bg', state.bg);
    localStorage.setItem('goals', JSON.stringify(state.goals)); localStorage.setItem('law', state.law);
    localStorage.setItem('events', JSON.stringify(state.events)); localStorage.setItem('logs', JSON.stringify(state.dailyLogs));
    localStorage.setItem('done', state.done); localStorage.setItem('failed', state.failed);
}

// 渲染月曆 HTML
function getCalendarHTML() {
    const d = state.selectedDate;
    const year = d.getFullYear();
    const month = d.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    let html = `
        <div class="calendar-header">
            <button onclick="moveMonth(-1)"><i class="bi bi-chevron-left-circle-fill"></i></button>
            <span style="font-weight:bold">${year}年 ${month+1}月</span>
            <button onclick="moveMonth(1)"><i class="bi bi-chevron-right-circle-fill"></i></button>
        </div>
        <div class="calendar-grid">
            ${['日','一','二','三','四','五','六'].map(w => `<div class="weekday-header">${w}</div>`).join('')}
            ${Array(firstDay).fill('<div></div>').join('')}
            ${Array.from({length: daysInMonth}, (_, i) => {
                const day = i + 1;
                const isSel = d.getDate() === day;
                const isToday = today.getFullYear()===year && today.getMonth()===month && today.getDate()===day;
                return `<div onclick="selectDay(${day})" class="day-cell ${isSel?'day-selected':''} ${isToday?'day-today':''}">${day}</div>`;
            }).join('')}
        </div>`;
    return html;
}

// AI 診斷 (完全保留 28歲/存款 Prompt)
async function fetchAI(type, reason="") {
    if (!state.apiKey) return;
    if (type === 'report') state.loading = true; render();
    const nowStr = new Date().toLocaleString();
    const todayKey = new Date().toISOString().split('T')[0].replace(/-/g,'');
    
    let prompt = "";
    if (type === 'jab') {
        prompt = `身分：高冷嚴厲教官。分析時間：${nowStr}。任務狀態：${reason}。成功：${state.done}。請給予一句 20 字內的反饋（請使用 Markdown **粗體**）。`;
    } else {
        prompt = `【身分】高考全職考生，28歲，之前賺的存款都快花光了。
【分析當下時間】：${nowStr}
【今日數據】：專注成功：${state.done}。失敗：${state.failed}。
【使用者本日反思】：${state.reflection || "（無）"}
【要求】：1. 產出 200 字內深度學習診斷。點出不足與做得好的地方。Markdown **粗體** 關鍵字。 2. 回應本日反思並對話。 3. 進行性格與習性分析。 4. 會根據當下時間給予適當的回饋。
【結尾格式】：SCORE: [0-100] LOG: [50字今日總結] CHAR: [性格習性分析，不超過100字]`;
    }

    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${state.apiKey}`, {
            method: 'POST', body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await res.json();
        const fullMsg = data.candidates[0].content.parts[0].text;
        if (type === 'report') {
            const comps = fullMsg.split("SCORE:");
            state.report = (comps[0] || fullMsg).replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
            if (comps.length > 1) {
                const scComp = comps[1].split("LOG:");
                const score = parseInt(scComp[0].trim());
                const logComp = scComp[1].split("CHAR:");
                state.dailyLogs[todayKey] = { score, summary: logComp[0].trim(), char: logComp[1].trim() };
            }
        } else { state.focusMsg = fullMsg.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>'); }
    } catch (e) { console.error(e); }
    state.loading = false; sync(); render();
}

function render() {
    document.getElementById('main-bg').style.backgroundImage = `url('${state.bg}')`;
    const view = document.getElementById('view-builder');
    const selKey = state.selectedDate.toISOString().split('T')[0].replace(/-/g,'');

    if (state.tab === 0) { // 日程
        view.innerHTML = `
            <div class="glass calendar-container">${getCalendarHTML()}</div>
            <div class="space-y-3">
                ${state.events.filter(e => e.date.startsWith(selKey)).map(e => `
                    <div class="glass p-4 flex items-center gap-4">
                        <i class="bi ${e.done?'bi-check-circle-fill text-cyan-400':'bi-circle'} text-xl"></i>
                        <span class="font-bold">${e.title}</span>
                    </div>`).join('')}
                <button onclick="addEv()" class="w-full py-5 border-2 border-dashed border-white/10 rounded-2xl mt-5 text-gray-500 font-bold">+ 加入日程</button>
            </div>`;
    } 
    else if (state.tab === 1) { // 專注
        view.innerHTML = `
            <div class="flex flex-col items-center pt-10">
                <input id="f-task" class="w-full text-center p-4 rounded-xl mb-12 glass" placeholder="現在要做什麼？" value="${state.focusTask}">
                <div class="text-6xl font-mono font-bold mb-10 text-cyan-400">${Math.floor(state.timeLeft/60)}:${String(state.timeLeft%60).padStart(2,'0')}</div>
                <div class="report-content text-cyan-400 italic text-center px-10 mb-10 h-10">${state.focusMsg}</div>
                <div class="flex gap-10">
                    <button onclick="adjT(-300)" class="bi bi-minus-circle text-2xl"></button>
                    <button onclick="toggleF()" class="bg-cyan-600 px-10 py-2 rounded-xl font-bold">${state.isActive?'暫停':'開始'}</button>
                    <button onclick="adjT(300)" class="bi bi-plus-circle text-2xl"></button>
                </div>
                <button onclick="abandon()" class="mt-10 text-red-500 opacity-50">放棄</button>
            </div>`;
    }
    else if (state.tab === 2) { // 看板
        view.innerHTML = `
            <h1 class="text-2xl font-bold mb-6 italic">戰力診斷中心</h1>
            <textarea oninput="state.reflection=this.value" class="w-full p-4 rounded-xl glass h-24 mb-6" placeholder="報告今天的心情...">${state.reflection}</textarea>
            <div class="glass p-5 border-l-4 border-cyan-400 mb-8">
                <div class="report-content">${state.loading ? '教官閱卷中...' : state.report}</div>
            </div>
            <div class="glass p-5 space-y-4 mb-6">
                ${state.goals.map((g,i)=>`<div class="flex justify-between text-sm"><span>${g.subject}</span><div><button onclick="addG(${i},-1)">-</button><span class="mx-3 font-mono text-cyan-400">${g.completed}/${g.total}</span><button onclick="addG(${i},1)">+</button></div></div>`).join('')}
                <div class="flex justify-between text-sm border-t border-white/5 pt-4"><span>法學緒論</span><div><button onclick="addL(-25)">-</button><span class="mx-3 font-mono text-cyan-400">${state.law}/100</span><button onclick="addL(25)">+</button></div></div>
            </div>
            <button onclick="fetchAI('report')" class="w-full py-4 bg-cyan-600/50 rounded-xl font-bold">產出戰術報告</button>`;
    }
    else if (state.tab === 3) { // 學歷
        const log = state.dailyLogs[selKey];
        view.innerHTML = `
            <div class="glass calendar-container">${getCalendarHTML()}</div>
            ${log ? `
                <div class="glass p-6">
                    <div class="flex justify-between mb-4"><span class="text-gray-400 font-bold">教官評分</span><span class="text-3xl text-green-400">${log.score}</span></div>
                    <p class="text-sm mb-6">${log.summary}</p>
                    <p class="text-xs italic text-cyan-200/60">${log.char}</p>
                </div>` : `<p class="text-center text-gray-500 py-10 italic">選取日期無資料</p>`}`;
    }
    else if (state.tab === 4) { // 設定
        view.innerHTML = `<h2 class="mb-10 font-bold">設定</h2><div class="space-y-8"><div><label class="text-[10px] text-gray-500">API KEY</label><input type="password" onchange="state.apiKey=this.value;sync()" class="w-full p-4 glass" value="${state.apiKey}"></div><div><label class="text-[10px] text-gray-500">背景 URL</label><input onchange="state.bg=this.value;sync();render()" class="w-full p-4 glass text-xs" value="${state.bg}"></div></div>`;
    }

    // 更新導覽
    for(let i=0; i<5; i++) document.getElementById('t'+i).className = `tab-btn ${state.tab===i?'tab-active':''}`;
}

// 邏輯函式
function tab(i) { if(state.isActive && i!==1) abandon(); state.tab=i; render(); }
function moveMonth(v) { state.selectedDate.setMonth(state.selectedDate.getMonth() + v); render(); }
function selectDay(d) { state.selectedDate.setDate(d); render(); }
function addG(i,v) { state.goals[i].completed = Math.max(0, state.goals[i].completed + v); sync(); render(); }
function addL(v) { state.law = Math.max(0, Math.min(100, state.law + v)); sync(); render(); }
function addEv() { const t = prompt("任務內容?"); if(t) { state.events.push({id:Date.now(), title:t, date:state.selectedDate.toISOString().replace(/\D/g,'').slice(0,8)+"0000", done:false}); sync(); render(); } }

let timer;
function toggleF() { 
    state.isActive = !state.isActive; 
    state.focusTask = document.getElementById('f-task')?.value || "攻堅";
    if(state.isActive) {
        timer = setInterval(() => {
            if(state.timeLeft > 0) { state.timeLeft--; render(); }
            else { clearInterval(timer); state.isActive=false; state.done++; state.timeLeft=state.totalTime; fetchAI('jab', "達成任務"); sync(); render(); }
        }, 1000);
    } else clearInterval(timer);
    render();
}
function adjT(v) { if(!state.isActive) { state.totalTime = Math.max(60, state.totalTime + v); state.timeLeft = state.totalTime; render(); } }
function abandon() { clearInterval(timer); state.isActive=false; state.failed++; state.timeLeft=state.totalTime; fetchAI('jab', "失敗"); sync(); render(); }

window.onload = render;
ｃｃ
