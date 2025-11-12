// URL API Gateway Anda
const API_URL = 'http://localhost:3000/api';

// Ambil token dan user dari localStorage
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));

const courseListEl = document.getElementById('courseList');
const myEnrollmentListEl = document.getElementById('myEnrollmentList');
const userInfoEl = document.getElementById('userInfo');
const messageEl = document.getElementById('message');

// --- 1. Verifikasi Login ---
if (!token || !user) {
    // Jika tidak ada token, paksa kembali ke login
    window.location.href = 'login.html';
} else {
    // Tampilkan info user
    userInfoEl.innerHTML = `Login sebagai: <strong>${user.email}</strong> (Role: ${user.role}) <button id="logoutBtn">Logout</button>`;
    
    // Tambahkan fungsi ke tombol logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    });
}

// --- Fungsi Helper untuk Fetch API (dengan Token) ---
async function fetchAPI(endpoint, options = {}) {
    const defaultHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` // Tambahkan token JWT
    };

    const config = {
        ...options,
        headers: { ...defaultHeaders, ...options.headers }
    };

    const response = await fetch(`${API_URL}${endpoint}`, config);

    if (response.status === 401 || response.status === 403) {
        // Jika token tidak valid (kadaluarsa/salah), paksa logout
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    }

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Terjadi kesalahan API');
    }
    
    // Cek jika response punya konten (misal DELETE tidak punya)
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
        return response.json();
    } else {
        return response.text(); // Return teks jika bukan JSON
    }
}

// --- 2. Fungsi Utama ---

// Mengambil dan menampilkan semua kursus
async function loadCourses() {
    try {
        const courses = await fetchAPI('/courses'); // Panggil Course Service
        courseListEl.innerHTML = ''; // Kosongkan list
        
        courses.forEach(course => {
            const li = document.createElement('li');
            
            // ===================================
            // == [INI PERBAIKANNYA] JUDUL MENJADI LINK ==
            // ===================================
            li.innerHTML = `
                <a href="course-detail.html?id=${course.id}" style="text-decoration: none; color: #0056b3; font-weight: bold;">
                    ${course.title} (ID: ${course.id})
                </a>
                <button class="enroll-btn" data-course-id="${course.id}">Daftar</button>
            `;
            courseListEl.appendChild(li);
        });
    } catch (error) {
        courseListEl.innerHTML = `<li>Gagal memuat kursus: ${error.message}</li>`;
    }
}

// Mengambil dan menampilkan kursus yang sudah diambil
async function loadMyEnrollments() {
    try {
        const enrollments = await fetchAPI('/enrollments/my-enrollments'); // Panggil Enrollment Service
        myEnrollmentListEl.innerHTML = ''; // Kosongkan list

        if (enrollments.length === 0) {
            myEnrollmentListEl.innerHTML = '<li>Belum mendaftar kursus apapun.</li>';
            return;
        }

        // Kita butuh data judul kursus, jadi kita panggil /api/courses
        const allCourses = await fetchAPI('/courses');
        const courseMap = new Map(allCourses.map(course => [course.id, course.title]));

        enrollments.forEach(enroll => {
            const li = document.createElement('li');
            const courseTitle = courseMap.get(enroll.course_id) || 'Kursus Tidak Ditemukan';
            
            // ===================================
            // == [INI PERBAIKANNYA] JUDUL MENJADI LINK ==
            // ===================================
            li.innerHTML = `
                <a href="course-detail.html?id=${enroll.course_id}" style="text-decoration: none; color: #0056b3;">
                    <strong>${courseTitle}</strong> (Status: ${enroll.status})
                </a>
            `;
            myEnrollmentListEl.appendChild(li);
        });
    } catch (error) {
        myEnrollmentListEl.innerHTML = `<li>Gagal memuat kursus saya: ${error.message}</li>`;
    }
}

// Mendaftarkan user ke kursus
async function enrollCourse(courseId) {
    try {
        messageEl.textContent = 'Mendaftarkan...';
        messageEl.style.color = 'blue';

        // Panggil Enrollment Service (POST)
        const result = await fetchAPI(`/enrollments/${courseId}`, { method: 'POST' });
        
        messageEl.textContent = "Berhasil mendaftar! Memuat ulang kursus saya...";
        messageEl.style.color = 'green';

        // Muat ulang data
        loadMyEnrollments();
    } catch (error) {
        messageEl.textContent = `Gagal mendaftar: ${error.message}`;
        messageEl.style.color = 'red';
    }
}

// --- 3. Event Listener untuk tombol "Daftar" ---
courseListEl.addEventListener('click', (e) => {
    if (e.target.classList.contains('enroll-btn')) {
        const courseId = e.target.getAttribute('data-course-id');
        if (confirm(`Anda yakin ingin mendaftar di kursus ID: ${courseId}?`)) {
            enrollCourse(courseId);
        }
    }
});

// --- 4. Muat data saat halaman dibuka ---
loadCourses();
loadMyEnrollments();