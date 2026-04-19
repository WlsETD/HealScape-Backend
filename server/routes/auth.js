const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');
const jwt = require('jsonwebtoken');

const USERS_FILE = path.join(__dirname, '../data/users.json');
const SECRET_KEY = 'healscape_secret_key'; 

// 取得所有用戶 (內部工具)
async function getUsers() {
    const data = await fs.readJson(USERS_FILE);
    return data;
}

// 登入 API
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const users = await getUsers();
        const user = users.find(u => u.email === email && u.password === password);
        
        if (!user) {
            return res.status(401).json({ message: '帳號或密碼錯誤' });
        }
        
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            SECRET_KEY,
            { expiresIn: '24h' }
        );
        
        // 確保回傳所有必要的屬性，若無則提供預設值
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                name: user.name,
                level: parseInt(user.level) || 1,
                xp: parseInt(user.xp) || 0
            }
        });
    } catch (error) {
        res.status(500).json({ message: '伺服器錯誤', error: error.message });
    }
});

// 獲取所有病患列表 (醫師使用)
router.get('/patients', async (req, res) => {
    try {
        const users = await getUsers();
        const patients = users.filter(u => u.role === 'patient').map(u => ({
            id: u.id,
            name: u.name,
            email: u.email,
            gender: u.gender || 'male',
            level: parseInt(u.level) || 1,
            xp: parseInt(u.xp) || 0,
            bp: u.bp || '',
            height: u.height || '',
            weight: u.weight || '',
            birthday: u.birthday || ''
        }));
        res.json(patients);
    } catch (error) {
        res.status(500).json({ message: '無法取得病患列表', error: error.message });
    }
});

// 獲取個人資料
router.get('/profile/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const users = await getUsers();
        const user = users.find(u => u.id === id);
        if (!user) {
            return res.status(404).json({ message: '用戶不存在' });
        }
        res.json({
            id: user.id,
            level: parseInt(user.level) || 1,
            xp: parseInt(user.xp) || 0,
            name: user.name,
            role: user.role,
            gender: user.gender || 'male',
            bp: user.bp || '',
            height: user.height || '',
            weight: user.weight || '',
            birthday: user.birthday || ''
        });
    } catch (error) {
        res.status(500).json({ message: '讀取失敗', error: error.message });
    }
});

// 更新用戶資料 (等級、XP) - 這是核心同步端口
router.post('/update-profile', async (req, res) => {
    const { id, level, xp } = req.body;
    try {
        const users = await getUsers();
        const userIndex = users.findIndex(u => u.id === id);
        
        if (userIndex === -1) {
            return res.status(404).json({ message: '用戶不存在' });
        }
        
        // 強制轉型為數字，避免資料類型錯誤
        if (level !== undefined) users[userIndex].level = parseInt(level);
        if (xp !== undefined) users[userIndex].xp = parseInt(xp);
        
        await fs.writeJson(USERS_FILE, users, { spaces: 2 });
        
        res.json({ 
            success: true, 
            level: users[userIndex].level, 
            xp: users[userIndex].xp 
        });
    } catch (error) {
        res.status(500).json({ message: '更新失敗', error: error.message });
    }
});

module.exports = router;