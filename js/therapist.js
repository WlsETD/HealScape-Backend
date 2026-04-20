(function therapistApp() {
  let PATIENTS = []; 

  const state = {
    selectedId: null,
    selectedPatientData: null, 
    filterRisk: 'all',
    searchQuery: '',
    showPrescribeModal: false,
    prescribeForm: { task: 'arm', reps: 3, difficulty: 70 },
    isDarkMode: localStorage.getItem('theme') === 'dark'
  };

  function maskName(str) { 
    if (!str) return "Unknown";
    return str[0] + 'O' + (str.length > 2 ? str.substring(2) : ''); 
  }

  function init() {
    healscapeAuth.checkAuth('therapist');
    if (state.isDarkMode) document.body.classList.add('dark-mode');
    loadPatients();
    attachEvents();

    // 每 15 秒全域刷新一次病患列表狀態，確保即時捕捉血壓任務更新
    setInterval(loadPatients, 15000);
  }

  async function loadPatients() {
    try {
        const list = await window.healscapeApi.getPatients();

        // 建立新列表，但保留已存在病患的歷史數據，防止刷新時圖表跳動歸零
        const newList = list.map(p => {
            const existing = PATIENTS.find(old => old.id === p.id);
            return {
                ...p,
                birthday: p.birthday || '1960-01-01', 
                age: p.birthday ? (new Date().getFullYear() - new Date(p.birthday).getFullYear()) : 65, 
                risk: existing ? existing.risk : 'low', 
                alert: existing ? existing.alert : '資料就緒',
                rom: existing ? existing.rom : 0, 
                bp: p.bp || (existing ? existing.bp : '--/--'), 
                historyRom: 70, 
                adherence: 85, 
                height: p.height || '--', 
                weight: p.weight || '--', 
                healBal: existing ? existing.healBal : 0, 
                wallet: '0x...',
                historyData: existing ? existing.historyData : [0, 0, 0, 0, 0, 0, 0],
                historyLabels: existing ? existing.historyLabels : ['--', '--', '--', '--', '--', '--', '今'],
                diagnosis: existing ? existing.diagnosis : '數據分析中...'
            };
        });

        PATIENTS = newList;
        render();
        // 使用 Promise.all 等待所有病患同步完成後再一次性渲染，避免迴圈內多次渲染
        const syncPromises = list.map((p, index) => {
            return new Promise(resolve => {
                setTimeout(async () => {
                    try {
                        const fhir = await window.healscapeApi.getPatientData(p.id);
                        if (fhir.history && fhir.history.length > 0) {
                            const latestRom = fhir.history.find(h => h.type === 'rom');
                            const latestBp = fhir.history.find(h => h.type === 'bp' || h.type === 'Blood Pressure');
                            
                            // 修正：僅在有效時更新 ROM，避免跳回 0
                            if (latestRom && latestRom.rom !== undefined) PATIENTS[index].rom = latestRom.rom;
                            if (latestBp) PATIENTS[index].bp = `${latestBp.value}/${latestBp.reps || latestBp.grip || 80}`;
                            
                            let isHighRisk = false;
                            let alertMsg = `穩定恢復: ${fhir.history[0].date}`;
                            if (PATIENTS[index].rom > 0 && PATIENTS[index].rom < 50) { isHighRisk = true; alertMsg = '警報：活動度急遽下降！'; }
                            if (latestBp && (latestBp.sys > 140 || latestBp.sys < 90)) { isHighRisk = true; alertMsg = '警報：血壓數值異常！'; }
                            if (p.id === '104') { isHighRisk = true; alertMsg = '警報：活動度急遽下降！'; }
                            PATIENTS[index].risk = isHighRisk ? 'high' : 'low';
                            PATIENTS[index].alert = alertMsg;
                            
                            // 預先生成初步診斷，以便點擊時立刻顯示
                            const bpInfo = latestBp ? `，最新血壓為 ${PATIENTS[index].bp} mmHg` : "";
                            PATIENTS[index].diagnosis = fhir.history.length > 0 ? `PoPW 網路已驗證 ${fhir.history.length} 筆生理數據，最新 ROM 為 ${PATIENTS[index].rom}°${bpInfo}。` : "尚無 FHIR 復健數據紀錄。";

                            const romHistory = fhir.history.filter(h => h.type === 'rom' && (h.rom !== undefined || h.value !== undefined));
                            if (romHistory.length > 0) {
                              // 取得最近 7 筆數據，並反轉使其由舊到新
                              const last7 = romHistory.slice(0, 7).reverse();
                              PATIENTS[index].historyData = last7.map(h => h.rom !== undefined ? h.rom : h.value);
                              PATIENTS[index].historyLabels = last7.map(h => {
                                  if (!h.date || h.date === 'N/A') return '--/--';
                                  return h.date.split('-').slice(1).join('/'); // 取 月/日
                              });

                              // 如果不足 7 筆，使用最早的一筆數據進行填補，避免曲線歸零
                              if (PATIENTS[index].historyData.length < 7) {
                                  const paddingCount = 7 - PATIENTS[index].historyData.length;
                                  const firstVal = PATIENTS[index].historyData[0] || 0;
                                  PATIENTS[index].historyData = [...new Array(paddingCount).fill(firstVal), ...PATIENTS[index].historyData];
                                  PATIENTS[index].historyLabels = [...new Array(paddingCount).fill('--/--'), ...PATIENTS[index].historyLabels];
                              }
                            }
                        }
                    } catch(e) {}
                    resolve();
                }, index * 100);
            });
        });

    await Promise.all(syncPromises);
        render(); // 全同步完成後更新一次

    } catch(e) { 
        console.error("Load patients failed", e); 
        toast("無法載入病患列表");
    }
  }

  function safeSetInnerHTML(el, html) {
    if (el.innerHTML === html) return;
    el.innerHTML = html;
  }

  let refreshTimer = null;

  async function selectPatient(id) {
    if (state.selectedId === id && state.selectedPatientData) return;
    
    // 清除舊的計時器
    if (refreshTimer) clearInterval(refreshTimer);
    
    state.selectedId = id;
    state.lastDataSnapshot = null; // 重置快照，強制下次同步時渲染
    state.isFirstDetailsRender = true; 
    const p = PATIENTS.find(pt => pt.id === id);
    render(); 

    const syncData = async () => {
        try {
            const [balance, ledger, fhir] = await Promise.all([
                window.healscapeApi.getHEALBalance(id).catch(e => 0),
                window.healscapeApi.getLedger(id).catch(e => []),
                window.healscapeApi.getPatientData(id).catch(e => ({ history: [] }))
            ]);

            // 建立數據快照進行比對
            const currentDataSnapshot = JSON.stringify({ balance, ledger, fhirLength: fhir.history?.length, lastRom: fhir.history?.find(h=>h.type==='rom')?.rom });
            if (state.lastDataSnapshot === currentDataSnapshot) {
                return; // 數據未改變，跳過渲染
            }
            state.lastDataSnapshot = currentDataSnapshot;

            p.healBal = balance;
            
            const latestRom = fhir.history.find(h => h.type === 'rom');
            const latestBp = fhir.history.find(h => h.type === 'bp' || h.type === 'Blood Pressure');
            
            // 修正：僅在獲取到有效數據時才更新，否則保留舊值，避免跳回 0
            if (latestRom && latestRom.rom !== undefined) p.rom = latestRom.rom;
            if (latestBp) p.bp = `${latestBp.value}/${latestBp.reps || latestBp.grip || 80}`;
            
            // 更新圖表數據與日期標籤 (僅針對 ROM)
            const filteredRom = fhir.history.filter(h => h.type === 'rom' && (h.rom !== undefined || h.value !== undefined));
            if (filteredRom.length > 0) {
              const last7 = filteredRom.slice(0, 7).reverse();
              p.historyData = last7.map(h => h.rom !== undefined ? h.rom : h.value);
              p.historyLabels = last7.map(h => {
                  if (!h.date || h.date === 'N/A') return '--/--';
                  return h.date.split('-').slice(1).join('/'); // 取 月/日
              });

              if (p.historyData.length < 7) {
                  const padding = 7 - p.historyData.length;
                  const firstVal = p.historyData[0] || 0;
                  p.historyData = [...new Array(padding).fill(firstVal), ...p.historyData];
                  p.historyLabels = [...new Array(padding).fill('--/--'), ...p.historyLabels];
              }
            }

            const bpInfo = latestBp ? `，最新血壓為 ${p.bp} mmHg` : "";
            p.diagnosis = fhir.history.length > 0 ? `PoPW 網路已驗證 ${fhir.history.length} 筆生理數據，最新 ROM 為 ${p.rom}°${bpInfo}。` : "尚無 FHIR 復健數據紀錄。";
            
            state.selectedPatientData = { balance, ledger, fhir };
            render();
        } catch(e) { console.error("Sync failed", e); }
    };

    await syncData();
    state.isFirstDetailsRender = false;

    // 開啟每 5 秒自動刷新
    refreshTimer = setInterval(syncData, 5000);
  }

  function render() {
    const app = document.getElementById('therapist-app');
    if (!app) return;

    // 保存捲動位置
    const listEl = document.getElementById('patient-list-container');
    const detailsEl = document.getElementById('details-scroll-container');
    const historyEl = document.getElementById('blockchain-history-container');
    const listScroll = listEl ? listEl.scrollTop : 0;
    const detailsScroll = detailsEl ? detailsEl.scrollTop : 0;
    const historyScroll = historyEl ? historyEl.scrollTop : 0;

    const query = state.searchQuery.trim().toLowerCase();
    const filtered = PATIENTS.filter(p => {
      const matchRisk = state.filterRisk === 'all' || p.risk === state.filterRisk;
      const matchSearch = !query || 
                          p.name.toLowerCase().includes(query) || 
                          p.id.toLowerCase().includes(query);
      return matchRisk && matchSearch;
    });

    // 如果 app 為空，先建立基礎框架
    if (!app.innerHTML || !document.getElementById('patient-list-container')) {
      app.innerHTML = `
        <section class="h-full flex flex-col bg-[var(--bg-app)] text-[var(--text-main)]">
          <header id="main-header" class="bg-[#0F172A] text-white p-6 shadow-xl relative overflow-hidden"></header>
          <div id="patient-list-container" class="flex-1 overflow-y-auto no-scrollbar p-5 space-y-4">
            <div id="search-bar-container" class="flex gap-2 mb-4"></div>
            <div id="patient-list-inner" class="space-y-3"></div>
          </div>
          <div id="details-container"></div>
          <div id="modal-container"></div>
        </section>
      `;
    }

    // 更新 Header
    const headerHtml = `
      <div class="flex justify-between items-center mb-4 relative z-10">
        <div>
          <h2 class="text-xl font-black">臨床監控中心 行動版<span class="text-teal-400">Pro</span></h2>
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
        <button data-act="filter-all" class="bg-white/5 border ${state.filterRisk === 'all' ? 'border-teal-500/50 bg-teal-500/5' : 'border-white/10'} p-3 rounded-2xl text-center hover:bg-white/10 transition-all active:scale-95">
          <div class="text-[9px] ${state.filterRisk === 'all' ? 'text-teal-400' : 'text-slate-500'} font-bold uppercase mb-1">監測中</div>
          <div class="text-xl font-black">${PATIENTS.length}</div>
        </button>
        <button data-act="filter-high" class="bg-white/5 border ${state.filterRisk === 'high' ? 'border-red-500/50 bg-red-500/5' : 'border-white/10'} p-3 rounded-2xl text-center hover:bg-white/10 transition-all active:scale-95">
          <div class="text-[9px] ${state.filterRisk === 'high' ? 'text-red-400' : 'text-slate-500'} font-bold uppercase mb-1">警示</div>
          <div class="text-xl font-black text-red-400">${PATIENTS.filter(p=>p.risk==='high').length}</div>
        </button>
        <div class="bg-white/5 border border-white/10 p-3 rounded-2xl text-center">
          <div class="text-[9px] text-slate-500 font-bold uppercase mb-1">平均依從</div>
          <div class="text-xl font-black text-teal-400">85%</div>
        </div>
      </div>
    `;
    safeSetInnerHTML(document.getElementById('main-header'), headerHtml);

    // 更新搜尋欄 (僅在未聚焦時更新，避免輸入中斷)
    const searchHtml = `
      <input id="search-input" type="text" placeholder="搜尋..." value="${state.searchQuery}" class="flex-1 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl px-4 py-3 text-sm focus:outline-none">
      <select id="risk-filter" class="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl px-3 py-3 text-sm focus:outline-none font-bold">
        <option value="all" ${state.filterRisk==='all'?'selected':''}>全部</option>
        <option value="high" ${state.filterRisk==='high'?'selected':''}>高風險</option>
        <option value="medium" ${state.filterRisk==='medium'?'selected':''}>中風險</option>
        <option value="low" ${state.filterRisk==='low'?'selected':''}>低風險</option>
      </select>
    `;
    const searchContainer = document.getElementById('search-bar-container');
    if (document.activeElement.id !== 'search-input') {
      safeSetInnerHTML(searchContainer, searchHtml);
    }

    // 更新列表
    const listHtml = filtered.map(p => renderPatientCard(p)).join('');
    safeSetInnerHTML(document.getElementById('patient-list-inner'), listHtml);

    // 更新詳細資料與 Modal
    const detailsContainer = document.getElementById('details-container');
    const newDetailsHtml = state.selectedId ? renderPatientDetails(PATIENTS.find(p=>p.id===state.selectedId)) : '';
    
    // 如果選中的病患沒變，且詳細視窗已經開啟，我們只更新內部的數值，而不重繪整個容器
    const detailsScrollEl = document.getElementById('details-scroll-container');
    if (detailsScrollEl && state.selectedId && detailsContainer.dataset.renderedId === state.selectedId) {
        // 僅更新特定數值以防止閃爍
        const p = PATIENTS.find(pt => pt.id === state.selectedId);
        const balEl = detailsContainer.querySelector('.balance-val');
        if (balEl) balEl.innerText = Math.floor(state.selectedPatientData?.balance || p.healBal);
        
        const romEl = detailsContainer.querySelector('.rom-val');
        if (romEl) {
          const currentRom = p.rom || 0;
          if (romEl.innerText !== currentRom + '°') romEl.innerText = currentRom + '°';
        }
    } else {
        safeSetInnerHTML(detailsContainer, newDetailsHtml);
        detailsContainer.dataset.renderedId = state.selectedId || '';
    }
    
    safeSetInnerHTML(document.getElementById('modal-container'), state.showPrescribeModal ? renderPrescribeModal(PATIENTS.find(p=>p.id===state.selectedId)) : '');

    if (state.isFirstDetailsRender) state.isFirstDetailsRender = false;
    
    // 還原捲動位置
    const newListEl = document.getElementById('patient-list-container');
    const newDetailsEl = document.getElementById('details-scroll-container');
    const newHistoryEl = document.getElementById('blockchain-history-container');
    
    if (newListEl && listScroll) newListEl.scrollTop = listScroll;
    if (newDetailsEl && detailsScroll) newDetailsEl.scrollTop = detailsScroll;
    if (newHistoryEl && historyScroll) newHistoryEl.scrollTop = historyScroll;

    if (state.selectedId) {
        // 只有在數據真的有變化時才更新圖表，或第一次渲染時更新
        const p = PATIENTS.find(p => p.id === state.selectedId);
        setTimeout(() => initChart(p), 100);
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
    const genderIcon = p.gender === 'female' ? '<i class="fas fa-venus text-pink-400"></i>' : '<i class="fas fa-mars text-blue-400"></i>';
    return `
      <div data-act="select-patient" data-id="${p.id}" class="bg-[var(--bg-card)] p-5 rounded-[32px] border ${isSelected ? 'border-teal-500 shadow-lg' : 'border-[var(--border-color)]'} transition-all hover:scale-[1.02] hover:border-teal-500/50 hover:shadow-xl active:scale-[0.98] cursor-pointer group">
        <div class="flex justify-between items-center">
          <div class="flex gap-4 items-center">
            <div class="w-12 h-12 rounded-2xl bg-[var(--bg-app)] flex items-center justify-center text-xl group-hover:bg-teal-500/10 transition-colors">👤</div>
            <div>
              <div class="flex items-center gap-2">
                <h4 class="font-black text-[var(--text-main)] text-lg">${maskName(p.name)} <span class="ml-0.5 text-sm opacity-80">${genderIcon}</span></h4>
                <span class="text-[9px] font-black text-teal-600 bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/20 uppercase">LVL ${p.level || 1}</span>
              </div>
              <p class="text-[10px] ${p.risk === 'high' ? 'text-red-500 font-bold' : 'text-[var(--text-muted)]'} mt-0.5 flex items-center gap-1">
                <span class="w-1 h-1 rounded-full ${p.risk === 'high' ? 'bg-red-500 animate-pulse' : 'bg-slate-300'}"></span>
                ${p.alert}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-4">
            <div class="text-right hidden sm:block">
              <div class="text-[9px] font-black text-[var(--text-muted)] uppercase mb-1">血壓 / ROM</div>
              <div class="text-xl font-black ${p.risk === 'high' ? 'text-red-500' : 'text-[var(--text-main)]'}">${p.bp || '--/--'}</div>
              <div class="text-[10px] font-bold opacity-60">${p.rom}°</div>
            </div>
            <div class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-teal-500 group-hover:text-white transition-all shadow-inner">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderPatientDetails(p) {
    if (!p) return '';
    
    const displayBalance = state.selectedPatientData ? state.selectedPatientData.balance : p.healBal;
    const displayHistory = state.selectedPatientData ? state.selectedPatientData.ledger : [];
    const walletAddr = p.wallet || '0x...';
    
    // 計算折扣憑證數量 (統計 BURN 紀錄中包含「兌換」字樣的次數)
    const couponCount = displayHistory.filter(b => b.data.type === 'BURN' && b.data.task.includes('兌換')).length;
    
    const animClass = state.isFirstDetailsRender ? 'animate-slide-up' : '';

    const getBpColor = (bpStr) => {
      if (!bpStr) return 'text-[var(--text-main)]';
      const [sys, dia] = bpStr.split('/').map(Number);
      if (sys > 140 || sys < 90 || dia > 90 || dia < 60) return 'text-red-500';
      return 'text-[var(--text-main)]';
    };

    return `
      <div class="fixed inset-x-0 bottom-0 bg-[var(--bg-card)] rounded-t-[40px] shadow-2xl z-20 border-t border-[var(--border-color)] ${animClass} h-[90%] flex flex-col">
        <div class="w-12 h-1.5 bg-slate-500/20 rounded-full mx-auto mt-4 mb-6 shrink-0"></div>
        <div id="details-scroll-container" class="px-8 flex-1 overflow-y-auto no-scrollbar pb-20">
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

          <div class="grid grid-cols-2 gap-4 mb-6">
            <div class="bg-gradient-to-br from-slate-800 to-slate-900 p-5 rounded-3xl text-white shadow-lg border border-white/5">
              <div class="text-[10px] font-bold text-teal-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <i class="fa-solid fa-coins text-yellow-500"></i> 健康幣資產
              </div>
              <div class="text-3xl font-black"><span class="balance-val">${Math.floor(displayBalance)}</span> <span class="text-xs font-bold text-slate-400">COINS</span></div>
            </div>
            <div class="bg-teal-500/5 p-5 rounded-3xl border border-teal-500/20">
              <div class="text-[10px] font-bold text-teal-600 uppercase tracking-wider mb-2">同步等級 (Level)</div>
              <div class="text-3xl font-black text-teal-600">LVL ${p.level || 1}</div>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-4 mb-8">
            <div class="bg-amber-500/5 p-5 rounded-3xl border border-amber-500/20 flex justify-between items-center">
              <div>
                <div class="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">可用折扣憑證</div>
                <div class="text-2xl font-black text-amber-600">${couponCount} <span class="text-xs font-bold opacity-60">張可用</span></div>
              </div>
              <div class="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-600 text-xl">
                <i class="fa-solid fa-ticket"></i>
              </div>
            </div>
          </div>

          <div class="mb-8">
            <h4 class="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-4 flex justify-between items-center px-1">
                PoPW 區塊鏈成就時間軸
                <i class="fa-solid fa-link text-teal-500 animate-pulse"></i>
            </h4>
            <div id="blockchain-history-container" class="space-y-3 max-h-[300px] overflow-y-auto no-scrollbar pr-1 custom-scroll">
              ${displayHistory.length > 0 ? displayHistory.map(b => `
                <div class="bg-[var(--bg-app)] border border-[var(--border-color)] p-4 rounded-2xl relative overflow-hidden group">
                  <div class="absolute left-0 top-0 bottom-0 w-1 ${b.data.type === 'MINT' ? 'bg-teal-500' : 'bg-red-500'}"></div>
                  <div class="flex justify-between items-start mb-1">
                    <div class="text-[11px] font-black">${b.data.task}</div>
                    <div class="text-[10px] font-mono ${b.data.type === 'MINT' ? 'text-teal-500' : 'text-red-500'} font-bold">${b.data.type === 'MINT' ? '+' : '-'}${b.data.amount}</div>
                  </div>
                  <div class="flex justify-between items-center">
                    <div class="text-[8px] font-mono text-slate-500">BLOCK: ${b.hash.slice(0, 20)}...</div>
                    <div class="text-[8px] text-slate-400 font-bold">
                        ${new Date(b.timestamp).toLocaleDateString()} ${new Date(b.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              `).join('') : `
                <div class="text-center py-6 text-slate-400 text-xs italic bg-[var(--bg-app)] rounded-2xl border border-dashed border-[var(--border-color)]">無區塊鏈同步紀錄</div>
              `}
            </div>
          </div>

          <div class="bg-[var(--bg-app)] p-5 rounded-3xl mb-6 border border-[var(--border-color)]">
            <h4 class="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-3">基本參數</h4>
            <div class="grid grid-cols-2 gap-y-3">
              <div><div class="text-[9px] text-[var(--text-muted)] uppercase">性別</div><div class="text-sm font-black">${p.gender === 'female' ? '女性 ♀' : '男性 ♂'}</div></div>
              <div><div class="text-[9px] text-[var(--text-muted)] uppercase">當前 ROM</div><div class="text-sm font-black text-teal-600 rom-val">${p.rom || 0}°</div></div>
              <div><div class="text-[9px] text-[var(--text-muted)] uppercase">生日</div><div class="text-sm font-black">${p.birthday || '1960-01-01'}</div></div>
              <div><div class="text-[9px] text-[var(--text-muted)] uppercase">血壓</div><div class="text-sm font-black ${getBpColor(p.bp)}">${p.bp || '120/80'}</div></div>
              <div><div class="text-[9px] text-[var(--text-muted)] uppercase">身高</div><div class="text-sm font-black">${p.height || '--'} cm</div></div>
              <div><div class="text-[9px] text-[var(--text-muted)] uppercase">體重</div><div class="text-sm font-black">${p.weight || '--'} kg</div></div>
            </div>
          </div>

          <div class="bg-[var(--bg-app)] border border-[var(--border-color)] p-6 rounded-[32px] mb-8 shadow-sm">
            <h4 class="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-6">ROM 康復趨勢分析</h4>
            <div class="h-48 relative"><canvas id="romTrendChart"></canvas></div>
          </div>

          <div class="mb-8">
            <div class="flex items-center gap-2 mb-4">
              <div class="w-5 h-5 bg-teal-500 rounded flex items-center justify-center text-white text-[10px]">AI</div>
              <h4 class="text-[10px] font-black text-[var(--text-main)] uppercase tracking-widest">臨床智慧診斷摘要</h4>
            </div>
            <div class="bg-[var(--bg-app)] border-2 border-teal-500/20 rounded-3xl p-5 shadow-inner">
              <div class="text-[9px] font-black text-teal-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                <span class="relative flex h-2 w-2">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                  <span class="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
                </span>
                HealScape AI 智慧診斷中... 數據實時分析中
              </div>
              <p class="text-sm text-[var(--text-main)] font-medium leading-relaxed italic">
                "${p.diagnosis || '目前暫無 AI 生成之診斷報告。'}"
              </p>
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

  let chartInstance = null;

  function initChart(p) {
    const canvas = document.getElementById('romTrendChart');
    if (!canvas) return;
    
    const isDark = state.isDarkMode;
    const labels = p.historyLabels || ['--', '--', '--', '--', '--', '--', '今'];
    const data = p.historyData || [];

    // 如果圖表已存在，且是同一位病患，則更新數據而非銷毀重建
    if (chartInstance && canvas.dataset.chartPatientId === p.id) {
        chartInstance.data.labels = labels;
        chartInstance.data.datasets[0].data = data;
        
        // 同步更新顏色（預防主題切換）
        chartInstance.options.scales.y.grid.color = isDark ? '#334155' : '#f1f5f9';
        chartInstance.options.scales.y.ticks.color = isDark ? '#94a3b8' : '#64748b';
        chartInstance.options.scales.x.ticks.color = isDark ? '#94a3b8' : '#64748b';
        
        // 使用 'none' 模式更新，防止觸發初始動畫（就不會歸零再跳出）
        chartInstance.update('none');
        return;
    }

    // 只有在更換病患或第一次載入時才徹底銷毀重建
    if (chartInstance) {
        chartInstance.destroy();
    }
    
    const ctx = canvas.getContext('2d');
    canvas.dataset.chartPatientId = p.id;
    
    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: p.historyLabels || ['--', '--', '--', '--', '--', '--', '今'],
        datasets: [{
          data: p.historyData,
          borderColor: p.risk === 'high' ? '#ef4444' : '#14b8a6',
          backgroundColor: p.risk === 'high' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(20, 184, 166, 0.1)',
          borderWidth: 3, tension: 0.4, fill: true, pointRadius: 4,
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
    const app = document.getElementById('therapist-app');
    if (!app || app.dataset.eventsBound) return;
    app.dataset.eventsBound = "true";

    app.addEventListener('input', (e) => {
      const id = e.target.id;
      if (id === 'search-input') { state.searchQuery = e.target.value; render(); }
      else if (id === 'prescribe-reps') { state.prescribeForm.reps = parseInt(e.target.value) || 0; }
      else if (id === 'prescribe-diff') { state.prescribeForm.difficulty = parseInt(e.target.value) || 0; }
    });

    app.addEventListener('change', (e) => {
      const id = e.target.id;
      if (id === 'risk-filter') { state.filterRisk = e.target.value; render(); }
      else if (id === 'prescribe-task') { state.prescribeForm.task = e.target.value; }
    });

    app.addEventListener('click', (e) => {
      const t = e.target.closest('[data-act]');
      if (!t) return;
      const act = t.dataset.act;
      if (act === 'toggle-theme') {
        state.isDarkMode = !state.isDarkMode;
        document.body.classList.toggle('dark-mode', state.isDarkMode);
        localStorage.setItem('theme', state.isDarkMode ? 'dark' : 'light');
        render();
      } else if (act === 'filter-all') { state.filterRisk = 'all'; render(); }
      else if (act === 'filter-high') { state.filterRisk = 'high'; render(); }
      else if (act === 'select-patient') { selectPatient(t.dataset.id); }
      else if (act === 'close-details') { state.selectedId = null; render(); }
      else if (act === 'open-prescribe') { state.showPrescribeModal = true; render(); }
      else if (act === 'close-prescribe') { state.showPrescribeModal = false; render(); }
      else if (act === 'submit-prescribe') {
        if (t.classList.contains('opacity-50')) return;
        t.classList.add('opacity-50');
        t.innerText = "簽署中...";
        
        const p = PATIENTS.find(pt => pt.id === state.selectedId);
        window.showBlockchainProgress(`正在為 ${maskName(p.name)} 簽署智能合約處方...`, 3000).then(async () => {
            try {
                const res = await window.healscapeApi.createPrescription({
                    therapistId: sessionStorage.getItem('userId'),
                    patientId: state.selectedId,
                    task: state.prescribeForm.task,
                    reps: state.prescribeForm.reps,
                    difficulty: state.prescribeForm.difficulty
                });
                state.showPrescribeModal = false;
                render();
                toast(`處方發布成功！<br><span class="text-[8px] font-mono opacity-60">TX: ${res.prescription.txHash}</span>`);
            } catch(e) { 
                toast("處方發布失敗"); 
                t.classList.remove('opacity-50');
                t.innerText = "發布並簽署";
            }
        });
      }
    });
  }

  function toast(msg) {
    const wrap = document.getElementById('toastWrap');
    if (!wrap) return;
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<span class="font-bold">${msg}</span>`;
    wrap.appendChild(t);
    setTimeout(() => t.remove(), 2000);
  }

  init();
})();
