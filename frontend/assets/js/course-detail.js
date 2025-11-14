// Ambil ID Kursus dari URL
const hash = window.location.hash.substring(1);
const urlParams = new URLSearchParams(hash);
const courseId = urlParams.get('id');

// --- 1. Logika Pengecekan Halaman Utama ---
if (!token || !user) {
    window.location.href = 'login.html';
} else if (!courseId) {
    alert('ID Kursus tidak ditemukan!');
    const dashboardUrl = (user.role === 'instructor') 
        ? 'instructor-dashboard.html' 
        : 'dashboard.html';
    window.location.href = dashboardUrl;
} else {
    // Setup halaman
    const dashboardUrl = (user.role === 'instructor') 
        ? 'instructor-dashboard.html' 
        : 'dashboard.html';
    
    // Setup Info User & Tombol Logout
    const userInfoEl = document.getElementById('userInfo');
    if (userInfoEl) {
        userInfoEl.innerHTML = `Login sebagai: <strong>${user.email}</strong> <button id="logoutBtn" class="btn btn-sm btn-danger ms-2">Logout</button>`;
        document.getElementById('logoutBtn').addEventListener('click', () => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
        });
    }

    // Setup Link Navigasi Brand
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

// --- 4. Fungsi Utama untuk Memuat Halaman ---
async function loadPage() {
    let courseData;
    try {
        courseData = await fetchAPI(`/courses/${courseId}`);
    } catch (error) {
        setMessage(`Gagal memuat kursus: ${error.message}`);
        return;
    }

    if (user && user.role === 'instructor') {
        const fakeProgressData = { completed_lessons: [] };
        showLessonView(courseData, fakeProgressData);
    } else {
        try {
            const progressData = await fetchAPI(`/progress/my-progress/${courseId}`);
            showLessonView(courseData, progressData);
        } catch (error) {
            showEnrollmentView(courseData);
        }
    }
}


// --- 5. Tampilkan View 1 (Pendaftaran) ---
function showEnrollmentView(course) {
    const enrollmentView = document.getElementById('enrollment-view');
    if (!enrollmentView) return;

    const description = course?.description ?? ''; 
    const thumbnailUrl = course?.thumbnail_url ?? 'https://via.placeholder.com/1200x400.png?text=Kursus';
    
    document.getElementById('hero-title').textContent = course.title || 'Judul Kursus';
    document.getElementById('hero-desc').textContent = description.substring(0, 150) + '...';
    document.getElementById('hero-long-desc').textContent = description;
    
    const heroBg = document.getElementById('hero-bg');
    if (heroBg) {
        heroBg.style.backgroundImage = `url(${thumbnailUrl})`;
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
    if (!lessonView) return;

    // Logika Tombol Instruktur
    if (user.role === 'instructor') {
        const editCourseLink = document.getElementById('edit-course-link');
        if (editCourseLink) {
            editCourseLink.href = `instructor-edit-course.html#id=${courseId}`;
            editCourseLink.style.display = 'inline-block';
        }
        const createModuleLink = document.getElementById('create-module-link');
        if (createModuleLink) {
            createModuleLink.href = `instructor-create-module.html#id=${courseId}`;
            createModuleLink.style.display = 'inline-block';
        }
    }
    
    // Set link "Kembali"
    const dashboardUrl = (user.role === 'instructor') 
        ? 'instructor-dashboard.html' 
        : 'dashboard.html';
    document.getElementById('back-to-dashboard-link').href = dashboardUrl;

    // Tampilkan data
    document.getElementById('course-title').textContent = course.title || 'Judul Kursus';
    document.getElementById('course-desc').textContent = course.description || 'Deskripsi tidak tersedia.';
    
    const modulesContainer = document.getElementById('modules-container');
    const modules = course?.Modules ?? []; 
    const completedLessonIds = new Set(
        (progress?.completed_lessons || []).map(lesson => lesson.lesson_id)
    );
    
    //
    // ==========================================================
    // == PERUBAHAN 1: Isi Daftar Modul (Quick Links) di Sidebar ==
    // ==========================================================
    //
    const quickLinksContainer = document.getElementById('module-quick-links');
    if (quickLinksContainer) {
        if (modules.length > 0) {
            quickLinksContainer.innerHTML = ''; // Hapus 'Memuat...'
            modules.forEach(module => {
                const li = document.createElement('li');
                li.className = 'list-group-item';
                // Kita buat link yang mengarah ke ID heading akordion
                li.innerHTML = `
                    <a href="#heading-${module.id}" class="text-decoration-none text-dark d-block">
                        <i class="bi bi-collection me-2 text-primary"></i>
                        ${module.title || 'Modul Tanpa Judul'}
                    </a>`;
                quickLinksContainer.appendChild(li);
            });
        } else {
            quickLinksContainer.innerHTML = '<li class="list-group-item text-muted">Belum ada modul.</li>';
        }
    }
    // ==========================================================
    // == AKHIR PERUBAHAN 1 ==
    // ==========================================================
    

    if (modulesContainer) {
        modulesContainer.innerHTML = ''; 
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
                
                let icon;
                if (isCompleted) icon = 'bi-check-circle-fill text-success';
                else if (lesson.content_type === 'video') icon = 'bi-play-circle-fill';
                else if (lesson.content_type === 'quiz') icon = 'bi-patch-question-fill';
                else icon = 'bi-file-text-fill';
                
                let buttonHtml = `
                    <button class="btn btn-sm ${isCompleted ? 'btn-success' : 'btn-outline-primary'} complete-btn" 
                            data-lesson-id="${lesson.id}" ${isCompleted ? 'disabled' : ''}>
                        <i class="bi ${isCompleted ? 'bi-check' : 'bi-check-lg'}"></i>
                        ${isCompleted ? 'Selesai' : 'Tandai Selesai'}
                    </button>`;
                
                if (isInstructor) buttonHtml = ``; // Instruktur tidak perlu tombol

                return `
                    <li class="list-group-item d-flex justify-content-between align-items-center ${isCompleted ? 'list-group-item-success' : ''}">
                        <span class="d-flex align-items-center">
                            <i class="bi ${icon} lesson-icon me-3"></i>
                            <span class="flex-grow-1">
                                ${lesson.title || 'Materi Tanpa Judul'}
                                <small class="text-muted d-block text-capitalize">(${lesson.content_type || 'N/A'})</small>
                            </span>
                        </span>
                        ${buttonHtml}
                    </li>
                `;
            }).join('');

            let instructorLinkHtml = '';
            if (user.role === 'instructor') {
                const createLessonUrl = `instructor-create-lesson.html#courseId=${courseId}&moduleId=${module.id}`;
                instructorLinkHtml = `
                    <div class="p-3 border-top bg-light text-center">
                        <a href="${createLessonUrl}" class="btn btn-sm btn-outline-primary w-100">
                            <i class="bi bi-plus-circle me-2"></i> Tambah Materi ke Modul Ini
                        </a>
                    </div>
                `;
            }

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
                    <ul class="list-group list-group-flush lesson-list">
                        ${lessonsHtml.length > 0 ? lessonsHtml : '<li class="list-group-item text-muted">Belum ada materi di modul ini.</li>'}
                    </ul>
                    ${instructorLinkHtml}
                </div>
            </div>
        `;
            modulesContainer.appendChild(accordionItem);
        });
    }

    //
    // ==========================================================
    // == PERUBAHAN 2: Sembunyikan Progres untuk Instruktur ==
    // ==========================================================
    //
    const modulesColumn = document.getElementById('modules-column');
    const progressColumn = document.getElementById('progress-column');
    const progressInfoEl = document.getElementById('progress-info');
    
    if (progressInfoEl && progressColumn && modulesColumn) {
        if (user.role === 'instructor') {
            // Sembunyikan kolom progres
            progressColumn.style.display = 'none';
            // Lebarkan kolom materi
            modulesColumn.className = 'col-lg-12';
        } else {
            // Jika student, pastikan kolom terlihat
            progressColumn.style.display = 'block';
            modulesColumn.className = 'col-lg-8';
            
            // Dan isi datanya
            const totalLessons = modules.reduce((acc, mod) => acc + (mod?.Lessons?.length ?? 0), 0);
            const completedCount = completedLessonIds.size;
            const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

            progressInfoEl.innerHTML = `
                <p class="mb-2">${completedCount} dari ${totalLessons} materi selesai.</p>
                <div class="progress" style="height: 20px;">
                    <div class="progress-bar" role="progressbar" style="width: ${progressPercent}%" 
                         aria-valuenow="${progressPercent}" aria-valuemin="0" aria-valuemax="100">
                        ${progressPercent}%
                    </div>
                </div>
            `;
        }
    }
    // ==========================================================
    // == AKHIR PERUBAHAN 2 ==
    // ==========================================================

    // Tampilkan view
    lessonView.style.display = 'block';
}

// --- 7. Event Listener untuk Tombol "Selesai" ---
const modulesContainerGlobal = document.getElementById('modules-container');
if (modulesContainerGlobal) {
    modulesContainerGlobal.addEventListener('click', (e) => {
        // Cari tombol terdekat, agar klik ikon di dalam tombol tetap berfungsi
        const button = e.target.closest('.complete-btn');
        if (button && user.role !== 'instructor') {
            const lessonId = parseInt(button.getAttribute('data-lesson-id'));
            markLessonAsComplete(lessonId, button);
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
                course_id: courseId
            })
        });
        
        setMessage('Progres berhasil disimpan! Memuat ulang...', 'success');
        setTimeout(() => window.location.reload(), 1000);

    } catch (error) {
        alert(`Gagal menyimpan progres: ${error.message}`);
        button.textContent = 'Tandai Selesai';
        button.disabled = false;
    }
}