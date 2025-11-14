// SOLUSSI:
// API_URL, token, dan user sudah dimuat dari utils.js

// --- 1. Ambil ID Kursus & Verifikasi ---
const hash = window.location.hash.substring(1);
const urlParams = new URLSearchParams(hash);
const courseId = urlParams.get('id');

const messageEl = document.getElementById('message');

if (!token || !user) {
    window.location.href = 'login.html';
} else if (!courseId) {
    alert('ID Kursus tidak ditemukan!');
    window.location.href = 'instructor-dashboard.html';
} else {
    // Setup Info User
    const userInfoEl = document.getElementById('userInfo');
    userInfoEl.innerHTML = `Login sebagai: <strong>${user.email}</strong> <button id="logoutBtn" class="btn btn-sm btn-danger ms-2">Logout</button>`;
    
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    });

    // Setup link "Kembali"
    document.getElementById('back-link').href = `course-detail.html#id=${courseId}`;
}

// --- 2. Fungsi Fetch API ---
// SOLUSI: Dihapus. Sekarang menggunakan fetchAPI() dari utils.js

// --- 3. Fungsi Set Message ---
// SOLUSI: Dihapus. Sekarang menggunakan setMessage() dari utils.js

// --- 4. Logika untuk Submit Form ---
const form = document.getElementById('create-module-form');
const submitButton = document.getElementById('submit-button');

const titleEl = document.getElementById('title');
const moduleOrderEl = document.getElementById('module_order');

form.addEventListener('submit', async (e) => {
    e.preventDefault(); 
    
    submitButton.disabled = true;
    submitButton.textContent = 'Membuat...';
    setMessage(''); // Hapus pesan sebelumnya (dari utils.js)

    // Ambil nilai dan pastikan module_order adalah angka
    const moduleOrder = parseInt(moduleOrderEl.value);
    if (isNaN(moduleOrder) || moduleOrder <= 0) {
        setMessage('Nomor urut modul harus angka positif yang valid.', 'danger');
        submitButton.disabled = false;
        submitButton.textContent = 'Buat Modul';
        return;
    }

    // Susun payload
    const payload = {
        title: titleEl.value,
        module_order: moduleOrder
    };
    
    try {
        // Panggil endpoint (menggunakan fetchAPI dari utils.js)
        await fetchAPI(`/courses/${courseId}/modules`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        setMessage('Modul berhasil dibuat! Memuat ulang halaman detail...', 'success');
        
        setTimeout(() => {
            window.location.href = `course-detail.html#id=${courseId}`;
        }, 2000);

    } catch (error) {
        setMessage(`Gagal membuat modul: ${error.message}`, 'danger');
        submitButton.disabled = false;
        submitButton.textContent = 'Buat Modul';
    }
});