/**
 * HealScape Blockchain Engine (Simulation)
 * 用於競賽展示的模擬區塊鏈系統
 */

class HealBlock {
    constructor(index, timestamp, data, previousHash = '') {
        this.index = index;
        this.timestamp = timestamp;
        this.data = data; // { type: 'MINT'|'BURN', amount: number, task: string }
        this.previousHash = previousHash;
        this.hash = this.calculateHash();
    }

    calculateHash() {
        // 模擬加密 Hash 值
        const str = this.index + this.timestamp + JSON.stringify(this.data) + this.previousHash;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = (hash << 5) - hash + str.charCodeAt(i);
            hash |= 0;
        }
        return '0x' + Math.abs(hash).toString(16).padStart(16, '0');
    }
}

class HealChain {
    constructor() {
        this.walletAddress = this.getOrCreateWallet();
        this.exchangeRate = 100; // 100幣 = 10元
        this._balance = 0;
        this._history = [];
    }

    getOrCreateWallet() {
        let addr = localStorage.getItem('heal_wallet_addr');
        if (!addr) {
            addr = '0x' + Math.random().toString(16).slice(2, 10).toUpperCase() + '...' + Math.random().toString(16).slice(2, 6).toUpperCase();
            localStorage.setItem('heal_wallet_addr', addr);
        }
        return addr;
    }

    async refresh() {
        const id = sessionStorage.getItem('userId');
        const role = sessionStorage.getItem('userRole');
        if (!id || role !== 'patient') return; // 只有病患角色需要自動同步自己的區塊鏈狀態
        try {
            this._balance = await window.healscapeApi.getHEALBalance(id);
            this._history = await window.healscapeApi.getLedger(id);
        } catch(e) { console.error("Blockchain sync failed", e); }
    }

    getBalance() {
        return this._balance;
    }

    async mint(amount, taskName) {
        const id = sessionStorage.getItem('userId');
        const res = await window.healscapeApi.submitPoPW({
            patientId: id,
            task: taskName,
            reps: 1, // 簡化處理
            angle: 0,
            adherence: 100
        });
        await this.refresh();
        return res.block;
    }

    async burn(amount, reason) {
        const id = sessionStorage.getItem('userId');
        try {
            const res = await window.healscapeApi.burnHEAL({
                patientId: id,
                amount: amount,
                reason: reason
            });
            await this.refresh();
            return res.block;
        } catch(e) {
            console.error("Burn failed", e);
            throw e;
        }
    }

    getFormattedHistory() {
        return this._history.map(block => ({
            ...block,
            timeLabel: new Date(block.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            dateLabel: new Date(block.timestamp).toLocaleDateString()
        }));
    }
}

// 全域實例
window.blockchain = new HealChain();

/**
 * UI 輔助函數：顯示上鏈進度條
 */
window.showBlockchainProgress = (message = "AI 動作辨識中...", duration = 3000) => {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = "fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in";
        overlay.innerHTML = `
            <div class="bg-slate-900 border border-lime-500/30 p-6 rounded-3xl w-[80%] max-w-sm shadow-2xl">
                <div class="flex flex-col items-center text-center">
                    <div class="w-16 h-16 border-4 border-lime-500/20 border-t-lime-500 rounded-full animate-spin mb-4"></div>
                    <h3 class="text-white font-bold text-lg mb-2">${message}</h3>
                    <p class="text-slate-400 text-sm mb-6">正在透過區塊鏈存證數據...</p>
                    <div class="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div id="bc-progress-bar" class="bg-gradient-to-r from-lime-500 to-emerald-500 h-full w-0 transition-all duration-[${duration}ms]"></div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        
        const bar = document.getElementById('bc-progress-bar');
        setTimeout(() => { bar.style.width = "100%"; }, 50);

        setTimeout(() => {
            overlay.classList.remove('fade-in');
            overlay.style.opacity = "0";
            setTimeout(() => {
                document.body.removeChild(overlay);
                resolve();
            }, 500);
        }, duration);
    });
};

/**
 * UI 輔助函數：顯示金幣獲得動畫
 */
window.showCoinMinted = (amount) => {
    const toast = document.createElement('div');
    toast.className = "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[10000] animate-in zoom-in pointer-events-none";
    toast.innerHTML = `
        <div class="flex flex-col items-center">
            <div class="text-6xl mb-4 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)] text-yellow-400">
                <i class="fa-solid fa-coins animate-bounce"></i>
            </div>
            <div class="bg-yellow-500 text-black font-black px-6 py-2 rounded-full text-2xl shadow-xl">
                +${amount} 健康幣
            </div>
        </div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translate(-50%, -80%) scale(0.8)";
        toast.style.transition = "all 0.8s ease-in";
        setTimeout(() => document.body.removeChild(toast), 800);
    }, 2000);
};
