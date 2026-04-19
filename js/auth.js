const auth = {
  /**
   * 登入處理
   */
  async login(email, password) {
    try {
      // 使用 healscapeApi.request 才能享受到我們在 api.js 寫好的 Mock 回退邏輯
      const data = await window.healscapeApi.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      if (!data || !data.token) {
        throw new Error('登入失敗，請檢查帳號密碼');
      }
      
      // 儲存狀態
      sessionStorage.setItem('token', data.token);
      sessionStorage.setItem('userId', data.user.id);
      sessionStorage.setItem('userRole', data.user.role);
      sessionStorage.setItem('userName', data.user.name);
      
      // 儲存等級與經驗值
      sessionStorage.setItem('patientLevel', data.user.level || 1);
      sessionStorage.setItem('patientXP', data.user.xp || 0);
      
      return data;
    } catch (error) {
      console.error('Auth Error:', error);
      throw error;
    }
  },

  /**
   * 權限檢查
   */
  checkAuth(requiredRole) {
    const userId = sessionStorage.getItem('userId');
    const role = sessionStorage.getItem('userRole');
    
    if (!userId || (requiredRole && role !== requiredRole)) {
      window.location.href = 'index.html';
      return false;
    }
    return true;
  },

  /**
   * 登出
   */
  logout() {
    sessionStorage.clear();
    window.location.href = 'index.html';
  }
};

window.healscapeAuth = auth;
