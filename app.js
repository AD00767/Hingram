// --- KHỞI TẠO SUPABASE ---
const supabaseUrl = 'https://erwrncgospxobukdjbdi.supabase.co';
const supabaseKey = 'sb_publishable_sYT6s0OtX5nm9pob5BG0Yg_g5ZJN16K';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = null;
let currentProfile = null;

// --- GIAO DIỆN CHUYỂN ĐỔI ---
function toggleAuthMode(mode) {
    if(mode === 'register') {
        document.getElementById('login-box').classList.add('hidden');
        document.getElementById('register-box').classList.remove('hidden');
    } else {
        document.getElementById('register-box').classList.add('hidden');
        document.getElementById('login-box').classList.remove('hidden');
    }
}

function showHome() {
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('home-section').classList.remove('hidden');
    loadFeed();
}

function openProfile() { document.getElementById('profile-modal').classList.remove('hidden'); loadMyProfile(); }
function closeProfile() { document.getElementById('profile-modal').classList.add('hidden'); }
function openCreatePost() { document.getElementById('create-post-modal').classList.remove('hidden'); }
function closeCreatePost() { document.getElementById('create-post-modal').classList.add('hidden'); document.getElementById('post-editor').innerHTML = ''; }

function toggleTheme() {
    document.body.classList.toggle('dark-mode');
}

// --- XÁC THỰC (AUTH) ---
async function sendOtp() {
    const email = document.getElementById('reg-email').value;
    if(!email) return alert("Vui lòng nhập email");
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) alert("Lỗi: " + error.message);
    else alert("Đã gửi mã xác minh gồm 6 số tới email của bạn.");
}

async function verifyOtpAndRegister() {
    const email = document.getElementById('reg-email').value;
    const otp = document.getElementById('reg-otp').value;
    const pass = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-password-confirm').value;
    const name = document.getElementById('reg-name').value;

    if(pass !== confirm) return alert("Mật khẩu không khớp");
    
    // Supabase xác thực OTP (thường dùng cho đăng nhập không mật khẩu, nhưng ta kết hợp để xác minh email)
    const { data, error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'email' });
    if(error) return alert("Mã không đúng: " + error.message);

    // Cập nhật mật khẩu cho user vừa xác thực
    await supabase.auth.updateUser({ password: pass });
    
    // Lưu profile
    await supabase.from('profiles').insert([{ id: data.user.id, display_name: name }]);
    alert("Đăng ký thành công!");
    checkSession();
}

async function login() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if(error) alert("Sai tài khoản hoặc mật khẩu");
    else checkSession();
}

async function logout() {
    await supabase.auth.signOut();
    location.reload();
}

// Kiểm tra trạng thái đăng nhập khi mở web
async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if(session) {
        currentUser = session.user;
        const { data } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
        currentProfile = data;
        if(currentProfile && currentProfile.avatar_url) {
            document.getElementById('nav-avatar').src = currentProfile.avatar_url;
        }
        showHome();
    }
}

window.onload = checkSession;

// --- TẠO BÀI VIẾT (RICH TEXT) ---
function formatText(command) {
    document.execCommand(command, false, null); // Tính năng soạn thảo cơ bản (In đậm, in nghiêng)
}

async function publishPost() {
    const content = document.getElementById('post-editor').innerHTML;
    const allowComments = document.getElementById('allow-comments').checked;
    // (Phần upload ảnh lên Storage của Supabase có thể thêm logic ở đây nếu người dùng chọn file)
    
    if(!content || content === '<br>') return alert("Nội dung không được để trống");

    const { error } = await supabase.from('posts').insert([{
        user_id: currentUser.id,
        content: content,
        allow_comments: allowComments
    }]);

    if(error) alert("Lỗi đăng bài");
    else {
        closeCreatePost();
        loadFeed(); // Tải lại bảng tin
    }
}

// --- TẢI BẢNG TIN VÀ HIỂN THỊ ---
async function loadFeed() {
    const feed = document.getElementById('feed-container');
    feed.innerHTML = '<p>Đang tải bài viết...</p>';

    // Lấy bài viết (mới nhất) kèm thông tin người đăng
    const { data: posts, error } = await supabase
        .from('posts')
        .select(`*, profiles(display_name, avatar_url, role)`)
        .order('created_at', { ascending: false });

    if(error) return console.error(error);
    feed.innerHTML = '';

    posts.forEach(post => {
        const isAuthorOrAdmin = currentUser.id === post.user_id || currentProfile.role === 'admin';
        
        // HTML mẫu cho 1 thẻ bài viết
        const postCard = document.createElement('div');
        postCard.className = 'card';
        postCard.innerHTML = `
            <div class="post-header">
                <img src="${post.profiles.avatar_url || 'https://via.placeholder.com/32'}">
                <div>
                    <strong>${post.profiles.display_name}</strong>
                    <div style="font-size: 12px; color: var(--text-sub)">${new Date(post.created_at).toLocaleString('vi-VN')}</div>
                </div>
                ${isAuthorOrAdmin ? `<button class="text-btn" style="margin-left:auto" onclick="deletePost('${post.id}')"><i class="fas fa-trash"></i></button>` : ''}
            </div>
            <div style="margin-top: 10px;">${post.content}</div>
            
            <div class="post-actions">
                <i class="fas fa-thumbs-up" onclick="toggleReaction('${post.id}')"> Thích</i>
                ${post.allow_comments ? `<i class="fas fa-comment"> Bình luận</i>` : `<span style="font-size: 12px">Đã tắt bình luận</span>`}
                <i class="fas fa-share" onclick="copyLink('${post.id}')"> Chia sẻ</i>
            </div>
        `;
        feed.appendChild(postCard);
    });
}

// Chức năng quản trị / Tác giả
async function deletePost(postId) {
    if(confirm("Xóa bài viết này?")) {
        await supabase.from('posts').delete().eq('id', postId);
        loadFeed();
    }
}

async function copyLink(postId) {
    // Tạo link ảo trỏ về trang chủ kèm ID bài viết
    const link = window.location.origin + window.location.pathname + "?post=" + postId;
    navigator.clipboard.writeText(link);
    alert("Đã sao chép liên kết!");
}

async function loadMyProfile() {
    if(!currentProfile) return;
    document.getElementById('profile-name').innerText = currentProfile.display_name;
    document.getElementById('profile-bio').innerText = currentProfile.bio || 'Chưa có tiểu sử';
    if(currentProfile.avatar_url) {
        document.getElementById('profile-avatar').src = currentProfile.avatar_url;
    }
    // Ở đây bạn có thể gọi API Supabase filter posts theo user_id để render vào #my-posts-container tương tự hàm loadFeed()
}
