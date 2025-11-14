// SOLUSI:
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

    // Muat data kursus yang ada
    loadCourseData();
}

// --- 2. Fungsi Fetch API ---
// SOLUSI: Dihapus. Sekarang menggunakan fetchAPI() dari utils.js

// --- 3. Fungsi Set Message ---
// SOLUSI: Dihapus. Sekarang menggunakan setMessage() dari utils.js

// --- 4. BARU: Fungsi untuk memuat data kursus ke formulir ---
const titleEl = document.getElementById('title');
const descriptionEl = document.getElementById('description');
const thumbnailEl = document.getElementById('thumbnail_url');
const categoryEl = document.getElementById('category');

async function loadCourseData() {
    try {
        // Gunakan setMessage dari utils.js
        setMessage('Memuat data kursus...', 'info');
        // Gunakan fetchAPI dari utils.js
        const course = await fetchAPI(`/courses/${courseId}`);
        
        titleEl.value = course.title;
        descriptionEl.value = course.description;
        thumbnailEl.value = course.thumbnail_url;
        categoryEl.value = course.category;
        
        setMessage('', 'info'); // Hapus pesan 'Memuat...'
    } catch (error) {
        setMessage(`Gagal memuat data: ${error.message}`, 'danger');
    }
}

// --- 5. MODIFIKASI: Logika untuk Submit Form (Update) ---
const form = document.getElementById('edit-course-form');
const submitButton = document.getElementById('submit-button');

form.addEventListener('submit', async (e) => {
    e.preventDefault(); 
    
    submitButton.disabled = true;
    submitButton.textContent = 'Menyimpan...';
    setMessage(''); 

    // Ambil data dari form
    const payload = {
        title: titleEl.value,
        description: descriptionEl.value,
        thumbnail_url: thumbnailEl.value ? thumbnailEl.value : null,
        category: categoryEl.value ? categoryEl.value : null,
        instructor_id: user.id // Diperlukan untuk validasi/konsistensi
    };
    
    try {
        // Kirim sebagai PUT ke endpoint spesifik
        // Gunakan fetchAPI dari utils.js
        await fetchAPI(`/courses/${courseId}`, {
            method: 'PUT', // METODE BERUBAH
            body: JSON.stringify(payload)
        });

        setMessage('Kursus berhasil diperbarui! Mengalihkan kembali...', 'success');
        
        // Arahkan kembali ke halaman detail setelah 2 detik
        setTimeout(() => {
            window.location.href = `course-detail.html#id=${courseId}`;
        }, 2000);

    } catch (error) {
        setMessage(`Gagal memperbarui kursus: ${error.message}`, 'danger');
        submitButton.disabled = false;
        submitButton.textContent = 'Simpan Perubahan';
    }
});