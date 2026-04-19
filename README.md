# HealScape 癒見 - 臨床級 AI 復健監測系統

## 專案概覽
- **隊伍名稱**：台北普龍宮
- **作品名稱**：HealScape 癒見 - 臨床級 AI 復健監測系統
- **主題領域**：醫療資訊、AI 運動健康、遠距復健監測
- **使用者角色**：
  - **病人 (Patient)**：執行復健運動（如 ROM 關節活動度、握力測試），即時查看 AI 監測數據。
  - **治療師 (Therapist)**：監控病患復健進度、查看歷史數據、發布遠距指令。
  - **管理員 (Admin)**：管理系統帳號、維護系統運作。

## 核心 FHIR Resources
本系統嚴格遵循 HL7 FHIR 標準進行資料交換與儲存：
- **Patient**：病患基本資料管理與 HAPI FHIR Server 同步。
- **Observation**：儲存復健監測數據，包含：
  - `Range of Motion (ROM)`：關節活動度數據。
  - `Grip Strength`：握力測試數據。
  - `Blood Pressure`：血壓健康指標。
- **Practitioner**：治療師與醫療人員資訊。

## Demo 入口
- **展示影片**：(後續提供連結)
- **測試帳密**：(請參閱系統預設或自行註冊)

## 如何執行
本專案包含後端伺服器與前端展示介面。

### 1. 環境需求
- Node.js (v16+)
- npm 或 yarn
- ngrok (用於外網穿透，非必備但建議)

### 2. 啟動步驟
1. **執行啟動腳本**：
   在專案根目錄下，點擊運行：
   ```bash
   START_SERVER.bat
   ```
   此腳本會自動啟動以下服務：
   - **Backend Server**：於 `http://localhost:3000` 運行。
   - **ngrok Tunnel**：產生一個可供外部訪問的 https 網址（若有安裝 ngrok）。

2. **配置 API 連結**：
   啟動後，請查看 ngrok 視窗中的 `Forwarding` 網址（例如 `https://xxxx.ngrok-free.app`），並將其填入 `js/api.js` 中的 `API_BASE` 變數。

3. **開啟前端介面**：
   伺服器啟動後，直接於瀏覽器打開 `index.html` 即可開始使用。

### 3. 技術架構
- **前端**：Vanilla JS, CSS3, HTML5 (AI 監測模組)。
- **後端**：Node.js Express 伺服器。
- **資料儲存**：Local JSON Ledger (區塊鏈模擬) + HAPI FHIR Server (標準醫療資料)。
- **整合**：透過 FHIR API 實現與國際醫療標準接軌。

---
*本作品由 台北普龍宮 團隊開發，致力於提供高品質的數位醫療復健方案。*
