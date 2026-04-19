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
        let errorMessage = `API Error ${response.status}`;
        if (contentType && contentType.includes('application/json')) {
          try {
            const errData = await response.json();
            errorMessage = errData.message || errorMessage;
          } catch(e) { /* ignore parse error */ }
        } else {
          errorMessage = `伺服器回應錯誤 (${response.status})，路徑可能不存在。`;
        }
        throw new Error(errorMessage);
      }

      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
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
