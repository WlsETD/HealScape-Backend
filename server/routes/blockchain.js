const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const BALANCES_FILE = path.join(DATA_DIR, 'balances.json');
const LEDGER_FILE = path.join(DATA_DIR, 'ledger.json');
const PRESCRIPTIONS_FILE = path.join(DATA_DIR, 'prescriptions.json');

// 確保所有數據檔案存在
async function ensureFiles() {
    if (!await fs.pathExists(DATA_DIR)) await fs.mkdirp(DATA_DIR);
    if (!await fs.pathExists(BALANCES_FILE)) await fs.writeJson(BALANCES_FILE, {});
    if (!await fs.pathExists(LEDGER_FILE)) await fs.writeJson(LEDGER_FILE, []);
    if (!await fs.pathExists(PRESCRIPTIONS_FILE)) await fs.writeJson(PRESCRIPTIONS_FILE, {});
}

/**
 * 提交 PoPW (Proof of Physical Work)
 */
router.post('/submit-popw', async (req, res) => {
    const { patientId, task, reps, angle, adherence } = req.body;
    await ensureFiles();
    const balances = await fs.readJson(BALANCES_FILE);
    const ledger = await fs.readJson(LEDGER_FILE);
    
    const baseReward = 5;
    const bonus = Math.floor(reps * 0.2); 
    const totalReward = parseFloat(((baseReward + bonus) * (adherence / 100)).toFixed(1));
    
    const currentBal = balances[patientId] || 0;
    balances[patientId] = parseFloat((currentBal + totalReward).toFixed(2));
    
    const block = {
        index: ledger.length,
        timestamp: new Date().toISOString(),
        data: { type: 'MINT', amount: totalReward, task: `完成${task}訓練`, patientId },
        hash: '0x' + Math.random().toString(16).slice(2, 42)
    };
    ledger.push(block);
    
    await fs.writeJson(BALANCES_FILE, balances);
    await fs.writeJson(LEDGER_FILE, ledger);
    
    res.json({ success: true, txHash: block.hash, reward: totalReward, newBalance: balances[patientId], block });
});

/**
 * 獲取 SBT (Soulbound Tokens)
 * 根據病患等級動態演化
 */
router.get('/sbts/:patientId', async (req, res) => {
    const { patientId } = req.params;
    let level = 1;
    
    try {
        const USERS_FILE = path.join(__dirname, '../data/users.json');
        const users = await fs.readJson(USERS_FILE);
        const user = users.find(u => u.id === patientId);
        if (user) level = parseInt(user.level) || 1;
    } catch (e) { console.error("Read users.json for SBT failed", e); }

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

    // 2. 數據存證勳章 (演化門檻同步調整)
    sbts.push({ 
        id: 'SBT-DATA', 
        name: level > 10 ? 'FHIR 數據架構師' : 'FHIR 數據通訊兵', 
        type: 'Technical', 
        date: '2026-04-16', 
        image: '📡',
        rank: level > 10 ? 'Advanced' : 'Basic'
    });

    // 3. PoPW 貢獻勳章 (Lv 11 以上開放更高階版本)
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

    res.json(sbts);
});

/**
 * 銷毀健康幣 (BURN)
 */
router.post('/burn', async (req, res) => {
    const { patientId, amount, reason } = req.body;
    await ensureFiles();
    const balances = await fs.readJson(BALANCES_FILE);
    const ledger = await fs.readJson(LEDGER_FILE);
    
    const currentBal = balances[patientId] || 0;
    if (currentBal < amount) {
        return res.status(400).json({ message: '餘額不足，無法銷毀' });
    }
    
    balances[patientId] = parseFloat((currentBal - amount).toFixed(2));
    
    const block = {
        index: ledger.length,
        timestamp: new Date().toISOString(),
        data: { type: 'BURN', amount: amount, task: reason || '銷毀健康幣', patientId },
        hash: '0x' + Math.random().toString(16).slice(2, 42)
    };
    ledger.push(block);
    
    await fs.writeJson(BALANCES_FILE, balances);
    await fs.writeJson(LEDGER_FILE, ledger);
    
    res.json({ success: true, txHash: block.hash, newBalance: balances[patientId], block });
});

/**
 * 發布處方簽 (醫師使用)
 */
router.post('/prescribe', async (req, res) => {
    const { therapistId, patientId, task, reps, difficulty } = req.body;
    await ensureFiles();
    const prescriptions = await fs.readJson(PRESCRIPTIONS_FILE);
    
    if (!prescriptions[patientId]) prescriptions[patientId] = [];
    
    const newPrescription = {
        id: 'TX-' + Math.random().toString(16).slice(2, 10).toUpperCase(),
        therapistId,
        task,
        reps: parseInt(reps),
        difficulty: parseInt(difficulty),
        timestamp: new Date().toISOString(),
        status: 'active',
        txHash: '0x' + Math.random().toString(16).slice(2, 42)
    };
    
    prescriptions[patientId].unshift(newPrescription);
    await fs.writeJson(PRESCRIPTIONS_FILE, prescriptions);
    
    res.json({ success: true, prescription: newPrescription });
});

/**
 * 獲取病患的所有處方
 */
router.get('/prescriptions/:patientId', async (req, res) => {
    const { patientId } = req.params;
    await ensureFiles();
    const prescriptions = await fs.readJson(PRESCRIPTIONS_FILE);
    res.json(prescriptions[patientId] || []);
});

/**
 * 其他 Web3 路由保持不變...
 */
router.get('/balance/:patientId', async (req, res) => {
    const { patientId } = req.params;
    await ensureFiles();
    const balances = await fs.readJson(BALANCES_FILE);
    res.json({ balance: balances[patientId] || 0 });
});

router.get('/ledger/:patientId', async (req, res) => {
    await ensureFiles();
    const ledger = await fs.readJson(LEDGER_FILE);
    res.json(ledger.filter(b => b.data.patientId === req.params.patientId).reverse());
});

module.exports = router;
