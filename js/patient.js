(function patientApp() {
  const state = {
    patientId: sessionStorage.getItem('userId') || 'patient01',
    isDarkMode: localStorage.getItem('theme') === 'dark',
    taskStep: 'idle', // idle/action/result
    taskMode: 'arm',  
    targetReps: 3,
    arm: { angle: 0, reps: 0, status: 'down', max: 0 },
    grip: { score: 0, reps: 0, status: 'open', max: 0 },
    reaction: { targets: [], score: 0, startTime: 0, totalTime: 0 },
    lastSession: { xp: 0, rom: 0, reps: 0 },
    ai: { loading: false, camera: false },
    currentView: 'home',
    history: [],
    stats: {
      xp: parseInt(sessionStorage.getItem('patientXP')) || 0,
      level: parseInt(sessionStorage.getItem('patientLevel')) || 1,
      nextLevelXp: 500,
      loginStreak: parseInt(localStorage.getItem(`login_streak_${sessionStorage.getItem('userId') || 'patient01'}`)) || 0
    },
    web3: {
      healBalance: 0,
      sbtList: [],
      isVerifying: false,
      lastTxHash: null
    },
    mathQuiz: { 
      question: '', 
      answer: null, 
      options: [], 
      streak: parseInt(sessionStorage.getItem('mathStreak')) || 0 
    },
    mathTasksCount: 0,
    cameraTasks: { arm: 0, grip: 0, reaction: 0 },
    hasTakenMeds: false
  };

  let detector = null, stream = null, rafId = null;

  async function init() {
    healscapeAuth.checkAuth('patient');
    if (state.isDarkMode) document.body.classList.add('dark-mode');
    checkDailyLimits();
    try {
      const [data, sbts] = await Promise.all([
        healscapeApi.getPatientData(state.patientId),
        healscapeApi.getSoulboundTokens(state.patientId)
      ]);
      state.history = data.history || [];
      state.web3.healBalance = window.blockchain.getBalance();
      state.web3.sbtList = sbts;
    } catch(e) { console.error("Data load failed", e); }
    state.stats.nextLevelXp = state.stats.level * 500;
    generateMathQuiz();
    checkDailyCheckIn();
    render();
  }

  function checkDailyCheckIn() {
    const lastDate = localStorage.getItem(`last_checkin_${state.patientId}`);
    const todayStr = new Date().toISOString().split('T')[0];
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    state.canCheckIn = lastDate !== todayStr;
    
    if (state.canCheckIn && lastDate !== yesterdayStr) {
      // 斷開連續了
      state.stats.loginStreak = 0;
      localStorage.setItem(`login_streak_${state.patientId}`, '0');
    }
  }

  function checkDailyLimits() {
    const today = new Date().toISOString().split('T')[0];
    const lastDate = localStorage.getItem(`tasks_date_${state.patientId}`);
    if (lastDate !== today) {
      localStorage.setItem(`tasks_date_${state.patientId}`, today);
      localStorage.setItem(`math_tasks_count_${state.patientId}`, '0');
      localStorage.setItem(`task_count_arm_${state.patientId}`, '0');
      localStorage.setItem(`task_count_grip_${state.patientId}`, '0');
      localStorage.setItem(`task_count_reaction_${state.patientId}`, '0');
      localStorage.setItem(`has_taken_meds_${state.patientId}`, 'false');
    }
    state.mathTasksCount = parseInt(localStorage.getItem(`math_tasks_count_${state.patientId}`)) || 0;
    state.cameraTasks = {
      arm: parseInt(localStorage.getItem(`task_count_arm_${state.patientId}`)) || 0,
      grip: parseInt(localStorage.getItem(`task_count_grip_${state.patientId}`)) || 0,
      reaction: parseInt(localStorage.getItem(`task_count_reaction_${state.patientId}`)) || 0
    };
    state.hasTakenMeds = localStorage.getItem(`has_taken_meds_${state.patientId}`) === 'true';
  }

  async function performCheckIn() {
    if (!state.canCheckIn) return toast("今日已簽到過囉！");
    
    // 增加連續登入計數
    const newStreak = (state.stats.loginStreak || 0) + 1;
    state.stats.loginStreak = newStreak;
    localStorage.setItem(`login_streak_${state.patientId}`, newStreak);
    
    let bonus = 0;
    if (newStreak >= 7) bonus = 10;
    else if (newStreak >= 3) bonus = 5;
    
    const totalAward = 10 + bonus;
    
    await window.showBlockchainProgress(`正在驗證連續登入 (${newStreak} 天)...`, 2000);
    await window.blockchain.mint(totalAward, `每日簽到獎勵 (含加成)`);
    window.showCoinMinted(totalAward);
    
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem(`last_checkin_${state.patientId}`, today);
    state.canCheckIn = false;
    state.web3.healBalance = window.blockchain.getBalance();
    render();
  }

  async function redeemDiscount() {
    const amount = 100;
    if (state.web3.healBalance < amount) return toast("健康幣不足 100 枚 (需 100 枚折抵 10 元)");
    
    const ok = confirm(`確定要銷毀 ${amount} 健康幣來兌換 $10 元診斷費折抵嗎？\n此動作將寫入區塊鏈不可撤銷。`);
    if (ok) {
        await window.showBlockchainProgress("正在執行銷毀並生成折扣憑證...", 2500);
        window.blockchain.burn(amount, "兌換診斷費折扣");
        state.web3.healBalance = window.blockchain.getBalance();
        toast("兌換成功！已折抵 10 元");
        render();
    }
  }

  function generateMathQuiz() {
    const balance = state.web3.healBalance || 0;
    const difficulty = Math.floor(balance / 50); 
    const max = 10 + difficulty * 10;
    const a = Math.floor(Math.random() * max) + 1;
    const b = Math.floor(Math.random() * max) + 1;
    const op = Math.random() > 0.5 ? '+' : '-';
    const answer = op === '+' ? a + b : a - b;
    const question = `${a} ${op} ${b} = ?`;
    let options = [answer];
    while (options.length < 3) {
      const wrong = answer + (Math.floor(Math.random() * (Math.max(10, max/2))) - Math.floor(Math.max(5, max/4)));
      if (!options.includes(wrong) && wrong !== answer) options.push(wrong);
    }
    state.mathQuiz = { ...state.mathQuiz, question, answer, options: options.sort(() => Math.random() - 0.5) };
  }

  function gainXp(amount) {
    state.stats.xp += amount;
    while (state.stats.xp >= state.stats.nextLevelXp) {
      state.stats.xp -= state.stats.nextLevelXp;
      state.stats.level++;
      state.stats.nextLevelXp = state.stats.level * 500;
      toast(`恭喜升級！目前等級：LVL ${state.stats.level}`);
    }
    sessionStorage.setItem('patientXP', state.stats.xp);
    sessionStorage.setItem('patientLevel', state.stats.level);
    render();
  }

  function render() {
    const app = document.getElementById('patient-app');
    if (!app) return;
    const isHome = state.currentView === 'home';
    const xpPct = Math.min((state.stats.xp / state.stats.nextLevelXp) * 100, 100);

    app.style.height = "100%";

    app.innerHTML = `
      <section class="h-full flex flex-col bg-[var(--bg-app)] text-[var(--text-main)] overflow-hidden font-sans">
        <header class="bg-[var(--bg-header)] p-7 pb-5 shrink-0 border-b border-[var(--border-color)] shadow-sm">
          <div class="flex justify-between items-start mb-4">
            <div>
              <h2 class="text-3xl font-black tracking-tight leading-none">HealScape <span class="text-teal-600">癒見</span></h2>
              <p class="text-[9px] text-teal-600 font-black uppercase tracking-[0.2em] mt-2 flex items-center gap-1.5">
                <span class="w-1.5 h-1.5 bg-teal-500 rounded-full animate-pulse"></span>
                PoPW 醫療網絡已連線
              </p>
            </div>
            <div class="flex items-center gap-2">
              <button data-act="reset-tasks" class="w-10 h-10 bg-red-500/10 hover:bg-red-500/20 rounded-xl flex items-center justify-center text-red-500 transition-colors border border-red-500/20" title="測試用：重置每日任務">
                <i class="fa-solid fa-rotate-right"></i>
              </button>
              <button data-act="toggle-theme" class="theme-toggle">
                ${state.isDarkMode ? '🌙' : '☀️'}
              </button>
              <button onclick="healscapeAuth.logout()" class="w-10 h-10 bg-[var(--bg-app)] hover:bg-[var(--border-color)] rounded-xl flex items-center justify-center text-slate-400 transition-colors border border-[var(--border-color)]">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              </button>
            </div>
          </div>
          <div class="space-y-1.5">
            <div class="flex justify-between text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
              <span>同步等級: LVL ${state.stats.level}</span>
              <span>進度: ${state.stats.xp} / ${state.stats.nextLevelXp}</span>
            </div>
            <div class="h-2 bg-slate-200/20 rounded-full overflow-hidden">
              <div class="h-full bg-teal-500 transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(20,184,166,0.3)]" style="width: ${xpPct}%"></div>
            </div>
          </div>
        </header>

        <main class="flex-1 overflow-y-auto no-scrollbar p-5 pt-2">
          ${isHome ? (
            state.taskStep === 'idle' ? renderHome() : 
            state.taskStep === 'action' ? renderTaskInterface() : renderResultView()
          ) : renderDataView()}
        </main>

        <nav class="bg-[var(--bg-header)] border-t border-[var(--border-color)] p-4 pb-10 flex justify-around shrink-0 shadow-[0_-4px_24px_rgba(0,0,0,0.03)]">
          <button data-act="nav-home" class="${isHome ? 'text-teal-600' : 'text-slate-400'} flex flex-col items-center gap-1.5 transition-all">
            <svg class="w-7 h-7" fill="${isHome ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            <span class="text-[10px] font-black uppercase tracking-widest">主頁</span>
          </button>
          <button data-act="nav-data" class="${!isHome ? 'text-teal-600' : 'text-slate-400'} flex flex-col items-center gap-1.5 transition-all">
            <svg class="w-7 h-7" fill="${!isHome ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            <span class="text-[10px] font-black uppercase tracking-widest">趨勢</span>
          </button>
        </nav>
      </section>
    `;

    if (state.taskStep === 'action' && stream) {
      const video = document.getElementById('cam');
      if (video) video.srcObject = stream;
    }
  }

  function renderHome() {
    return `
      <!-- 康復階段視覺化 -->
      <div class="bg-white/80 backdrop-blur-xl p-6 rounded-[32px] border border-[var(--border-color)] mb-6 shadow-sm relative overflow-hidden">
        <div class="flex justify-between items-center mb-4">
          <div>
            <h4 class="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">目前康復階段</h4>
            <div class="text-xl font-black text-slate-800">
              ${state.stats.level <= 3 ? '🛏️ 臥床休養期' : (state.stats.level <= 7 ? '🪑 坐姿訓練期' : (state.stats.level <= 12 ? '🚶 站立步態期' : '🏃 活力回歸期'))}
            </div>
          </div>
          <div class="text-right">
             <div class="text-[9px] font-bold text-teal-600 uppercase">連續登入</div>
             <div class="text-xl font-black text-teal-600">${state.stats.loginStreak} 天</div>
          </div>
        </div>
        <div class="h-1.5 bg-slate-100 rounded-full overflow-hidden flex gap-1">
          ${[0, 4, 8, 12].map(lv => `
            <div class="h-full flex-1 transition-all duration-1000 ${state.stats.level > lv ? 'bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.5)]' : 'bg-slate-200'}"></div>
          `).join('')}
        </div>
        <div class="flex justify-between mt-2 text-[8px] font-bold text-slate-400 uppercase tracking-tighter">
          <span>Level 1</span>
          <span>Level 5</span>
          <span>Level 9</span>
          <span>Level 13+</span>
        </div>
      </div>

      <!-- $HEAL 卡片 -->
      <div class="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-[32px] text-white shadow-xl mb-6 border border-white/5 relative overflow-hidden group">
        <div class="absolute -right-4 -top-4 w-32 h-32 bg-teal-500/10 rounded-full blur-3xl"></div>
        <div class="relative z-10">
          <div class="flex justify-between items-start mb-4">
             <div>
                <h4 class="text-[10px] font-black uppercase tracking-[0.2em] text-teal-400 mb-1 flex items-center gap-2">
                    <span class="w-1.5 h-1.5 bg-teal-500 rounded-full animate-pulse"></span>
                    Blockchain Wallet
                </h4>
                <div class="flex items-baseline gap-2">
                  <span class="text-4xl font-black tracking-tight text-white">${Math.floor(state.web3.healBalance)}</span>
                  <span class="text-xs font-bold text-slate-400">健康幣</span>
                </div>
                <div class="text-[8px] font-mono text-slate-500 mt-1 uppercase opacity-60">ID: ${window.blockchain.walletAddress}</div>
             </div>
             <div class="text-4xl drop-shadow-[0_0_10px_rgba(234,179,8,0.4)]">
                <i class="fa-solid fa-coins text-yellow-500"></i>
             </div>
          </div>
          
          <div class="grid grid-cols-2 gap-3 mt-4">
            <button data-act="daily-checkin" class="flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 text-white font-black py-2.5 px-4 rounded-2xl text-[10px] transition-all active:scale-95 disabled:opacity-50 disabled:bg-slate-700" ${state.canCheckIn ? '' : 'disabled'}>
                <i class="fa-solid fa-calendar-check"></i> ${state.canCheckIn ? '領取獎勵' : '今日已領'}
            </button>
            <button data-act="take-meds" class="flex items-center justify-center gap-2 bg-red-500 hover:bg-red-400 text-white font-black py-2.5 px-4 rounded-2xl text-[10px] transition-all active:scale-95 disabled:opacity-50 disabled:bg-slate-700" ${state.hasTakenMeds ? 'disabled' : ''}>
                <i class="fa-solid fa-pills"></i> ${state.hasTakenMeds ? '今日已服藥' : '每日服藥回報'}
            </button>
          </div>
          <div class="grid grid-cols-1 gap-3 mt-3">
            <button data-act="redeem-heal" class="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-teal-300 font-black py-2.5 px-4 rounded-2xl text-[10px] border border-teal-500/20 transition-all active:scale-95">
                <i class="fa-solid fa-ticket"></i> 兌換折扣
            </button>
          </div>
        </div>
      </div>

      <!-- SBT 展示 -->
      <div class="mb-8">
        <h3 class="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] mb-4 px-1">健康憑證 (SBT)</h3>
        <div class="flex gap-4 overflow-x-auto no-scrollbar pb-2">
          ${state.web3.sbtList.map(sbt => `
            <div class="shrink-0 w-32 bg-[var(--bg-card)] p-4 rounded-3xl border border-[var(--border-color)] flex flex-col items-center text-center shadow-sm transition-transform hover:scale-105">
              <div class="text-3xl mb-3">${sbt.image}</div>
              <div class="text-[10px] font-black text-[var(--text-main)] leading-tight mb-1">${sbt.name}</div>
              <div class="text-[8px] text-[var(--text-muted)] uppercase font-bold">${sbt.type}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- 認知訓練 -->
      <div class="bg-[var(--bg-card)] p-6 rounded-[32px] text-[var(--text-main)] shadow-sm border border-[var(--border-color)] mb-6 relative overflow-hidden">
        <div class="flex justify-between items-start mb-6">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 bg-teal-500/10 rounded-2xl flex items-center justify-center border border-teal-500/20">
              <svg class="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
            </div>
            <div>
              <h4 class="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">認知激發 (${state.mathTasksCount}/3)</h4>
              <p class="text-3xl font-black">${state.mathQuiz.question}</p>
            </div>
          </div>
          <div class="text-right">
            <div class="text-[9px] font-bold text-teal-600/60 uppercase mb-0.5">預估獎勵</div>
            <div class="text-sm font-black text-teal-600">${state.mathTasksCount < 3 ? '+5 健康幣 / ' : ''}+100 XP</div>
          </div>
        </div>
        <div class="grid grid-cols-3 gap-3 mb-6">
          ${state.mathQuiz.options.map(o => `
            <button data-act="math-ans" data-val="${o}" ${state.mathTasksCount >= 3 ? 'disabled' : ''} class="bg-[var(--bg-app)] hover:bg-teal-500/10 h-16 rounded-2xl font-black text-xl border border-[var(--border-color)] text-[var(--text-main)] transition-all active:scale-95 disabled:opacity-50 disabled:grayscale">
              ${o}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- 任務列表 -->
      <h3 class="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] mb-4 px-1 flex justify-between items-center">
        今日處方任務
        <span class="text-[8px] text-teal-600 font-black tracking-widest uppercase">每項任務每日可領 1 次</span>
      </h3>
      <div class="space-y-4 mb-6">
        <button data-act="start-arm" ${state.cameraTasks.arm >= 1 ? 'disabled' : ''} class="w-full bg-[var(--bg-card)] p-6 rounded-[32px] border border-[var(--border-color)] flex justify-between items-center active:scale-95 transition-all shadow-sm hover:border-teal-500/30 disabled:opacity-50 disabled:grayscale">
          <div class="text-left">
            <div class="font-black text-[var(--text-main)] text-lg">肩關節屈曲訓練 ${state.cameraTasks.arm >= 1 ? '(已完成)' : ''}</div>
            <div class="text-[10px] font-bold text-[var(--text-muted)] mt-1 uppercase">目標：3 次 · 達 90°</div>
          </div>
          <div class="w-12 h-12 rounded-2xl bg-teal-500/5 flex items-center justify-center text-teal-600">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
          </div>
        </button>

        <button data-act="start-grip" ${state.cameraTasks.grip >= 1 ? 'disabled' : ''} class="w-full bg-[var(--bg-card)] p-6 rounded-[32px] border border-[var(--border-color)] flex justify-between items-center active:scale-95 transition-all shadow-sm hover:border-purple-500/30 disabled:opacity-50 disabled:grayscale">
          <div class="text-left">
            <div class="font-black text-[var(--text-main)] text-lg">手指抓握訓練 ${state.cameraTasks.grip >= 1 ? '(已完成)' : ''}</div>
            <div class="text-[10px] font-bold text-[var(--text-muted)] mt-1 uppercase">目標：3 次 · 完整握拳</div>
          </div>
          <div class="w-12 h-12 rounded-2xl bg-purple-500/5 flex items-center justify-center text-purple-600">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
          </div>
        </button>

        <button data-act="start-reaction" ${state.cameraTasks.reaction >= 1 ? 'disabled' : ''} class="w-full bg-[var(--bg-card)] p-6 rounded-[32px] border border-[var(--border-color)] flex justify-between items-center active:scale-95 transition-all shadow-sm hover:border-amber-500/30 disabled:opacity-50 disabled:grayscale">
          <div class="text-left">
            <div class="font-black text-[var(--text-main)] text-lg">眼手協調訓練 ${state.cameraTasks.reaction >= 1 ? '(已完成)' : ''}</div>
            <div class="text-[10px] font-bold text-[var(--text-muted)] mt-1 uppercase">目標：捕捉 10 個目標</div>
          </div>
          <div class="w-12 h-12 rounded-2xl bg-amber-500/5 flex items-center justify-center text-amber-600">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
          </div>
        </button>
      </div>
    `;
  }

  function renderTaskInterface() {
    const isReaction = state.taskMode === 'reaction';
    return `
      <div class="rounded-[40px] aspect-[3/4] relative overflow-hidden shadow-2xl ${isReaction ? 'bg-slate-900' : 'bg-black'} border-4 border-[var(--border-color)]" id="game-container">
        <video id="cam" autoplay playsinline muted style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover; transform:scaleX(-1); z-index:1;"></video>
        <canvas id="overlay" style="position:absolute; inset:0; width:100%; height:100%; transform:scaleX(-1); z-index:2; pointer-events:none;"></canvas>
        ${isReaction ? `
          <div id="reaction-area" class="absolute inset-0 z-10">
            ${state.reaction.targets.map(t => `
              <div data-act="hit-target" data-id="${t.id}" class="absolute w-20 h-20 bg-amber-500 rounded-full border-4 border-white shadow-[0_0_20px_rgba(245,158,11,0.6)] animate-pulse active:scale-75 transition-transform" 
                   style="left: ${t.x * 80 + 10}%; top: ${t.y * 80 + 10}%;"></div>
            `).join('')}
          </div>
        ` : ''}
        <div class="absolute top-6 left-6 right-6 flex justify-between z-10 pointer-events-none">
          <div class="bg-[var(--bg-card)]/90 backdrop-blur-xl p-4 rounded-3xl border border-[var(--border-color)] shadow-xl min-w-[110px]">
            <div class="text-[9px] font-black text-white uppercase tracking-widest">數據監控</div>
            <div id="stat-val" class="text-2xl font-black text-white text-[var(--text-main)]">${isReaction ? '計時中' : (state.taskMode === 'arm' ? state.arm.angle + '°' : state.grip.score + '°')}</div>
          </div>
          <div class="bg-[var(--bg-card)]/90 backdrop-blur-xl p-4 rounded-3xl border border-[var(--border-color)] shadow-xl text-right min-w-[110px]">
            <div class="text-[9px] font-black text-white uppercase tracking-widest">完成度</div>
            <div id="stat-reps" class="text-2xl text-white font-black text-[var(--text-main)]">${isReaction ? state.reaction.score + '/10' : (state.taskMode === 'arm' ? state.arm.reps : state.grip.reps) + '/' + state.targetReps}</div>
          </div>
        </div>
        <div class="absolute bottom-8 left-6 right-6 flex gap-3 z-10">
          <button data-act="cancel-task" class="flex-1 bg-white/20 backdrop-blur-xl text-white font-bold py-4 rounded-2xl border border-white/30 text-[10px]">中斷</button>
          <button data-act="complete-task" class="flex-1 bg-teal-500 text-white scale-0 font-black py-4 rounded-3xl shadow-lg active:scale-95 transition-all text-[10px]">上傳驗證</button>
        </div>
      </div>
    `;
  }

  function renderResultView() {
    const s = state.lastSession;
    const isVerifying = state.web3.isVerifying;
    return `
      <div class="h-full flex flex-col items-center justify-center text-center p-4 animate-in fade-in zoom-in duration-500">
        <div class="w-24 h-24 bg-teal-500 rounded-full flex items-center justify-center shadow-lg mb-6 ring-8 ring-teal-500/10 text-white">
          <svg class="w-12 h-12" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
        </div>
        <h3 class="text-3xl font-black text-[var(--text-main)] mb-2">任務已完成</h3>
        <div class="bg-[var(--bg-card)] w-full rounded-[40px] p-8 shadow-sm border border-[var(--border-color)] mb-8 space-y-6">
          <div class="flex justify-around items-center">
            <div class="text-center">
              <div class="text-[10px] font-black text-teal-600 uppercase mb-1">獲得經驗</div>
              <div class="text-3xl font-black text-[var(--text-main)]">+${s.xp}</div>
            </div>
            <div class="text-center">
              <div class="text-[10px] font-black text-teal-600 uppercase mb-1">HEAL 獎勵</div>
              <div class="text-3xl font-black text-[var(--text-main)]">+${(s.reward || 0).toFixed(1)}</div>
            </div>
          </div>
          <div class="text-left bg-[var(--bg-app)] p-4 rounded-2xl border border-[var(--border-color)]">
            <div class="flex justify-between items-center mb-2">
              <span class="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">PoPW 驗證狀態</span>
              <span class="text-[9px] font-black text-teal-600 uppercase">${isVerifying ? '同步中' : '已確認'}</span>
            </div>
            <div class="font-mono text-[8px] text-[var(--text-muted)] break-all">TX: ${state.web3.lastTxHash || '---'}</div>
          </div>
        </div>
        <button data-act="finish-result" ${isVerifying ? 'disabled' : ''} class="w-full bg-slate-900 text-white font-black py-5 rounded-3xl shadow-xl active:scale-95 transition-all">確認並返回</button>
      </div>
    `;
  }

  function renderDataView() {
    const blockchainHistory = window.blockchain.getFormattedHistory();
    const avgROM = state.history.length ? Math.round(state.history.reduce((a, b) => a + b.rom, 0) / state.history.length) : 0;
    
    return `
      <div class="space-y-6 text-[var(--text-main)]">
        <div class="bg-[var(--bg-card)] p-6 rounded-3xl shadow-sm border border-[var(--border-color)]">
          <h3 class="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] mb-6 px-1">復健數據概覽</h3>
          <div class="grid grid-cols-2 gap-4 text-center">
            <div class="p-4 bg-[var(--bg-app)] rounded-2xl border border-[var(--border-color)]">
              <div class="text-[9px] font-bold text-[var(--text-muted)] uppercase mb-1">平均角度</div>
              <div class="text-2xl font-black text-teal-600">${avgROM}°</div>
            </div>
            <div class="p-4 bg-[var(--bg-app)] rounded-2xl border border-[var(--border-color)]">
              <div class="text-[9px] font-bold text-[var(--text-muted)] uppercase mb-1">錢包地址</div>
              <div class="text-[8px] font-mono font-black text-slate-500 overflow-hidden text-ellipsis">${window.blockchain.walletAddress}</div>
            </div>
          </div>
        </div>

        <div class="bg-[var(--bg-card)] p-6 rounded-3xl shadow-sm border border-[var(--border-color)]">
          <h3 class="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] mb-4 px-1 flex justify-between items-center">
            區塊鏈帳本 (History)
            <span class="text-[8px] text-teal-500 lowercase font-mono">Total Blocks: ${blockchainHistory.length}</span>
          </h3>
          <div class="space-y-4">
            ${blockchainHistory.map(b => `
              <div class="relative pl-6 border-l-2 ${b.data.type === 'MINT' ? 'border-teal-500/30' : 'border-red-500/30'} py-2">
                <div class="absolute -left-[9px] top-4 w-4 h-4 rounded-full ${b.data.type === 'MINT' ? 'bg-teal-500' : 'bg-red-500'} border-4 border-[var(--bg-card)]"></div>
                <div class="flex justify-between items-start mb-1">
                  <div class="text-sm font-black">${b.data.task}</div>
                  <div class="text-[10px] font-black ${b.data.type === 'MINT' ? 'text-teal-600' : 'text-red-500'}">
                    ${b.data.type === 'MINT' ? '+' : '-'}${b.data.amount} <i class="fa-solid fa-coins ml-0.5"></i>
                  </div>
                </div>
                <div class="flex justify-between items-center text-[8px] font-mono text-[var(--text-muted)] uppercase">
                  <span>HASH: ${b.hash.slice(0, 16)}...</span>
                  <span>${b.dateLabel} ${b.timeLabel}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  function updateStats() {
    const valEl = document.getElementById('stat-val');
    const repsEl = document.getElementById('stat-reps');
    if (state.taskMode === 'arm') {
      if (valEl) valEl.innerText = state.arm.angle + '°';
      if (repsEl) repsEl.innerText = `${state.arm.reps}/${state.targetReps}`;
    } else if (state.taskMode === 'grip') {
      if (valEl) valEl.innerText = state.grip.score + '°';
      if (repsEl) repsEl.innerText = `${state.grip.reps}/${state.targetReps}`;
    } else if (state.taskMode === 'reaction') {
      if (valEl) valEl.innerText = '計時中';
      if (repsEl) repsEl.innerText = `${state.reaction.score}/10`;
    }
  }

  function spawnTarget() { state.reaction.targets = [{ x: Math.random() * 0.8, y: Math.random() * 0.8, id: Date.now() }]; }

  async function startEngine() {
    try {
      state.ai.loading = true; render();
      if (state.taskMode === 'arm') {
        await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs');
        await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection');
        detector = await window.poseDetection.createDetector(window.poseDetection.SupportedModels.MoveNet);
      } else {
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js');
        detector = new window.Hands({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
        detector.setOptions({ maxNumHands: 1, modelComplexity: 1 });
        detector.onResults(onHandResults);
      }
      stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      const video = document.getElementById('cam');
      if (video) { video.srcObject = stream; await new Promise(r => video.onloadedmetadata = r); await video.play(); }
      state.ai.loading = false; state.ai.camera = true; render(); runDetectionLoop();
    } catch (e) { toast("相機失敗"); state.taskStep = 'idle'; render(); }
  }

  function runDetectionLoop() {
    const video = document.getElementById('cam');
    const canvas = document.getElementById('overlay');
    if (!video || !canvas) return;
    const ctx = canvas.getContext('2d');
    const loop = async () => {
      if (!state.ai.camera) return;
      if (video.readyState >= 2) {
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        if (state.taskMode === 'arm') {
          const poses = await detector.estimatePoses(video);
          if (poses[0]) { drawPose(ctx, poses[0].keypoints); processArmLogic(poses[0].keypoints); }
        } else { await detector.send({ image: video }); }
      }
      rafId = requestAnimationFrame(loop);
    };
    loop();
  }

  function onHandResults(res) {
    const canvas = document.getElementById('overlay');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (res.multiHandLandmarks && res.multiHandLandmarks[0]) {
      const lm = res.multiHandLandmarks[0];
      ctx.strokeStyle = '#00FF00'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      const connections = [
        [0, 1, 2, 3, 4], [0, 5, 6, 7, 8], [0, 9, 10, 11, 12],
        [0, 13, 14, 15, 16], [0, 17, 18, 19, 20], [5, 9, 13, 17]
      ];
      connections.forEach(path => {
        ctx.beginPath();
        path.forEach((idx, i) => {
          const pt = lm[idx];
          if (i === 0) ctx.moveTo(pt.x * canvas.width, pt.y * canvas.height);
          else ctx.lineTo(pt.x * canvas.width, pt.y * canvas.height);
        });
        ctx.stroke();
      });
      if (state.taskMode === 'grip') processGripLogic(lm);
      else if (state.taskMode === 'reaction') processReactionLogic(lm);
    }
  }

  function processReactionLogic(lm) {
    if (!state.reaction.targets.length) return;
    const target = state.reaction.targets[0];
    const tip = lm[8]; const hx = 1 - tip.x; const hy = tip.y;
    const tx = (target.x * 80 + 10) / 100; const ty = (target.y * 80 + 10) / 100;
    if (Math.hypot(hx - tx, hy - ty) < 0.18) {
      state.reaction.score++; state.reaction.targets = [];
      if (state.reaction.score >= 10) { 
        toast("目標全數達成！");
        const btn = document.querySelector('[data-act="complete-task"]');
        if (btn) btn.classList.replace('scale-0', 'scale-100');
        setTimeout(() => document.querySelector('[data-act="complete-task"]')?.click(), 1200);
      }
      else { spawnTarget(); render(); }
    }
  }

  function drawPose(ctx, pts) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    const kp = pts.reduce((a, c) => ({ ...a, [c.name]: c }), {});
    ctx.strokeStyle = '#00FF00'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    const pairs = [
      ['left_shoulder', 'right_shoulder'], ['left_shoulder', 'left_elbow'], ['left_elbow', 'left_wrist'],
      ['right_shoulder', 'right_elbow'], ['right_elbow', 'right_wrist'], ['left_shoulder', 'left_hip'],
      ['right_shoulder', 'right_hip'], ['left_hip', 'right_hip'], ['left_hip', 'left_knee'],
      ['left_knee', 'left_ankle'], ['right_hip', 'right_knee'], ['right_knee', 'right_ankle']
    ];
    pairs.forEach(([p1, p2]) => {
      if (kp[p1] && kp[p2] && kp[p1].score > 0.4 && kp[p2].score > 0.4) {
        ctx.beginPath(); ctx.moveTo(kp[p1].x, kp[p1].y); ctx.lineTo(kp[p2].x, kp[p2].y); ctx.stroke();
      }
    });
  }

  function processArmLogic(pts) {
    const kp = pts.reduce((a, c) => ({ ...a, [c.name]: c }), {});
    if (kp.right_shoulder && kp.right_elbow && kp.right_shoulder.score > 0.3) {
      const angle = Math.round(Math.acos((kp.right_elbow.y - kp.right_shoulder.y) / Math.hypot(kp.right_elbow.x - kp.right_shoulder.x, kp.right_elbow.y - kp.right_shoulder.y)) * 57.3);
      state.arm.angle = angle; state.arm.max = Math.max(state.arm.max, angle);
      if (angle > 70 && state.arm.status === 'down') state.arm.status = 'up';
      if (angle < 50 && state.arm.status === 'up') { 
        state.arm.status = 'down'; 
        state.arm.reps++; 
        toast("舉臂 +1"); 
        if (state.arm.reps >= state.targetReps) {
          const btn = document.querySelector('[data-act="complete-task"]');
          if (btn) btn.classList.replace('scale-0', 'scale-100');
          setTimeout(() => document.querySelector('[data-act="complete-task"]')?.click(), 1200);
        }
      }
      updateStats();
    }
  }

  function processGripLogic(lm) {
    const score = Math.round((1 - Math.hypot(lm[8].x - lm[0].x, lm[8].y - lm[0].y) / 0.45) * 100);
    state.grip.score = score; state.grip.max = Math.max(state.grip.max, score);
    if (score > 40 && state.grip.status === 'open') state.grip.status = 'closed';
    if (score < 30 && state.grip.status === 'closed') { 
      state.grip.status = 'open'; 
      state.grip.reps++; 
      toast("抓握 +1"); 
      if (state.grip.reps >= state.targetReps) {
        const btn = document.querySelector('[data-act="complete-task"]');
        if (btn) btn.classList.replace('scale-0', 'scale-100');
        setTimeout(() => document.querySelector('[data-act="complete-task"]')?.click(), 1200);
      }
    }
    updateStats();
  }

  async function submitPoPW() {
    state.web3.isVerifying = true; render();
    try {
      await window.showBlockchainProgress("正在透過 AI 驗證復健動作...", 3500);
      const taskLabel = state.taskMode === 'arm' ? '肩關節訓練' : (state.taskMode === 'grip' ? '抓握訓練' : '眼手協調訓練');
      
      let reward = 0;
      const currentTaskCount = state.cameraTasks[state.taskMode] || 0;
      
      if (currentTaskCount < 1) {
        reward = 5;
        const block = await window.blockchain.mint(reward, `完成每日任務：${taskLabel}`);
        state.web3.lastTxHash = block.hash;
        
        state.cameraTasks[state.taskMode] = 1;
        localStorage.setItem(`task_count_${state.taskMode}_${state.patientId}`, '1');
        
        window.showCoinMinted(reward);
        toast(`區塊鏈驗證成功！+${reward} 健康幣`);
      } else {
        toast(`今日此任務獎勵已領取，本次僅記錄數據`);
        state.web3.lastTxHash = "DATA_ONLY_" + Date.now();
      }
      
      state.web3.healBalance = window.blockchain.getBalance();
      state.lastSession.reward = reward;
    } catch (e) { toast("同步失敗"); } finally { state.web3.isVerifying = false; render(); }
  }

  function attachEvents() {
    document.addEventListener('click', async (e) => {
      const t = e.target.closest('[data-act]'); if (!t) return;
      const act = t.dataset.act;
      if (act === 'reset-tasks') {
        localStorage.removeItem(`tasks_date_${state.patientId}`);
        localStorage.removeItem(`math_tasks_count_${state.patientId}`);
        localStorage.removeItem(`task_count_arm_${state.patientId}`);
        localStorage.removeItem(`task_count_grip_${state.patientId}`);
        localStorage.removeItem(`task_count_reaction_${state.patientId}`);
        localStorage.removeItem(`has_taken_meds_${state.patientId}`);
        localStorage.removeItem(`last_checkin_${state.patientId}`);
        localStorage.removeItem(`login_streak_${state.patientId}`);
        state.stats.loginStreak = 0;
        checkDailyLimits();
        checkDailyCheckIn();
        toast("測試用：所有記錄含連續登入已重置！");
        render();
      }
 else if (act === 'take-meds') {
        if (state.hasTakenMeds) return;
        await window.showBlockchainProgress("正在記錄每日用藥情況...", 2000);
        await window.blockchain.mint(10, "每日服藥獎勵");
        state.hasTakenMeds = true;
        localStorage.setItem(`has_taken_meds_${state.patientId}`, 'true');
        state.web3.healBalance = window.blockchain.getBalance();
        window.showCoinMinted(10);
        toast("服藥記錄成功！+10 健康幣");
        render();
      } else if (act === 'toggle-theme') {
        state.isDarkMode = !state.isDarkMode; document.body.classList.toggle('dark-mode', state.isDarkMode);
        localStorage.setItem('theme', state.isDarkMode ? 'dark' : 'light'); render();
      } else if (act.startsWith('start-')) {
        state.taskMode = act.replace('start-', ''); state.taskStep = 'action';
        state.arm = { angle: 0, reps: 0, status: 'down', max: 0 }; state.grip = { score: 0, reps: 0, status: 'open', max: 0 };
        state.reaction = { targets: [], score: 0, startTime: Date.now(), totalTime: 0 };
        if (state.taskMode === 'reaction') spawnTarget();
        render(); await startEngine();
      } else if (act === 'hit-target') {
        state.reaction.score++; state.reaction.targets = [];
        if (state.reaction.score >= 10) {
          toast("目標全數達成！");
          const btn = document.querySelector('[data-act="complete-task"]');
          if (btn) btn.classList.replace('scale-0', 'scale-100');
          setTimeout(() => document.querySelector('[data-act="complete-task"]')?.click(), 1200);
        }
        else { spawnTarget(); render(); }
      } else if (act === 'complete-task') {
        let reps, maxVal;
        if (state.taskMode === 'arm') { reps = state.arm.reps; maxVal = state.arm.max; }
        else if (state.taskMode === 'grip') { reps = state.grip.reps; maxVal = state.grip.max; }
        else { reps = state.reaction.score; maxVal = 0; }
        const earnedXp = reps * 100;
        await healscapeApi.uploadSession({ patientId: state.patientId, task: state.taskMode, rom: maxVal, reps: reps, date: new Date().toISOString().split('T')[0] });
        stopEngine(); state.lastSession = { xp: earnedXp, rom: maxVal, reps: reps }; state.taskStep = 'result'; render(); submitPoPW();
      } else if (act === 'redeem-heal') {
        redeemDiscount();
      } else if (act === 'daily-checkin') {
        performCheckIn();
      } else if (act === 'finish-result') { gainXp(state.lastSession.xp); state.taskStep = 'idle'; generateMathQuiz(); render(); }
      else if (act === 'cancel-task') { stopEngine(); state.taskStep = 'idle'; render(); }
      else if (act.startsWith('nav-')) { state.currentView = act.replace('nav-', ''); render(); }
      else if (act === 'math-ans') {
        const isCorrect = parseInt(t.dataset.val) === state.mathQuiz.answer;
        if (isCorrect) { 
          state.mathQuiz.streak++; 
          gainXp(100); 
          let msg = "答對了！+100 XP";
          if (state.mathTasksCount < 3) {
            state.mathTasksCount++;
            localStorage.setItem(`math_tasks_count_${state.patientId}`, state.mathTasksCount);
            await window.blockchain.mint(5, "認知激發任務獎勵");
            state.web3.healBalance = window.blockchain.getBalance();
            window.showCoinMinted(5);
            msg += " & +5 健康幣";
          } else {
            msg += " (今日獎勵已達上限)";
          }
          toast(msg); 
        }
        else { state.mathQuiz.streak = 0; toast("答錯了"); }
        setTimeout(() => { generateMathQuiz(); render(); }, 300);
      }
    });
  }

  function stopEngine() {
    state.ai.camera = false; if (rafId) cancelAnimationFrame(rafId);
    if (stream) stream.getTracks().forEach(t => t.stop()); stream = null;
  }

  function loadScript(src) { return new Promise(r => { if (document.querySelector(`script[src="${src}"]`)) return r(); const s = document.createElement('script'); s.src = src; s.onload = r; document.head.appendChild(s); }); }

  function toast(msg) {
    const w = document.getElementById('toastWrap'); if (!w) return;
    const t = document.createElement('div'); t.className = 'toast'; t.innerText = msg;
    w.appendChild(t); setTimeout(() => t.remove(), 2000);
  }

  init();
  attachEvents();
})();
