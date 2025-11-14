// Menempatkan konstanta API di atas agar mudah diubah
const API_URL = 'http://localhost:3000/api';

// --- PERBAIKAN BUG Kritis ---
// Logika ini berjalan *sebelum* DOM dimuat untuk mengecek sesi.
const token = localStorage.getItem('token');
const userString = localStorage.getItem('user');

if (token && userString) {
    try {
        // SOLUSI: 
        // Bug sebelumnya adalah mencoba mengakses 'data.user.role' 
        // padahal 'data' tidak ada.
        // Solusinya adalah membaca 'user' dari localStorage.
        const user = JSON.parse(userString);
        
        let destination = 'dashboard.html'; // Default untuk student

        if (user.role === 'instructor') {
            destination = 'instructor-dashboard.html';
        }
        
        window.location.href = destination; 

    } catch (e) {
        // Jika data 'user' di localStorage rusak, hapus sisa token
        console.error("Gagal parse data user:", e);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }
}

// --- Logika Login Form ---
// Menunggu DOM siap sebelum menambahkan event listener
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    
    // Pastikan form ada sebelum menambahkan listener
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const messageDiv = document.getElementById('message');
            
            // Bersihkan pesan error sebelumnya
            messageDiv.textContent = '';

            try {
                const response = await fetch(`${API_URL}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();

                if (response.ok) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));

                    let destination = 'dashboard.html'; 
                    if (data.user.role === 'instructor') {
                        destination = 'instructor-dashboard.html';
                    }
                    window.location.href = destination; 

                } else {
                    messageDiv.textContent = data.error || 'Login gagal';
                }
            } catch (error) {
                console.error('Error saat login:', error);
                messageDiv.textContent = 'Tidak bisa terhubung ke server.';
            }
        });
    }
});