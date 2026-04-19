// 根據環境自動切換 API 網址
// 本地測試請確保已執行 START_SERVER.bat (Port 3000)
// 若使用 ngrok，請將 'http://localhost:3000/api' 改為 ngrok 產生的 https 網址
const API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') 
  ? 'http://localhost:3000/api' 
  : 'https://WlsETD.github.io/api'; // 線上環境預設，需搭配後端部署網址

const api = {
  /**
   * 基礎呼叫封裝
   */
  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const token = sessionStorage.getItem('token');
    
    const defaultHeaders = {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };
    if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers: { ...defaultHeaders, ...options.headers }
      });

      const contentType = response.headers.get('content-type');
      
      if (!response.ok) {
        // 如果伺服器沒開 (404/405/500)，但在展示環境，我們啟動模擬數據
        if (location.hostname.includes('github.io')) {
          console.warn(`[Demo Mode] 伺服器未連線，改用模擬數據回應 ${endpoint}`);
          return this.getMockResponse(endpoint, options);
        }
        throw new Error(`伺服器回應錯誤 (${response.status})`);
      }

      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      return null;
    } catch (error) {
      // 網路斷線或無法連線時也回退到模擬數據
      if (location.hostname.includes('github.io') || location.hostname === '') {
        console.warn(`[Demo Mode] 無法連線至伺服器，改用模擬數據: ${error.message}`);
        return this.getMockResponse(endpoint, options);
      }
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  },

  /**
   * 展示模式用的模擬數據 (Mock Data)
   */
  getMockResponse(endpoint, options) {
    if (endpoint.includes('/auth/login')) {
      return { success: true, token: 'mock-token', user: { id: 'P001', name: '測試者', role: 'patient' } };
    }
    if (endpoint.includes('/fhir/history')) {
      return { success: true, history: [
        { date: '2024-04-18', type: 'rom', value: 85, unit: 'deg' },
        { date: '2024-04-17', type: 'grip', value: 42, unit: 'kg' },
        { date: '2024-04-16', type: 'rom', value: 80, unit: 'deg' }
      ]};
    }
    if (endpoint.includes('/blockchain/balance')) {
      return { success: true, balance: 1250 };
    }
    if (endpoint.includes('/auth/patients')) {
      return [
        { id: 'P001', name: '王小明', condition: '中風復健', progress: 75 },
        { id: 'P002', name: '李大華', condition: '骨折後復健', progress: 40 }
      ];
    }
    return { success: true, message: '模擬操作成功' };
  },

  /**
   * FHIR: 同步病患資料 (登入後調用一次)
   */
  async syncPatient(id, name) {
    return this.request('/fhir/patient/sync', {
        method: 'POST',
        body: JSON.stringify({ id, name })
    });
  },

  /**
   * FHIR: 獲取病患歷史數據 (從 HAPI FHIR Server 讀取)
   */
  async getPatientData(id, fhirPatientId) {
    try {
      const res = await this.request(`/fhir/history/${id}${fhirPatientId ? `?fhirPatientId=${fhirPatientId}` : ''}`);
      return {
          id: id,
          history: (res.history || []).map(h => ({
              date: h.date,
              rom: h.type === 'rom' ? h.value : 0,
              grip: h.type === 'grip' ? h.value : 0,
              value: h.value,
              type: h.type,
              adherence: 100
          }))
      };
    } catch (e) {
      console.warn("FHIR history fetch failed", e);
      return { id: id, history: [] };
    }
  },

  /**
   * FHIR: 上傳復健數據 (傳送到後端再轉發至 HAPI FHIR)
   */
  async uploadSession(data) {
    return this.request('/fhir/upload', {
      method: 'POST',
      body: JSON.stringify({
          patientId: data.patientId,
          type: data.task === 'arm' ? 'rom' : 'grip',
          value: data.task === 'arm' ? data.rom : data.reps, // 使用傳入的角度或次數
          unit: data.task === 'arm' ? 'deg' : 'kg',
          fhirPatientId: sessionStorage.getItem('fhirPatientId')
      })
    });
  },

  /**
   * WEB3: 獲取醫師處方簽
   */
  async getPrescriptions(patientId) {
      return this.request(`/blockchain/prescriptions/${patientId}`);
  },

  /**
   * WEB3: 發布處方簽 (醫師使用)
   */
  async createPrescription(data) {
    return this.request('/blockchain/prescribe', {
        method: 'POST',
        body: JSON.stringify(data)
    });
  },

  /**
   * WEB3: 獲取所有病患列表 (醫師使用)
   */
  async getPatients() {
      return this.request('/auth/patients');
  },

  /**
   * WEB3: 獲取帳本紀錄
   */
  async getLedger(patientId) {
      return this.request(`/blockchain/ledger/${patientId}`);
  },

  /**
   * WEB3: 提交 PoPW (Proof of Physical Work)
   * 模擬 ZK 驗證並於後端計算獎勵與存證
   */
  async submitPoPW(data) {
    return this.request('/blockchain/submit-popw', {
        method: 'POST',
        body: JSON.stringify(data)
    });
  },

  /**
   * WEB3: 獲取 $HEAL 餘額 (從後端 JSON DB 讀取)
   */
  async getHEALBalance(id) {
    const res = await this.request(`/blockchain/balance/${id}`);
    return res.balance;
  },

  /**
   * WEB3: 銷毀 $HEAL (兌換折扣)
   */
  async burnHEAL(data) {
    return this.request('/blockchain/burn', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  /**
   * WEB3: 獲取 Soulbound Tokens (SBTs)
   */
  async getSoulboundTokens(id) {
    return this.request(`/blockchain/sbts/${id}`);
  },

  /**
   * 獲取用戶資料 (等級、XP)
   */
  async getProfile(id) {
    // 雖然伺服器目前沒有單獨的 getProfile endpoint，但我們可以復用 getPatients 並過濾，
    // 或是我們在 auth.js 中新增一個接口。為了簡單，我們先用 id 作為查詢參數。
    // 這裡我們直接修改後端讓它支持 getProfile 會更穩健。
    return this.request(`/auth/profile/${id}`);
  },

  /**
   * 更新用戶資料 (等級、XP)
   */
  async updateProfile(id, level, xp) {
    return this.request('/auth/update-profile', {
      method: 'POST',
      body: JSON.stringify({ id, level, xp })
    });
  },

  /**
   * 管理員: 獲取所有用戶及其餘額
   */
  async adminGetUsers() {
    return this.request('/admin/users');
  },

  /**
   * 管理員: 新增用戶
   */
  async adminAddUser(data) {
    return this.request('/admin/add-user', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  /**
   * 管理員: 更新用戶資料 (姓名、帳號)
   */
  async adminUpdateUser(data) {
    return this.request('/admin/update-user', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  /**
   * 管理員: 修改用戶密碼
   */
  async adminChangePassword(id, password) {
    return this.request('/admin/change-password', {
      method: 'POST',
      body: JSON.stringify({ id, password })
    });
  },

  /**
   * 管理員: 獲取系統日誌
   */
  async adminGetLogs() {
    return this.request('/admin/logs');
  }
};

window.healscapeApi = api;
