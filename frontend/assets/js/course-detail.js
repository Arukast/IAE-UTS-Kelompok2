// SOLUSI:
// Konstanta API_URL, token, dan user sudah didapat dari utils.js
// Kita hanya perlu mendefinisikan konstanta spesifik halaman ini.

// Ambil ID Kursus dari URL
const hash = window.location.hash.substring(1);
const urlParams = new URLSearchParams(hash);
const courseId = urlParams.get('id');

// --- 1. Logika Pengecekan Halaman Utama ---
if (!token || !user) {
    // 1. Jika tidak login, paksa ke login
    window.location.href = 'login.html';

} else if (!courseId) {
    // 2. Jika login TAPI tidak ada ID kursus, arahkan ke dashboard yang benar
    alert('ID Kursus tidak ditemukan!');
    const dashboardUrl = (user.role === 'instructor') 
        ? 'instructor-dashboard.html' 
        : 'dashboard.html';
    window.location.href = dashboardUrl;

} else {
    // 3. (Kondisi Ideal) Jika login DAN ada ID kursus:
    //    Lanjutkan untuk setup halaman dan memuat data
    
    // Tentukan URL Dashboard berdasarkan role
    const dashboardUrl = (user.role === 'instructor') 
        ? 'instructor-dashboard.html' 
        : 'dashboard.html';

    // Setup Info User & Tombol Logout
    const userInfoEl = document.getElementById('userInfo');
    if (userInfoEl) {
        userInfoEl.innerHTML = `Login sebagai: <strong>${user.email}</strong> <button id="logoutBtn" class="btn btn-sm btn-danger ms-2">Logout</button>`;
        
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = 'login.html';
            });
        }
    }

    // Setup Link Navigasi Brand (di header)
    const navBrandLink = document.getElementById('nav-brand-link');
    if (navBrandLink) {
        navBrandLink.href = dashboardUrl;
        if (user.role === 'instructor') {
            navBrandLink.textContent = 'EduConnect (Instructor)';
        }
    }
    
    // Panggil fungsi untuk memuat data kursus
    loadPage();
}


// --- 2. Fungsi Helper untuk Fetch API ---
// SOLUSI: Dihapus. Sekarang menggunakan fetchAPI() dari utils.js

// --- 3. Fungsi Helper untuk Pesan ---
// SOLUSI: Dihapus. Sekarang menggunakan setMessage() dari utils.js

// --- 4. Fungsi Utama untuk Memuat Halaman ---
async function loadPage() {
    let courseData;
    try {
        // 1. Ambil data kursus (ini umum untuk semua role)
        // (Sekarang memanggil fetchAPI dari utils.js)
        courseData = await fetchAPI(`/courses/${courseId}`);
    } catch (error) {
        // (Sekarang memanggil setMessage dari utils.js)
        setMessage(`Gagal memuat kursus: ${error.message}`);
        return;
    }

    // 2. Cek Role Pengguna
    if (user && user.role === 'instructor') {
        
        // 3a. JIKA INSTRUCTOR:
        // Langsung tampilkan materi. Instruktur tidak memiliki "progres".
        // Kita kirim objek progres palsu/kosong.
        const fakeProgressData = {
            completed_lessons: []
        };
        showLessonView(courseData, fakeProgressData);

    } else {
        
        // 3b. JIKA STUDENT:
        // Gunakan logika try/catch untuk memeriksa progres enrollment.
        try {
            const progressData = await fetchAPI(`/progress/my-progress/${courseId}`);
            // Jika berhasil (sudah terdaftar), tampilkan materi
            showLessonView(courseData, progressData);
        } catch (error) {
            // Jika gagal (error 404/403/belum terdaftar), tampilkan halaman pendaftaran
            showEnrollmentView(courseData);
        }
    }
}


// --- 5. Tampilkan View 1 (Pendaftaran) ---
function showEnrollmentView(course) {
    const enrollmentView = document.getElementById('enrollment-view');
    if (!enrollmentView) {
        console.error("Fatal Error: Element #enrollment-view tidak ditemukan.");
        return;
    }

    // Kode defensif
    const description = course?.description ?? ''; 
    const thumbnailUrl = course?.thumbnail_url ?? 'https://via.placeholder.com/1200x400.png?text=Kursus';
    
    document.getElementById('hero-title').textContent = course.title || 'Judul Kursus';
    document.getElementById('hero-desc').textContent = description.substring(0, 150) + '...';
    document.getElementById('hero-long-desc').textContent = description;
    
    const heroBg = document.getElementById('hero-bg');
    if (heroBg) {
        heroBg.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url(${thumbnailUrl})`;
    }

    enrollmentView.style.display = 'block'; 

    const enrollButton = document.getElementById('enroll-button');
    if (enrollButton) {
        enrollButton.addEventListener('click', async () => {
            enrollButton.textContent = 'Memproses...';
            enrollButton.disabled = true;

            try {
                await fetchAPI(`/enrollments/${courseId}`, { method: 'POST' });
                window.location.reload(); 
            } catch (error) {
                setMessage(`Gagal mendaftar: ${error.message}`);
                enrollButton.textContent = 'Daftar Kursus Ini'; 
                enrollButton.disabled = false;
            }
        });
    }
}

// --- 6. Tampilkan View 2 (Materi) ---
function showLessonView(course, progress) {
    const lessonView = document.getElementById('lesson-view');
    if (!lessonView) {
        console.error("Fatal Error: Element #lesson-view tidak ditemukan.");
        return;
    }

    // ... (Sisa fungsi ini sama persis, tidak perlu diubah) ...
    // ===================================
    // == LOGIKA TOMBOL (BAGIAN 1) ==
    // ===================================
    if (user.role === 'instructor') {
        // Tampilkan tombol "Edit Kursus"
        const editCourseLink = document.getElementById('edit-course-link');
        if (editCourseLink) {
            editCourseLink.href = `instructor-edit-course.html#id=${courseId}`;
            editCourseLink.style.display = 'inline-block';
        }

        // Tampilkan tombol "Tambah Modul"
        const createModuleLink = document.getElementById('create-module-link');
        if (createModuleLink) {
            createModuleLink.href = `instructor-create-module.html#id=${courseId}`;
            createModuleLink.style.display = 'inline-block';
        }
    }
    // ===================================
    
    // Set link "Kembali"
    const dashboardUrl = (user.role === 'instructor') 
        ? 'instructor-dashboard.html' 
        : 'dashboard.html';
    const backToDashboardLink = document.getElementById('back-to-dashboard-link');
    if (backToDashboardLink) {
        backToDashboardLink.href = dashboardUrl;
    }

    // Tampilkan data (dengan cek null)
    document.getElementById('course-title').textContent = course.title || 'Judul Kursus';
    document.getElementById('course-desc').textContent = course.description || 'Deskripsi tidak tersedia.';
    
    const modulesContainer = document.getElementById('modules-container');
    
    // Kode defensif (memastikan 'modules' adalah array)
    const modules = course?.Modules ?? []; 
    const completedLessonIds = new Set(
        (progress?.completed_lessons || []).map(lesson => lesson.lesson_id)
    );

    if (modulesContainer) {
        modulesContainer.innerHTML = ''; // Hapus pemuat
        if (modules.length === 0) {
            modulesContainer.innerHTML = '<p class="text-muted">Materi untuk kursus ini belum tersedia.</p>';
        }

        modules.forEach((module, index) => {
            const accordionItem = document.createElement('div');
            accordionItem.className = 'accordion-item';

            const lessons = module?.Lessons ?? [];
            const moduleTitle = module?.title ?? 'Modul Tanpa Judul';

            const lessonsHtml = lessons.map(lesson => {
                const isCompleted = completedLessonIds.has(lesson.id);
                const isInstructor = (user.role === 'instructor');
                
                let buttonHtml = `
                    <button class="btn btn-sm ${isCompleted ? 'btn-success' : 'btn-outline-primary'} complete-btn" 
                            data-lesson-id="${lesson.id}" 
                            ${isCompleted ? 'disabled' : ''}>
                        ${isCompleted ? 'Selesai' : 'Tandai Selesai'}
                    </button>
                `;
                
                if (isInstructor) {
                    buttonHtml = `<span class="badge bg-secondary">Instructor View</span>`;
                }

                return `
                    <li class="list-group-item d-flex justify-content-between align-items-center ${isCompleted ? 'list-group-item-success' : ''}">
                        <span>
                            ${isCompleted ? '✅' : '📄'} ${lesson.title || 'Materi Tanpa Judul'}
                            <small class="text-muted d-block">(${lesson.content_type || 'N/A'})</small>
                        </span>
                        ${buttonHtml}
                    </li>
                `;
            }).join('');

            // ==========================================================
            // == [ PERBAIKAN: Logika link dipindahkan ke DALAM loop ] ==
            // == Variabel 'module' sekarang valid di sini
            // ==========================================================
            let instructorLinkHtml = '';
            if (user.role === 'instructor') {
                // URL harus berisi courseId dan moduleId
                const createLessonUrl = `instructor-create-lesson.html#courseId=${courseId}&moduleId=${module.id}`;
                instructorLinkHtml = `
                    <div class="p-3 border-top">
                        <a href="${createLessonUrl}" class="btn btn-sm btn-outline-primary w-100">
                            + Tambah Materi ke Modul Ini
                        </a>
                    </div>
                `;
            }
            // ==========================================================

            accordionItem.innerHTML = `
            <h2 class="accordion-header" id="heading-${module.id}">
                <button class="accordion-button ${index > 0 ? 'collapsed' : ''}" type="button" data-bs-toggle="collapse" 
                        data-bs-target="#collapse-${module.id}" aria-expanded="${index === 0 ? 'true' : 'false'}" aria-controls="collapse-${module.id}">
                    <strong>${moduleTitle}</strong>
                </button>
            </h2>
            <div id="collapse-${module.id}" class="accordion-collapse collapse ${index === 0 ? 'show' : ''}" 
                 aria-labelledby="heading-${module.id}" data-bs-parent="#modules-container">
                <div class="accordion-body p-0">
                    <ul class="list-group list-group-flush">
                        ${lessonsHtml.length > 0 ? lessonsHtml : '<li class="list-group-item text-muted">Belum ada materi di modul ini.</li>'}
                    </ul>
                    
                    ${instructorLinkHtml}

                </div>
            </div>
        `;
            modulesContainer.appendChild(accordionItem);
        });
    }

    // Bagian Logika Progress Bar
    const progressInfoEl = document.getElementById('progress-info');
    if (progressInfoEl) {
        if (user.role === 'instructor') {
            progressInfoEl.innerHTML = '<p class="text-muted">Progres tidak dilacak untuk instruktur.</p>';
        } else {
            const totalLessons = modules.reduce((acc, mod) => acc + (mod?.Lessons?.length ?? 0), 0);
            const completedCount = completedLessonIds.size;
            const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

            progressInfoEl.innerHTML = `
                <p>${completedCount} dari ${totalLessons} materi selesai.</p>
                <div class="progress">
                    <div class="progress-bar" role="progressbar" style="width: ${progressPercent}%" 
                         aria-valuenow="${progressPercent}" aria-valuemin="0" aria-valuemax="100">
                        ${progressPercent}%
                    </div>
                </div>
            `;
        }
    }

    // Tampilkan view
    lessonView.style.display = 'block';
}

// --- 7. Event Listener untuk Tombol "Selesai" ---
const modulesContainerGlobal = document.getElementById('modules-container');
if (modulesContainerGlobal) {
    modulesContainerGlobal.addEventListener('click', (e) => {
        // Hanya student yang bisa klik
        if (e.target.classList.contains('complete-btn') && user.role !== 'instructor') {
            const lessonId = parseInt(e.target.getAttribute('data-lesson-id'));
            markLessonAsComplete(lessonId, e.target);
        }
    });
}

async function markLessonAsComplete(lessonId, button) {
    button.textContent = 'Memproses...';
    button.disabled = true;

    try {
        await fetchAPI('/progress/lessons/complete', {
            method: 'POST',
            body: JSON.stringify({
                lesson_id: lessonId,
                course_id: courseId // courseId sudah global
            })
        });
        
        setMessage('Progres berhasil disimpan! Memuat ulang...', 'success');
        setTimeout(() => window.location.reload(), 1000);

    } catch (error) {
        // Gunakan alert() di sini karena setMessage() akan cepat hilang
        // sebelum user membacanya jika halaman di-reload.
        alert(`Gagal menyimpan progres: ${error.message}`);
        button.textContent = 'Tandai Selesai';
        button.disabled = false;
    }
}