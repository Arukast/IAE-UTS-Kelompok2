// Elemen UI (spesifik untuk dashboard)
const courseListEl = document.getElementById('courseList');
const myEnrollmentListEl = document.getElementById('myEnrollmentList');
const userInfoEl = document.getElementById('userInfo');

// --- Fungsi Spesifik Dashboard ---

/**
 * Mengambil dan menampilkan semua kursus.
 * @returns {Promise<Array>} - Array data kursus.
 */
async function loadCourses() {
    if (!courseListEl) return []; // Kembalikan array kosong jika elemen tidak ada
    
    try {
        const courses = await fetchAPI('/courses'); 
        courseListEl.innerHTML = ''; 
        
        if (courses.length === 0) {
            courseListEl.innerHTML = '<p class="text-muted">Belum ada kursus yang tersedia.</p>';
            return []; // Kembalikan array kosong
        }

        courses.forEach(course => {
            const col = document.createElement('div');
            col.className = 'col';

            col.innerHTML = `
                <a href="course-detail.html#id=${course.id}" class="card h-100 course-card text-decoration-none text-dark">
                    <img src="${course.thumbnail_url || 'https://via.placeholder.com/300x200.png?text=Kursus'}" class="card-img-top" alt="${course.title}">
                    <div class="card-body">
                        <h5 class="card-title">${course.title}</h5>
                        <p class="card-text text-muted">${(course.description || '').substring(0, 100)}...</p>
                    </div>
                    <div class="card-footer bg-transparent">
                        <small class="text-muted">${course.category || 'Umum'}</small>
                    </div>
                </a>
            `;
            courseListEl.appendChild(col);
        });
        
        // SOLUSI: Kembalikan data kursus agar bisa digunakan
        // oleh fungsi loadMyEnrollments
        return courses;

    } catch (error) {
        courseListEl.innerHTML = `<div class="col"><div class="alert alert-danger">Gagal memuat kursus: ${error.message}</div></div>`;
        return []; // Kembalikan array kosong jika error
    }
}

/**
 * Mengambil dan menampilkan kursus yang sudah di-enroll.
 * @param {Array} allCourses - Data kursus dari loadCourses.
 */
async function loadMyEnrollments(allCourses) {
    if (!myEnrollmentListEl) return;
    
    try {
        const enrollments = await fetchAPI('/enrollments/my-enrollments'); 
        
        if (enrollments.length === 0) {
            myEnrollmentListEl.innerHTML = '<li class="list-group-item text-muted">Anda belum mendaftar kursus apapun.</li>';
            return;
        }

        // SOLUSI: Gunakan data 'allCourses' yang di-pass, 
        // tidak perlu fetch API lagi.
        const courseMap = new Map(allCourses.map(course => [course.id, course.title]));

        myEnrollmentListEl.innerHTML = '';
        
        enrollments.forEach(enroll => {
            const li = document.createElement('li');
            li.className = 'list-group-item';
            const courseTitle = courseMap.get(enroll.course_id) || `Kursus (ID: ${enroll.course_id})`;
            
            li.innerHTML = `
                <a href="course-detail.html#id=${enroll.course_id}" class="text-decoration-none">
                    ${courseTitle}
                    <span class="badge bg-secondary float-end">${enroll.status}</span>
                </a>
            `;
            myEnrollmentListEl.appendChild(li);
        });
    } catch (error) {
        myEnrollmentListEl.innerHTML = '<li class="list-group-item list-group-item-danger">Gagal memuat kursus Anda.</li>';
    }
}

// --- MAIN LOGIC (Hanya berjalan jika di dashboard) ---
if (userInfoEl) {
    // Cek login (token dan user diambil dari utils.js)
    if (!token || !user) {
        window.location.href = 'login.html';
    } else {
        // Setup Info User & Logout (berasal dari utils.js)
        userInfoEl.innerHTML = `Login sebagai: <strong>${user.email}</strong> <button id="logoutBtn" class="btn btn-sm btn-danger ms-2">Logout</button>`;
        
        document.getElementById('logoutBtn').addEventListener('click', () => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
        });

        // SOLUSI: Panggil fungsi secara berurutan
        // agar data 'courses' bisa di-pass.
        async function initDashboard() {
            try {
                // 1. Muat kursus dan dapatkan datanya
                const courses = await loadCourses();
                // 2. Muat enrollment menggunakan data kursus tadi
                await loadMyEnrollments(courses);
            } catch (err) {
                // setMessage juga dari utils.js
                setMessage(`Gagal memuat dashboard: ${err.message}`, 'danger');
            }
        }

        initDashboard();
    }
}