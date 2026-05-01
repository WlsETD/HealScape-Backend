const auth = {
  /**
   * 登入處理
   */
  async login(email, password) {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || '登入失敗');
      }

      const data = await response.json();
      
      // 儲存狀態
      sessionStorage.setItem('token', data.token);
      sessionStorage.setItem('userId', data.user.id);
      sessionStorage.setItem('userRole', data.user.role);
      sessionStorage.setItem('userName', data.user.name);
      
      // 儲存等級與經驗值，確保重新整理或跳轉後不遺失
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
