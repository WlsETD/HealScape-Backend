/* HealScape Demo Engine - 強制同步穩定版 */
(function() {
    console.log("HealScape Mock System Initializing...");

    const demoUsers = [
        { id: "admin01", email: "admin", password: "admin", role: "admin", name: "系統管理員", gender: "male" },
        { id: "11", email: "11", password: "1234", role: "patient", name: "陳大民", gender: "male", bp: "118/76", height: "175", weight: "72", level: 6, xp: 2250 },
        { id: "33", email: "33", password: "1234", role: "patient", name: "林小華", gender: "female", bp: "122/81", height: "160", weight: "52", level: 3, xp: 1450 },
        { id: "22", email: "22", password: "1234", role: "therapist", name: "王建民醫師", gender: "male" }
    ];

    // 強制重置或補充帳號資料
    let currentUsers = JSON.parse(localStorage.getItem('demo_users') || '[]');
    demoUsers.forEach(du => {
        const idx = currentUsers.findIndex(u => u.id === du.id || u.email === du.email);
        if (idx === -1) {
            currentUsers.push(du);
        } else {
            // 強制更新密碼，確保 1234 可以使用
            currentUsers[idx].password = du.password;
            currentUsers[idx].email = du.email;
        }
    });
    localStorage.setItem('demo_users', JSON.stringify(currentUsers));

    if (!localStorage.getItem('demo_ledger')) localStorage.setItem('demo_ledger', JSON.stringify({}));
    if (!localStorage.getItem('demo_fhir')) localStorage.setItem('demo_fhir', JSON.stringify({}));
    if (!localStorage.getItem('demo_logs')) {
        localStorage.setItem('demo_logs', JSON.stringify([{ timestamp: new Date().toISOString(), message: "系統啟動", type: "INFO" }]));
    }

    // API 模擬
    window.healscapeApi = {
        async getPatients() { 
            return JSON.parse(localStorage.getItem('demo_users')).filter(u => u.role === 'patient'); 
        },
        async getProfile(id) { return JSON.parse(localStorage.getItem('demo_users')).find(u => u.id === id); },
        async getPatientData(id) { 
            const fhir = JSON.parse(localStorage.getItem('demo_fhir') || '{}');
            return { history: fhir[id] || [] };
        },
        async uploadSession(data) {
            const fhir = JSON.parse(localStorage.getItem('demo_fhir') || '{}');
            if (!fhir[data.patientId]) fhir[data.patientId] = [];
            
            // 同步更新 demo_users 的 bp，確保醫師端即時看到
            if (data.task === 'bp') {
                const users = JSON.parse(localStorage.getItem('demo_users'));
                const uIdx = users.findIndex(u => u.id === data.patientId);
                if (uIdx !== -1) {
                    users[uIdx].bp = `${data.rom}/${data.reps || 80}`;
                    localStorage.setItem('demo_users', JSON.stringify(users));
                }
            }

            fhir[data.patientId].unshift({
                date: new Date().toISOString().split('T')[0],
                type: data.task,
                rom: data.rom || 0,
                value: data.rom || data.value || 0,
                reps: data.reps || 80,
                fhirId: 'MOCK-' + Math.random().toString(36).substr(2, 5)
            });
            localStorage.setItem('demo_fhir', JSON.stringify(fhir));
            return { success: true };
        },
        async adminGetUsers() { return JSON.parse(localStorage.getItem('demo_users')); },
        async adminGetLogs() { return JSON.parse(localStorage.getItem('demo_logs')); },
        async getSoulboundTokens(id) { 
            const user = JSON.parse(localStorage.getItem('demo_users')).find(u => u.id === id);
            const level = user ? (parseInt(user.level) || 1) : 1;
            const sbts = [];
            
            // 1. 復健成就勳章 (根據新等級區間演化)
            let achievement = { id: 'SBT-LEVEL', type: 'Achievement', date: '2026-03-01' };
            if (level >= 21) {
                achievement.name = '復健超越者';
                achievement.image = '🌌';
                achievement.rank = 'Transcendent';
            } else if (level >= 11) {
                achievement.name = '復健守護者';
                achievement.image = '🔮';
                achievement.rank = 'Guardian';
            } else if (level >= 4) {
                achievement.name = '復健開拓者';
                achievement.image = '🏹';
                achievement.rank = 'Pathfinder';
            } else {
                achievement.name = '復健啟航者';
                achievement.image = '🛡️';
                achievement.rank = 'Voyager';
            }
            sbts.push(achievement);

            // 2. 數據存證勳章
            sbts.push({ 
                id: 'SBT-DATA', 
                name: level > 10 ? 'FHIR 數據架構師' : 'FHIR 數據通訊兵', 
                type: 'Technical', 
                date: '2026-04-16', 
                image: '📡',
                rank: level > 10 ? 'Advanced' : 'Basic'
            });

            if (level >= 4) {
                sbts.push({ 
                    id: 'SBT-POPW', 
                    name: level >= 11 ? 'PoPW 超級節點' : 'PoPW 網路節點', 
                    type: 'Contribution', 
                    date: '2026-04-20', 
                    image: '⚡',
                    rank: level >= 11 ? 'Super' : 'Core'
                });
            }
            return sbts;
        },

    // Auth 模擬
    window.healscapeAuth = {
        checkAuth() { return true; },
        async login(email, pass) {
            const users = JSON.parse(localStorage.getItem('demo_users'));
            const user = users.find(u => String(u.email) === String(email) && String(u.password) === String(pass));
            if (!user) throw new Error("帳號或密碼錯誤");
            sessionStorage.setItem('userId', user.id);
            sessionStorage.setItem('role', user.role);
            sessionStorage.setItem('userName', user.name);
            return { user };
        },
        logout() {
            sessionStorage.clear();
            location.href = 'index.html';
        }
    };

    window.blockchain = {
        walletAddress: "0xDEMO_WALLET",
        getBalance() { return 100; },
        async mint() { return { success: true }; },
        getFormattedHistory() { return []; }
    };

    window.showBlockchainProgress = (msg, time) => new Promise(r => setTimeout(r, time));
    window.showCoinMinted = (amount) => console.log("Coin Minted: " + amount);
})();
