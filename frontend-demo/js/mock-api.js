/* HealScape Mock System - Pure Frontend Version (No Auth/No Server) */
(function() {
    console.log("HealScape Pure Frontend Hub Initialized");

    // 預設用戶數據
    const defaultUsers = [
        { id: "admin01", email: "admin", role: "admin", name: "系統管理員", gender: "male" },
        { id: "11", email: "11", role: "patient", name: "陳大民", gender: "male", bp: "118/76", height: "175", weight: "72", level: 6, xp: 2250, balance: 1250 },
        { id: "33", email: "33", role: "patient", name: "林小華", gender: "female", bp: "122/81", height: "160", weight: "52", level: 3, xp: 1450, balance: 800 },
        { id: "22", email: "22", role: "therapist", name: "王建民醫師", gender: "male" }
    ];

    // 初始化 LocalStorage 數據庫
    if (!localStorage.getItem('demo_users')) localStorage.setItem('demo_users', JSON.stringify(defaultUsers));
    if (!localStorage.getItem('demo_fhir')) {
        localStorage.setItem('demo_fhir', JSON.stringify({
            "11": [
                { date: '2026-05-15', type: 'rom', rom: 145, value: 145, reps: 15, fhirId: 'MOCK-001' },
                { date: '2026-05-18', type: 'bp', value: 118, reps: 76, fhirId: 'MOCK-BP-01' }
            ]
        }));
    }
    if (!localStorage.getItem('demo_ledger')) {
        localStorage.setItem('demo_ledger', JSON.stringify({
            "11": [{ hash: '0x123...abc', timestamp: Date.now(), data: { task: '每日簽到', amount: 5, type: 'MINT' } }]
        }));
    }
    if (!localStorage.getItem('demo_prescriptions')) {
        localStorage.setItem('demo_prescriptions', JSON.stringify([
            { id: 'pres-01', patientId: '11', therapistId: '22', task: 'arm', reps: 5, difficulty: 110, txHash: '0xTX-PRES-01' }
        ]));
    }

    var getUsers = function() { return JSON.parse(localStorage.getItem('demo_users')); };
    var saveUsers = function(u) { localStorage.setItem('demo_users', JSON.stringify(u)); };

    // --- window.healscapeAuth (簡化版，移除所有驗證邏輯) ---
    window.healscapeAuth = {
        async login(email) {
            const user = getUsers().find(function(u) { return String(u.email) === String(email); });
            return { user: user };
        },
        checkAuth() { return true; }, // 永遠通過
        logout() {
            sessionStorage.clear();
            window.location.href = 'index.html';
        }
    };

    // --- window.healscapeApi (純前端模擬) ---
    window.healscapeApi = {
        async getPatients() { return getUsers().filter(function(u) { return u.role === 'patient'; }); },
        async getProfile(id) { return getUsers().find(function(u) { return u.id === id; }); },
        async updateProfile(id, level, xp) {
            const users = getUsers();
            const idx = users.findIndex(function(u) { return u.id === id; });
            if (idx !== -1) { users[idx].level = level; users[idx].xp = xp; saveUsers(users); }
            return { success: true };
        },
        async syncPatient(id) { return { fhirId: 'MOCK-FHIR-' + id }; },
        async getPatientData(id) {
            const fhir = JSON.parse(localStorage.getItem('demo_fhir') || '{}');
            return { history: fhir[id] || [] };
        },
        async uploadSession(data) {
            const fhir = JSON.parse(localStorage.getItem('demo_fhir') || '{}');
            if (!fhir[data.patientId]) fhir[data.patientId] = [];
            fhir[data.patientId].unshift({
                date: new Date().toISOString().split('T')[0],
                type: data.task === 'bp' ? 'bp' : 'rom',
                value: data.rom || data.value || 0,
                rom: data.rom || data.value || 0,
                reps: data.reps || 0,
                fhirId: 'MOCK-' + Math.random().toString(36).substr(2, 5)
            });
            localStorage.setItem('demo_fhir', JSON.stringify(fhir));
            return { success: true };
        },
        async getPrescriptions(id) {
            const all = JSON.parse(localStorage.getItem('demo_prescriptions') || '[]');
            return all.filter(function(p) { return p.patientId === id; });
        },
        async createPrescription(data) {
            const all = JSON.parse(localStorage.getItem('demo_prescriptions') || '[]');
            const newP = Object.assign({}, data, { id: 'pres-' + Date.now(), txHash: '0xTX-' + Math.random().toString(16).substr(2, 8) });
            all.push(newP);
            localStorage.setItem('demo_prescriptions', JSON.stringify(all));
            return { success: true, prescription: newP };
        },
        async getSoulboundTokens() {
            return [
                { id: 'SBT-1', name: '復健守護者', type: 'Achievement', date: '2026-03-01', image: '🛡️', rank: 'Guardian' },
                { id: 'SBT-2', name: 'FHIR 數據通訊兵', type: 'Technical', date: '2026-04-16', image: '📡', rank: 'Basic' }
            ];
        },
        async getHEALBalance(id) { const user = getUsers().find(function(u) { return u.id === id; }); return user ? (user.balance || 0) : 0; },
        async getLedger(id) { const ledgers = JSON.parse(localStorage.getItem('demo_ledger') || '{}'); return ledgers[id] || []; },
        async adminGetUsers() { return getUsers(); },
        async adminGetLogs() { return [{ timestamp: new Date().toISOString(), message: "系統展示版正常運行中", type: "INFO" }]; },
        async adminAddUser(data) {
            const users = getUsers();
            users.push(Object.assign({}, data, { id: 'user-' + Date.now(), balance: 0, level: 1, xp: 0 }));
            saveUsers(users);
            return { success: true };
        },
        async adminUpdateUser(data) {
            const users = getUsers();
            const idx = users.findIndex(function(u) { return u.id === data.id; });
            if (idx !== -1) { users[idx] = Object.assign({}, users[idx], data); saveUsers(users); }
            return { success: true };
        },
        async adminChangePassword() { return { success: true }; }
    };

    // --- window.blockchain (純前端模擬) ---
    window.blockchain = {
        walletAddress: "0xSTARKNET_DEMO_ADDRESS",
        async refresh() { return true; },
        getBalance() {
            const userId = sessionStorage.getItem('userId');
            const user = getUsers().find(function(u) { return u.id === userId; });
            return user ? (user.balance || 0) : 100;
        },
        async mint(amount, reason) {
            const userId = sessionStorage.getItem('userId');
            const users = getUsers();
            const idx = users.findIndex(function(u) { return u.id === userId; });
            if (idx !== -1) {
                users[idx].balance = (users[idx].balance || 0) + amount;
                saveUsers(users);
                const ledgers = JSON.parse(localStorage.getItem('demo_ledger') || '{}');
                if (!ledgers[userId]) ledgers[userId] = [];
                ledgers[userId].unshift({ hash: '0x' + Math.random().toString(16).substr(2, 32), timestamp: Date.now(), data: { task: reason, amount: amount, type: 'MINT' } });
                localStorage.setItem('demo_ledger', JSON.stringify(ledgers));
            }
            return { hash: 'mock-hash' };
        },
        async burn(amount, reason) {
            const userId = sessionStorage.getItem('userId');
            const users = getUsers();
            const idx = users.findIndex(function(u) { return u.id === userId; });
            if (idx !== -1) {
                users[idx].balance = Math.max(0, (users[idx].balance || 0) - amount);
                saveUsers(users);
            }
            return { hash: 'mock-burn-hash' };
        },
        getFormattedHistory() {
            const userId = sessionStorage.getItem('userId');
            const history = (JSON.parse(localStorage.getItem('demo_ledger') || '{}'))[userId] || [];
            return history.map(function(h) { 
                return Object.assign({}, h, { 
                    dateLabel: new Date(h.timestamp).toLocaleDateString(), 
                    timeLabel: new Date(h.timestamp).toLocaleTimeString() 
                }); 
            });
        }
    };

    window.showBlockchainProgress = (msg, time) => new Promise(r => setTimeout(r, time));
    window.showCoinMinted = () => {};
    window.toast = (msg, type) => {
        const wrap = document.getElementById('toastWrap');
        if (!wrap) return;
        const t = document.createElement('div');
        t.className = 'toast ' + (type === 'error' ? 'bg-red-500' : 'bg-teal-600') + ' text-white px-6 py-4 rounded-[20px] shadow-2xl font-bold mb-4';
        t.innerHTML = msg;
        wrap.appendChild(t);
        setTimeout(function() { t.remove(); }, 2500);
    };
})();
