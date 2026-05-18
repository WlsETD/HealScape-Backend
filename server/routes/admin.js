const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');

const USERS_FILE = path.join(__dirname, '../data/users.json');
const BALANCES_FILE = path.join(__dirname, '../data/balances.json');
const LOGS_FILE = path.join(__dirname, '../data/logs.json');

// 取得所有用戶及其餘額
router.get('/users', async (req, res) => {
    try {
        const users = await fs.readJson(USERS_FILE);
        const balances = await fs.readJson(BALANCES_FILE);
        
        const fullUsers = users.map(u => ({
            ...u,
            balance: balances[u.id] || 0
        }));
        
        res.json(fullUsers);
    } catch (error) {
        res.status(500).json({ message: '無法取得用戶列表', error: error.message });
    }
});

// 更新用戶資料
router.post('/update-user', async (req, res) => {
    const { id } = req.body;
    try {
        const users = await fs.readJson(USERS_FILE);
        const index = users.findIndex(u => u.id === id);
        
        if (index === -1) return res.status(404).json({ message: '找不到該用戶' });
        
        // 合併所有傳入的欄位 (除了 id)
        const updates = { ...req.body };
        delete updates.id;
        
        users[index] = {
            ...users[index],
            ...updates
        };
        
        await fs.writeJson(USERS_FILE, users, { spaces: 2 });
        res.json({ success: true, message: '更新成功' });
    } catch (error) {
        res.status(500).json({ message: '更新失敗', error: error.message });
    }
});

// 修改密碼
router.post('/change-password', async (req, res) => {
    const { id, password } = req.body;
    try {
        const users = await fs.readJson(USERS_FILE);
        const index = users.findIndex(u => u.id === id);
        
        if (index === -1) return res.status(404).json({ message: '找不到該用戶' });
        
        users[index].password = password;
        
        await fs.writeJson(USERS_FILE, users, { spaces: 2 });
        res.json({ success: true, message: '密碼修改成功' });
    } catch (error) {
        res.status(500).json({ message: '密碼修改失敗', error: error.message });
    }
});

// 獲取日誌
router.get('/logs', async (req, res) => {
    try {
        const logs = await fs.readJson(LOGS_FILE);
        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: '無法取得日誌', error: error.message });
    }
});

// 新增用戶
router.post('/add-user', async (req, res) => {
    const { email, password, role, name, gender, birthday, height, weight } = req.body;
    try {
        const users = await fs.readJson(USERS_FILE);
        const balances = await fs.readJson(BALANCES_FILE);
        
        const newUser = {
            id: Date.now().toString(),
            email,
            password,
            role,
            name,
            gender,
            birthday,
            height,
            weight,
            level: 1,
            xp: 0
        };
        
        users.push(newUser);
        balances[newUser.id] = 0; // 初始化餘額
        
        await fs.writeJson(USERS_FILE, users, { spaces: 2 });
        await fs.writeJson(BALANCES_FILE, balances, { spaces: 2 });
        
        res.json({ success: true, message: '新增成功' });
    } catch (error) {
        res.status(500).json({ message: '新增失敗', error: error.message });
    }
});

module.exports = router;
