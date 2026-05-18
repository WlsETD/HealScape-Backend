const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs-extra');
const os = require('os'); // 新增 os 模組

const app = express();
const PORT = process.env.PORT || 3000;

// 取得區域網路 IP 的函式
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const devName in interfaces) {
        const iface = interfaces[devName];
        for (let i = 0; i < iface.length; i++) {
            const alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                return alias.address;
            }
        }
    }
    return 'localhost';
}

// Routes
const authRoutes = require('./routes/auth');
const fhirRoutes = require('./routes/fhir');
const blockchainRoutes = require('./routes/blockchain');
const adminRoutes = require('./routes/admin');

// Middleware
app.use(cors());
app.use(bodyParser.json());

// 掛載路由
app.use('/api/auth', authRoutes);
app.use('/api/fhir', fhirRoutes);
app.use('/api/blockchain', blockchainRoutes);
app.use('/api/admin', adminRoutes);

// 靜態檔案服務 (將前端網頁與後端結合)
app.use(express.static(path.join(__dirname, '../')));

// 確保數據目錄存在
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

// 基礎測試路由
app.get('/api/health', (req, res) => {
    res.json({ status: 'running', timestamp: new Date() });
});

app.listen(PORT, '0.0.0.0', () => {
    const localIP = getLocalIP();
    console.log(`=========================================`);
    console.log(`HealScape Backend 啟動成功！`);
    console.log(`本機存取: http://localhost:${PORT}`);
    console.log(`手機存取: http://${localIP}:${PORT}`); // 自動顯示手機該連哪個網址
    console.log(`-----------------------------------------`);
    console.log(`測試帳號 病患: 11 / 1234`);
    console.log(`測試帳號 治療師: 22 / 1234`);
    console.log(`=========================================`);
});
