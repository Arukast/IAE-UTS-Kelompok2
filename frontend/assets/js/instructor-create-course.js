// SOLUSI:
// API_URL, token, dan user sudah dimuat dari utils.js
// Kita bisa langsung menggunakannya.

// --- 1. Verifikasi Login & Setup Navigasi ---
const messageEl = document.getElementById('message');

if (!token || !user) {
    window.location.href = 'login.html';
} else if (user.role !== 'instructor') {
    // Tambahan keamanan: pastikan hanya instruktur
    alert('Anda tidak memiliki akses ke halaman ini.');
    window.location.href = 'dashboard.html';
} else {
    // Tampilkan info user
    const userInfoEl = document.getElementById('userInfo');
    userInfoEl.innerHTML = `Login sebagai: <strong>${user.email}</strong> <button id="logoutBtn" class="btn btn-sm btn-danger ms-2">Logout</button>`;
    
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    });
}

// --- 2. Fungsi Helper untuk Fetch API ---
// SOLUSI: Dihapus. Sekarang menggunakan fetchAPI() dari utils.js

// --- 3. Fungsi Helper untuk Pesan ---
// SOLUSI: Dihapus. Sekarang menggunakan setMessage() dari utils.js

// --- 4. Logika untuk Submit Form ---
const form = document.getElementById('create-course-form');
const submitButton = document.getElementById('submit-button');

form.addEventListener('submit', async (e) => {
    e.preventDefault(); 
    
    submitButton.disabled = true;
    submitButton.textContent = 'Memproses...';
    // Gunakan setMessage dari utils.js
    setMessage('', 'info'); // Hapus pesan sebelumnya

    if (!user || !user.id) {
        setMessage('Sesi Anda tidak valid atau ID user tidak ditemukan. Silakan login kembali.', 'danger');
        submitButton.disabled = false;
        submitButton.textContent = 'Buat Kursus';
        return; 
    }

    const title = document.getElementById('title').value;
    const description = document.getElementById('description').value;
    const thumbnailUrl = document.getElementById('thumbnail_url').value;
    const category = document.getElementById('category').value;

    const payload = {
        title: title,
        description: description,
        instructor_id: user.id, // Diambil dari 'user' global (utils.js)
        category: category ? category : null 
    };

    if (thumbnailUrl) {
        payload.thumbnail_url = thumbnailUrl;
    }
    
    try {
        // Gunakan fetchAPI dari utils.js
        const newCourse = await fetchAPI('/courses', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        setMessage('Kursus berhasil dibuat! Mengalihkan ke halaman detail...', 'success');
        form.reset();
        
        setTimeout(() => {
            window.location.href = `course-detail.html#id=${newCourse.id}`;
        }, 2000);

    } catch (error) {
        setMessage(`Gagal membuat kursus: ${error.message}`, 'danger');
        submitButton.disabled = false;
        submitButton.textContent = 'Buat Kursus';
    }
});