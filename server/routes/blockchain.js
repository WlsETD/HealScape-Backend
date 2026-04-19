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
 */
router.get('/sbts/:patientId', async (req, res) => {
    res.json([
        { id: 'SBT-001', name: '復健初心者', type: 'Achievement', date: '2026-03-01', image: '🛡️' },
        { id: 'SBT-002', name: 'FHIR 數據通訊兵', type: 'Technical', date: '2026-04-16', image: '📡' }
    ]);
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
