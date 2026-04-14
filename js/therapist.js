(function therapistApp() {
  const PATIENTS = [
    { 
      id: 'p01', name: '王大明', birthday: '1958-05-12', age: 68, risk: 'high', alert: 'ROM 下降 15%', rom: 75, historyRom: 88, adherence: 62, level: 12, height: 172, weight: 75, bp: '145/92', healBal: 45.5, wallet: '0x71...4F2e',
      historyData: [88, 85, 82, 80, 78, 76, 75],
      diagnosis: '偵測到近三日 ROM 呈現下降趨勢。結合 ZK-BioOracle 數據，病患在屈曲 60° 後出現明顯肩胛骨代償。'
    },
    { 
      id: 'p02', name: '林淑芬', birthday: '1954-11-20', age: 72, risk: 'low', alert: '進度穩定', rom: 88, historyRom: 85, adherence: 91, level: 25, height: 158, weight: 58, bp: '128/80', healBal: 128.0, wallet: '0x32...9A1b',
      historyData: [82, 83, 84, 85, 86, 87, 88],
      diagnosis: '康復進度極佳，ROM 穩定提升。PoPW 網路已驗證多筆高質量動作數據，建議可開始介入輕度抗阻訓練。'
    },
    { 
      id: 'p03', name: '張志豪', birthday: '1981-03-05', age: 45, risk: 'medium', alert: '依從率波動', rom: 74, historyRom: 72, adherence: 70, level: 18, height: 180, weight: 82, bp: '135/85', healBal: 62.2, wallet: '0x88...2C4d',
      historyData: [70, 75, 68, 72, 70, 76, 74],
      diagnosis: '居家練習時間不規律導致數據波動。已透過區塊鏈憑證紀錄提醒病患維持每日清晨練習之習慣。'
    },
    { id: 'p04', name: '陳文琪', birthday: '1967-08-15', age: 59, risk: 'high', alert: '連續 3 日未練習', rom: 63, historyRom: 70, adherence: 58, level: 8, height: 162, weight: 64, bp: '152/98', healBal: 15.0, wallet: '0x14...5E6f', historyData: [70, 70, 68, 65, 65, 63, 63], diagnosis: '依從性嚴重下滑，建議電訪了解居家狀況。' },
    { id: 'p05', name: '劉家豪', birthday: '1975-01-22', age: 51, risk: 'low', alert: '可提升難度', rom: 92, historyRom: 90, adherence: 95, level: 30, height: 175, weight: 70, bp: '120/78', healBal: 210.5, wallet: '0x55...7B8c', historyData: [85, 88, 89, 90, 91, 92, 92], diagnosis: '動作控制能力已達標，可轉入進階康復階段。' },
    { id: 'p06', name: '黃小玲', birthday: '1992-12-10', age: 34, risk: 'medium', alert: '抓握力不穩', rom: 65, historyRom: 68, adherence: 72, level: 15, height: 165, weight: 52, bp: '118/75', healBal: 88.4, wallet: '0x99...3D2a', historyData: [68, 67, 66, 65, 66, 64, 65], diagnosis: '抓握動作不完全，PoPW 驗證成功率僅 70%，需加強末端指節發力。' },
    { id: 'p07', name: '郭振興', birthday: '1944-06-30', age: 82, risk: 'high', alert: '疲勞感增加', rom: 55, historyRom: 60, adherence: 45, level: 5, height: 168, weight: 68, bp: '158/95', healBal: 12.8, wallet: '0x44...1A9z', historyData: [60, 58, 59, 57, 56, 55, 55], diagnosis: '高齡患者體力下滑明顯，建議降低每日練習次數，改以維持關節活動度為主。' },
    { id: 'p08', name: '李美雲', birthday: '1966-04-18', age: 60, risk: 'low', alert: '表現優異', rom: 80, historyRom: 78, adherence: 98, level: 22, height: 155, weight: 55, bp: '122/76', healBal: 156.2, wallet: '0x66...8F4e', historyData: [72, 74, 75, 77, 78, 79, 80], diagnosis: '復健熱忱度高，各項生理指標穩定成長。' },
    { id: 'p09', name: '趙子龍', birthday: '1997-09-09', age: 29, risk: 'low', alert: '恢復大幅超前', rom: 95, historyRom: 92, adherence: 100, level: 42, height: 182, weight: 78, bp: '115/72', healBal: 320.0, wallet: '0x99...9Z9y', historyData: [88, 90, 92, 93, 94, 95, 95], diagnosis: '運動員體質，術後恢復速度驚人。PoPW 獎勵已達生態系前 1%，建議挑戰高難度動作。' },
    { id: 'p10', name: '孫大華', birthday: '1951-02-14', age: 75, risk: 'medium', alert: '動作代償頻繁', rom: 68, historyRom: 70, adherence: 78, level: 14, height: 170, weight: 72, bp: '140/88', healBal: 54.3, wallet: '0x51...2B4c', historyData: [70, 69, 71, 68, 67, 69, 68], diagnosis: '軀幹穩定度不足，進行肩部運動時常伴隨軀幹後仰，需重新指導核心收縮。' }
  ];

  const state = {
    selectedId: null,
    filterRisk: 'all',
    searchQuery: '',
    showPrescribeModal: false,
    prescribeForm: { task: 'arm', reps: 3, difficulty: 70 },
    isDarkMode: localStorage.getItem('theme') === 'dark'
  };

  function maskName(str) { return str[0] + 'O' + (str.length > 2 ? str.substring(2) : ''); }

  function init() {
    healscapeAuth.checkAuth('therapist');
    if (state.isDarkMode) document.body.classList.add('dark-mode');
    render();
    attachEvents();
  }

  function render() {
    const app = document.getElementById('therapist-app');
    if (!app) return;
    const filtered = PATIENTS.filter(p => (state.filterRisk === 'all' || p.risk === state.filterRisk) && p.name.includes(state.searchQuery));

    app.innerHTML = `
      <section class="h-full flex flex-col bg-[var(--bg-app)] text-[var(--text-main)]">
        <header class="bg-[#0F172A] text-white p-6 shadow-xl relative overflow-hidden">
          <div class="flex justify-between items-center mb-4 relative z-10">
            <div>
              <h2 class="text-xl font-black">臨床監控中心 <span class="text-teal-400">Pro</span></h2>
              <p class="text-[9px] text-teal-400 font-bold uppercase tracking-[0.2em] flex items-center gap-1.5 mt-1">
                <span class="w-1.5 h-1.5 bg-teal-400 rounded-full animate-pulse"></span>
                PoPW 節點已同步
              </p>
            </div>
            <div class="flex items-center gap-2">
              <button data-act="toggle-theme" class="theme-toggle">
                ${state.isDarkMode ? '🌙' : '☀️'}
              </button>
              <button onclick="healscapeAuth.logout()" class="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 transition-colors">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              </button>
            </div>
          </div>
          <div class="grid grid-cols-3 gap-3 relative z-10">
            <div class="bg-white/5 border border-white/10 p-3 rounded-2xl text-center">
              <div class="text-[9px] text-slate-500 font-bold uppercase mb-1">監測中</div>
              <div class="text-xl font-black">${PATIENTS.length}</div>
            </div>
            <div class="bg-white/5 border border-white/10 p-3 rounded-2xl text-center">
              <div class="text-[9px] text-slate-500 font-bold uppercase mb-1">警示</div>
              <div class="text-xl font-black text-red-400">${PATIENTS.filter(p=>p.risk==='high').length}</div>
            </div>
            <div class="bg-white/5 border border-white/10 p-3 rounded-2xl text-center">
              <div class="text-[9px] text-slate-500 font-bold uppercase mb-1">平均依從</div>
              <div class="text-xl font-black text-teal-400">${Math.round(PATIENTS.reduce((a, b) => a + b.adherence, 0) / PATIENTS.length)}%</div>
            </div>
          </div>
        </header>

        <div class="flex-1 overflow-y-auto no-scrollbar p-5 space-y-4">
          <div class="flex gap-2">
            <input id="search-input" type="text" placeholder="搜尋..." value="${state.searchQuery}" class="flex-1 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl px-4 py-3 text-sm focus:outline-none">
            <select id="risk-filter" class="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl px-3 py-3 text-sm focus:outline-none font-bold">
              <option value="all" ${state.filterRisk==='all'?'selected':''}>全部</option>
              <option value="high">高風險</option>
              <option value="medium">中風險</option>
              <option value="low">低風險</option>
            </select>
          </div>
          <div class="space-y-3">
            ${filtered.map(p => renderPatientCard(p)).join('')}
          </div>
        </div>
        ${state.selectedId ? renderPatientDetails(PATIENTS.find(p=>p.id===state.selectedId)) : ''}
        ${state.showPrescribeModal ? renderPrescribeModal(PATIENTS.find(p=>p.id===state.selectedId)) : ''}
      </section>
    `;
    
    if (state.selectedId) setTimeout(() => initChart(PATIENTS.find(p => p.id === state.selectedId)), 100);

    document.getElementById('search-input')?.addEventListener('input', (e) => { state.searchQuery = e.target.value; render(); });
    document.getElementById('risk-filter')?.addEventListener('change', (e) => { state.filterRisk = e.target.value; render(); });
    
    if (state.showPrescribeModal) {
        document.getElementById('prescribe-task')?.addEventListener('change', (e) => { state.prescribeForm.task = e.target.value; });
        document.getElementById('prescribe-reps')?.addEventListener('input', (e) => { state.prescribeForm.reps = parseInt(e.target.value); });
        document.getElementById('prescribe-diff')?.addEventListener('input', (e) => { state.prescribeForm.difficulty = parseInt(e.target.value); });
    }
  }

  function renderPrescribeModal(p) {
    if (!p) return '';
    return `
      <div class="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-pop">
        <div class="bg-[var(--bg-card)] w-full max-w-sm rounded-[40px] border border-[var(--border-color)] overflow-hidden shadow-2xl">
          <header class="bg-slate-900 text-white p-7 text-center">
            <h4 class="text-xs font-black uppercase tracking-[0.2em] text-teal-400 mb-1">Blockchain Prescription</h4>
            <h3 class="text-xl font-black">發布智能合約處方</h3>
          </header>
          
          <div class="p-8 space-y-6">
            <div>
              <label class="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest block mb-2">指定訓練項目</label>
              <select id="prescribe-task" class="w-full bg-[var(--bg-app)] border border-[var(--border-color)] rounded-2xl px-4 py-4 font-black text-[var(--text-main)] outline-none focus:border-teal-500/50">
                <option value="arm" ${state.prescribeForm.task==='arm'?'selected':''}>肩關節屈曲訓練</option>
                <option value="grip" ${state.prescribeForm.task==='grip'?'selected':''}>手指抓握訓練</option>
                <option value="reaction" ${state.prescribeForm.task==='reaction'?'selected':''}>眼手協調訓練</option>
              </select>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest block mb-2">每日目標次數</label>
                <input id="prescribe-reps" type="number" value="${state.prescribeForm.reps}" class="w-full bg-[var(--bg-app)] border border-[var(--border-color)] rounded-2xl px-4 py-4 font-black text-[var(--text-main)] outline-none focus:border-teal-500/50">
              </div>
              <div>
                <label class="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest block mb-2">目標值 (角度/%)</label>
                <input id="prescribe-diff" type="number" value="${state.prescribeForm.difficulty}" class="w-full bg-[var(--bg-app)] border border-[var(--border-color)] rounded-2xl px-4 py-4 font-black text-[var(--text-main)] outline-none focus:border-teal-500/50">
              </div>
            </div>

            <div class="bg-teal-500/5 border border-teal-500/10 p-4 rounded-2xl">
              <p class="text-[10px] text-teal-600 font-bold leading-relaxed">
                <i class="fa-solid fa-circle-info mr-1"></i> 此處方將寫入區塊鏈，由 ZK-BioOracle 驗證患者是否達成目標，並作為 PoPW 獎勵之發放基準。
              </p>
            </div>
          </div>

          <div class="p-6 pt-0 flex gap-3">
            <button data-act="close-prescribe" class="flex-1 bg-[var(--bg-app)] border border-[var(--border-color)] text-[var(--text-muted)] font-black py-4 rounded-3xl active:scale-95 transition-all text-xs">取消</button>
            <button data-act="submit-prescribe" class="flex-2 bg-slate-900 text-teal-400 font-black py-4 px-8 rounded-3xl shadow-xl active:scale-95 transition-all text-xs uppercase tracking-widest">發布並簽署</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderPatientCard(p) {
    const isSelected = state.selectedId === p.id;
    return `
      <div data-act="select-patient" data-id="${p.id}" class="bg-[var(--bg-card)] p-5 rounded-[32px] border ${isSelected ? 'border-teal-500 shadow-lg' : 'border-[var(--border-color)]'} transition-all active:scale-[0.98] cursor-pointer">
        <div class="flex justify-between items-center">
          <div class="flex gap-4 items-center">
            <div class="w-12 h-12 rounded-2xl bg-[var(--bg-app)] flex items-center justify-center text-xl">👤</div>
            <div>
              <div class="flex items-center gap-2">
                <h4 class="font-black text-[var(--text-main)] text-lg">${maskName(p.name)}</h4>
                <span class="text-[9px] font-black text-teal-600 bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/20 uppercase">LVL ${p.level}</span>
              </div>
              <p class="text-[10px] ${p.risk==='high'?'text-red-500 font-bold':'text-[var(--text-muted)]'} mt-0.5">${p.alert}</p>
            </div>
          </div>
          <div class="text-right">
            <div class="text-[9px] font-black text-[var(--text-muted)] uppercase mb-1">今日 ROM</div>
            <div class="text-2xl font-black ${p.rom < p.historyRom ? 'text-red-500' : 'text-[var(--text-main)]'}">${p.rom}°</div>
          </div>
        </div>
      </div>
    `;
  }

  function renderPatientDetails(p) {
    if (!p) return '';
    
    // 競賽 Demo 邏輯：如果是第一位病患，顯示真實區塊鏈數據
    const isMainPatient = p.id === 'p01';
    const displayBalance = isMainPatient ? window.blockchain.getBalance() : p.healBal;
    const displayHistory = isMainPatient ? window.blockchain.getFormattedHistory() : [];
    const walletAddr = isMainPatient ? window.blockchain.walletAddress : p.wallet;

    return `
      <div class="fixed inset-x-0 bottom-0 bg-[var(--bg-card)] rounded-t-[40px] shadow-2xl z-20 border-t border-[var(--border-color)] animate-slide-up h-[90%] flex flex-col">
        <div class="w-12 h-1.5 bg-slate-500/20 rounded-full mx-auto mt-4 mb-6 shrink-0"></div>
        <div class="px-8 flex-1 overflow-y-auto no-scrollbar pb-20">
          <div class="flex justify-between items-center mb-6">
            <div>
              <div class="flex items-center gap-2 mb-1">
                <span class="text-[9px] font-black text-teal-600 bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/20 uppercase tracking-widest">On-Chain Verified</span>
                <span class="text-[9px] font-mono text-[var(--text-muted)]">${walletAddr}</span>
              </div>
              <h3 class="text-2xl font-black text-[var(--text-main)]">${maskName(p.name)} 臨床詳情報告</h3>
            </div>
            <button data-act="close-details" class="p-3 bg-[var(--bg-app)] rounded-2xl text-[var(--text-muted)] border border-[var(--border-color)]">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <!-- Web3 區塊鏈資產卡片 -->
          <div class="grid grid-cols-2 gap-4 mb-6">
            <div class="bg-gradient-to-br from-slate-800 to-slate-900 p-5 rounded-3xl text-white shadow-lg border border-white/5">
              <div class="text-[10px] font-bold text-teal-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <i class="fa-solid fa-coins text-yellow-500"></i> 健康幣資產
              </div>
              <div class="text-3xl font-black">${Math.floor(displayBalance)} <span class="text-xs font-bold text-slate-400">COINS</span></div>
            </div>
            <div class="bg-slate-100 dark:bg-slate-800 p-5 rounded-3xl text-[var(--text-main)] border border-[var(--border-color)]">
              <div class="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">同步等級</div>
              <div class="text-3xl font-black text-teal-600">LVL ${p.level}</div>
            </div>
          </div>

          <!-- 區塊鏈健康成就時間軸 -->
          <div class="mb-8">
            <h4 class="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-4 flex justify-between items-center">
                PoPW 區塊鏈成就時間軸
                <i class="fa-solid fa-link text-teal-500"></i>
            </h4>
            <div class="space-y-3">
              ${isMainPatient ? displayHistory.map(b => `
                <div class="bg-[var(--bg-app)] border border-[var(--border-color)] p-4 rounded-2xl relative overflow-hidden group">
                  <div class="absolute left-0 top-0 bottom-0 w-1 ${b.data.type === 'MINT' ? 'bg-teal-500' : 'bg-red-500'}"></div>
                  <div class="flex justify-between items-start mb-1">
                    <div class="text-[11px] font-black">${b.data.task}</div>
                    <div class="text-[10px] font-mono text-teal-500 font-bold">${b.data.type === 'MINT' ? '+' : '-'}${b.data.amount}</div>
                  </div>
                  <div class="flex justify-between items-center">
                    <div class="text-[8px] font-mono text-slate-500">BLOCK: ${b.hash.slice(0, 20)}...</div>
                    <div class="text-[8px] text-slate-400 font-bold">${b.dateLabel}</div>
                  </div>
                </div>
              `).join('') : `
                <div class="text-center py-6 text-slate-400 text-xs italic">無區塊鏈同步紀錄</div>
              `}
            </div>
          </div>

          <!-- 病患基本資料格 -->
          <div class="bg-[var(--bg-app)] p-5 rounded-3xl mb-6 border border-[var(--border-color)]">
            <h4 class="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-3">基本參數</h4>
            <div class="grid grid-cols-2 gap-y-3">
              <div><div class="text-[9px] text-[var(--text-muted)] uppercase">生日</div><div class="text-sm font-black">${p.birthday || '1960-01-01'}</div></div>
              <div><div class="text-[9px] text-[var(--text-muted)] uppercase">血壓</div><div class="text-sm font-black text-red-500">${p.bp || '120/80'}</div></div>
              <div><div class="text-[9px] text-[var(--text-muted)] uppercase">身高</div><div class="text-sm font-black">${p.height || '--'} cm</div></div>
              <div><div class="text-[9px] text-[var(--text-muted)] uppercase">體重</div><div class="text-sm font-black">${p.weight || '--'} kg</div></div>
            </div>
          </div>

          <!-- 康復趨勢圖 -->
          <div class="bg-[var(--bg-app)] border border-[var(--border-color)] p-6 rounded-[32px] mb-8 shadow-sm">
            <h4 class="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-6">ROM 康復趨勢分析</h4>
            <div class="h-48 relative"><canvas id="romTrendChart"></canvas></div>
          </div>

          <!-- 關鍵報告區 (AI 分析) -->
          <div class="mb-8">
            <div class="flex items-center gap-2 mb-4">
              <div class="w-5 h-5 bg-teal-500 rounded flex items-center justify-center text-white text-[10px]">AI</div>
              <h4 class="text-[10px] font-black text-[var(--text-main)] uppercase tracking-widest">臨床智慧診斷摘要</h4>
            </div>
            <div class="bg-[var(--bg-app)] border-2 border-teal-500/20 rounded-3xl p-5 shadow-inner">
              <p class="text-sm text-[var(--text-main)] font-medium leading-relaxed italic">
                "${p.diagnosis || '目前暫無 AI 生成之診斷報告。'}"
              </p>
              <div class="flex gap-2 mt-4">
                <span class="text-[8px] bg-teal-500/10 text-teal-600 px-2 py-1 rounded-full border border-teal-500/20 font-bold uppercase">PoPW Verified</span>
                <span class="text-[8px] bg-slate-500/10 text-[var(--text-muted)] px-2 py-1 rounded-full border border-[var(--border-color)] font-bold uppercase">ZK-BioOracle</span>
              </div>
            </div>
          </div>

          <div class="pb-10">
            <button data-act="open-prescribe" class="w-full bg-slate-900 text-white font-black py-5 rounded-3xl shadow-xl active:scale-95 transition-all uppercase tracking-widest text-xs">
              下達醫療處方
            </button>
          </div>
        </div>
      </div>
      <div class="fixed inset-0 bg-black/40 backdrop-blur-sm z-10" data-act="close-details"></div>
    `;
  }

  function initChart(p) {
    const ctx = document.getElementById('romTrendChart')?.getContext('2d');
    if (!ctx) return;
    const isDark = state.isDarkMode;
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['6', '5', '4', '3', '2', '1', '今'],
        datasets: [{
          data: p.historyData,
          borderColor: p.risk === 'high' ? '#ef4444' : '#14b8a6',
          backgroundColor: p.risk === 'high' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(20, 184, 166, 0.1)',
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          pointRadius: 4,
          pointBackgroundColor: isDark ? '#1e293b' : '#fff'
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { grid: { color: isDark ? '#334155' : '#f1f5f9' }, ticks: { font: { size: 9 }, color: isDark ? '#94a3b8' : '#64748b' } },
          x: { grid: { display: false }, ticks: { font: { size: 9 }, color: isDark ? '#94a3b8' : '#64748b' } }
        }
      }
    });
  }

  function attachEvents() {
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-act]');
      if (!t) return;
      const act = t.dataset.act;
      if (act === 'toggle-theme') {
        state.isDarkMode = !state.isDarkMode;
        document.body.classList.toggle('dark-mode', state.isDarkMode);
        localStorage.setItem('theme', state.isDarkMode ? 'dark' : 'light');
        render();
      } else if (act === 'select-patient') { state.selectedId = t.dataset.id; render(); }
      else if (act === 'close-details') { state.selectedId = null; render(); }
      else if (act === 'open-prescribe') { state.showPrescribeModal = true; render(); }
      else if (act === 'close-prescribe') { state.showPrescribeModal = false; render(); }
      else if (act === 'submit-prescribe') {
        const p = PATIENTS.find(pt => pt.id === state.selectedId);
        state.showPrescribeModal = false;
        render();
        
        const taskName = state.prescribeForm.task === 'arm' ? '肩關節屈曲' : (state.prescribeForm.task === 'grip' ? '手指抓握' : '眼手協調');
        
        window.showBlockchainProgress(`正在為 ${maskName(p.name)} 簽署智能合約處方...`, 3000).then(() => {
            const txHash = '0x' + Math.random().toString(16).slice(2, 10) + '...' + Math.random().toString(16).slice(2, 6);
            toast(`處方發布成功！<br><span class="text-[8px] font-mono opacity-60">TX: ${txHash}</span>`);
        });
      }
    });
  }

  function toast(msg) {
    const wrap = document.getElementById('toastWrap');
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<span class="font-bold">${msg}</span>`;
    wrap.appendChild(t);
    setTimeout(() => t.remove(), 2000);
  }

  init();
})();
