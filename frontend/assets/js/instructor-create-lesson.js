// SOLUSI:
// API_URL, token, dan user sudah dimuat dari utils.js

// --- 1. Ambil ID & Verifikasi ---
const hash = window.location.hash.substring(1);
const urlParams = new URLSearchParams(hash);
const courseId = urlParams.get('courseId');
const moduleId = urlParams.get('moduleId');

const messageEl = document.getElementById('message');

if (!token || !user) {
    window.location.href = 'login.html';
} else if (!courseId || !moduleId) {
    // Verifikasi ini spesifik untuk halaman ini
    alert('ID Kursus atau ID Modul tidak ditemukan!');
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

    // Setup link "Kembali" (hanya butuh courseId)
    document.getElementById('back-link').href = `course-detail.html#id=${courseId}`;
}

// --- 2. Fungsi Fetch API ---
// SOLUSI: Dihapus. Sekarang menggunakan fetchAPI() dari utils.js

// --- 3. Fungsi Set Message ---
// SOLUSI: Dihapus. Sekarang menggunakan setMessage() dari utils.js
// (Catatan: fungsi setMessage di file asli sedikit berbeda,
// kita akan gunakan setMessage global dari utils.js)

// --- 4. Elemen Form & Logika Dinamis ---
const form = document.getElementById('create-lesson-form');
const submitButton = document.getElementById('submit-button');

const titleEl = document.getElementById('title');
const contentTypeEl = document.getElementById('content_type');
const lessonOrderEl = document.getElementById('lesson_order');
const contentLabel = document.getElementById('content-label');
const contentEl = document.getElementById('content_url_or_text');

// Ubah label & placeholder berdasarkan Tipe Konten
contentTypeEl.addEventListener('change', (e) => {
    const type = e.target.value;
    if (type === 'text') {
        contentLabel.textContent = 'Isi Materi Teks';
        contentEl.placeholder = 'Tuliskan materi teks Anda di sini...';
    } else if (type === 'video') {
        contentLabel.textContent = 'URL Video';
        contentEl.placeholder = 'https://www.youtube.com/watch?v=...';
    } else if (type === 'quiz') {
        contentLabel.textContent = 'URL Kuis';
        contentEl.placeholder = 'https://link.ke.kuis/form...';
    }
});

// --- 5. Logika Submit Form ---
form.addEventListener('submit', async (e) => {
    e.preventDefault(); 
    
    submitButton.disabled = true;
    submitButton.textContent = 'Membuat...';
    setMessage(''); // Hapus pesan sebelumnya (dari utils.js)

    // Validasi Nomor Urut
    const lessonOrder = parseInt(lessonOrderEl.value);
    if (isNaN(lessonOrder) || lessonOrder <= 0) {
        setMessage('Nomor urut materi harus angka positif yang valid.', 'danger');
        submitButton.disabled = false;
        submitButton.textContent = 'Buat Materi';
        return;
    }

    // Susun payload sesuai model
    const payload = {
        title: titleEl.value,
        content_type: contentTypeEl.value,
        content_url_or_text: contentEl.value || null,
        lesson_order: lessonOrder
    };
    
    try {
        // Panggil endpoint /modules/:moduleId/lessons
        // (menggunakan fetchAPI dari utils.js)
        await fetchAPI(`/modules/${moduleId}/lessons`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        setMessage('Materi berhasil dibuat! Memuat ulang halaman detail...', 'success');
        
        // Arahkan kembali ke halaman detail kursus
        setTimeout(() => {
            window.location.href = `course-detail.html#id=${courseId}`;
        }, 2000);

    } catch (error) {
        setMessage(`Gagal membuat materi: ${error.message}`, 'danger');
        submitButton.disabled = false;
        submitButton.textContent = 'Buat Materi';
    }
});