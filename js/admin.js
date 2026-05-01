document.addEventListener('DOMContentLoaded', () => {
    if (!healscapeAuth.checkAuth('admin')) return;
    loadData();
});

let USERS = [];
let currentTab = 'user';

async function loadData() {
    try {
        const list = document.getElementById('userList');
        const oldScroll = list.scrollTop;

        USERS = await healscapeApi.adminGetUsers();
        
        document.getElementById('statUsers').innerText = USERS.length;
        document.getElementById('statDoctors').innerText = USERS.filter(u => u.role === 'therapist' || u.role === 'admin').length;

        list.innerHTML = USERS.map(u => {
            const roleColor = u.role === 'admin' ? 'bg-amber-50 text-amber-600' : (u.role === 'therapist' ? 'bg-purple-50 text-purple-600' : 'bg-teal-50 text-teal-600');
            const roleName = u.role === 'admin' ? '管理員' : (u.role === 'therapist' ? '醫師' : '病患');
            const genderIcon = u.gender === 'female' ? '<i class="fas fa-venus text-pink-400 ml-1"></i>' : '<i class="fas fa-mars text-blue-400 ml-1"></i>';
            
            return `
                <div class="bg-white p-5 rounded-[24px] shadow-sm border border-slate-50 flex items-center justify-between active:scale-[0.98] transition-all" onclick="openEdit('${u.id}')">
                    <div class="flex items-center space-x-4 flex-1">
                        <div class="w-12 h-12 rounded-2xl ${roleColor} flex items-center justify-center text-lg font-black shadow-inner italic">${u.name.charAt(0)}</div>
                        <div>
                            <div class="text-sm font-black text-slate-800">${u.name}${genderIcon}</div>
                            <div class="text-[10px] text-slate-400 font-bold tracking-tight">${u.email}</div>
                            <div class="flex items-center mt-2 space-x-2">
                                <span class="px-2 py-0.5 rounded-md ${roleColor} text-[8px] font-black uppercase tracking-tighter">${roleName}</span>
                                <span class="text-[9px] font-black text-teal-600 bg-teal-50 px-2 py-0.5 rounded-md"><i class="fas fa-coins mr-1"></i>${u.balance || 0}</span>
                            </div>
                        </div>
                    </div>
                    <div class="text-slate-300 text-xs">
                        <i class="fas fa-chevron-right"></i>
                    </div>
                </div>
            `;
        }).join('') || '<div class="text-center py-20 text-slate-400 font-bold text-xs">尚無用戶資料</div>';

        list.scrollTop = oldScroll;
    } catch (e) { console.error(e); }
}

function switchTab(tab) {
    currentTab = tab;
    document.getElementById('userView').classList.toggle('hidden', tab !== 'user');
    document.getElementById('logView').classList.toggle('hidden', tab !== 'log');
    document.getElementById('fabAdd').classList.toggle('hidden', tab !== 'user');
    
    const btnUser = document.getElementById('btnUser');
    const btnLog = document.getElementById('btnLog');
    
    if (tab === 'user') {
        btnUser.classList.replace('text-slate-400', 'text-teal-600');
        btnUser.querySelector('svg').setAttribute('fill', 'currentColor');
        btnLog.classList.replace('text-teal-600', 'text-slate-400');
        btnLog.querySelector('svg').setAttribute('fill', 'none');
    } else {
        btnLog.classList.replace('text-slate-400', 'text-teal-600');
        btnLog.querySelector('svg').setAttribute('fill', 'currentColor');
        btnUser.classList.replace('text-teal-600', 'text-slate-400');
        btnUser.querySelector('svg').setAttribute('fill', 'none');
        loadLogs();
    }
}

async function loadLogs() {
    const box = document.getElementById('logBox');
    try {
        const logs = await healscapeApi.adminGetLogs();
        box.innerHTML = logs.map(l => {
            const time = new Date(l.timestamp).toLocaleTimeString();
            return `<div class="mb-1.5 opacity-90"><span class="text-slate-500 font-bold">[${time}]</span> <span class="text-white px-1 rounded bg-teal-900/50">${l.type}</span> ${l.message}</div>`;
        }).join('') || '尚無紀錄';
        box.scrollTop = box.scrollHeight;
    } catch (e) { box.innerHTML = '讀取失敗'; }
}

// 定時刷新數據
setInterval(() => {
    if (currentTab === 'user' && !document.getElementById('modalOverlay').classList.contains('active')) {
        loadData();
    }
}, 10000);

// Modal 邏輯
function openAddModal() {
    document.getElementById('inAddEmail').value = '';
    document.getElementById('inAddPass').value = '';
    document.getElementById('inAddName').value = '';
    document.getElementById('inAddBirthday').value = '';
    document.getElementById('inAddHeight').value = '';
    document.getElementById('inAddWeight').value = '';
    showModal('addModal');
}

function openEdit(id) {
    const u = USERS.find(x => x.id === id);
    if (!u) return;

    document.getElementById('inEditId').value = u.id;
    document.getElementById('inEditName').value = u.name;
    document.getElementById('inEditEmail').value = u.email;
    document.getElementById('inEditGender').value = u.gender || 'male';
    document.getElementById('editUserBalance').innerHTML = `<i class="fas fa-coins mr-1"></i>Balance: ${u.balance || 0} $HEAL`;
    document.getElementById('inEditPass').value = '';

    // 角色特定欄位
    const divExp = document.getElementById('divExp');
    const divPatientExtra = document.getElementById('divPatientExtra');
    
    if (u.role === 'therapist') {
        divExp.classList.remove('hidden');
        divPatientExtra.classList.add('hidden');
        document.getElementById('inEditExp').value = u.experience || '';
    } else if (u.role === 'patient') {
        divExp.classList.add('hidden');
        divPatientExtra.classList.remove('hidden');
        document.getElementById('inEditBirthday').value = u.birthday || '';
        document.getElementById('inEditHeight').value = u.height || '';
        document.getElementById('inEditWeight').value = u.weight || '';
        document.getElementById('inEditBp').value = u.bp || '';
    } else {
        divExp.classList.add('hidden');
        divPatientExtra.classList.add('hidden');
    }
    
    showModal('editModal');
}

async function submitAdd() {
    const data = {
        email: document.getElementById('inAddEmail').value,
        password: document.getElementById('inAddPass').value || '1234',
        role: document.getElementById('inAddRole').value,
        gender: document.getElementById('inAddGender').value,
        name: document.getElementById('inAddName').value || '新用戶',
        birthday: document.getElementById('inAddBirthday').value,
        height: document.getElementById('inAddHeight').value,
        weight: document.getElementById('inAddWeight').value
    };
    if (!data.email) return alert('帳號為必填項');
    
    try {
        const res = await healscapeApi.adminAddUser(data);
        if (res.success) { 
            closeModals(); 
            loadData(); 
        }
    } catch (e) { alert(e.message); }
}

async function submitEdit() {
    const u = USERS.find(x => x.id === document.getElementById('inEditId').value);
    const data = {
        id: document.getElementById('inEditId').value,
        name: document.getElementById('inEditName').value,
        email: document.getElementById('inEditEmail').value,
        gender: document.getElementById('inEditGender').value
    };

    if (u.role === 'therapist') {
        data.experience = document.getElementById('inEditExp').value;
    } else if (u.role === 'patient') {
        data.birthday = document.getElementById('inEditBirthday').value;
        data.height = document.getElementById('inEditHeight').value;
        data.weight = document.getElementById('inEditWeight').value;
        data.bp = document.getElementById('inEditBp').value;
    }
    
    try {
        const res = await healscapeApi.adminUpdateUser(data);
        if (res.success) { 
            closeModals(); 
            loadData(); 
        }
    } catch (e) { alert(e.message); }
}

async function submitEditPass() {
    const id = document.getElementById('inEditId').value;
    const pass = document.getElementById('inEditPass').value;
    if (!pass) return alert('請輸入新密碼');
    
    try {
        const res = await healscapeApi.adminChangePassword(id, pass);
        if (res.success) {
            alert('密碼已更新');
            document.getElementById('inEditPass').value = '';
        }
    } catch (e) { alert(e.message); }
}

function showModal(id) {
    const overlay = document.getElementById('modalOverlay');
    overlay.classList.add('active');
    ['addModal', 'editModal'].forEach(mId => {
        document.getElementById(mId).classList.toggle('hidden', mId !== id);
    });
}

function closeModals() {
    document.getElementById('modalOverlay').classList.remove('active');
    setTimeout(() => {
        ['addModal', 'editModal'].forEach(id => document.getElementById(id).classList.add('hidden'));
    }, 300);
}
