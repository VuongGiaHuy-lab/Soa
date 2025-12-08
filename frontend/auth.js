const API = document.getElementById('apiBase') ? document.getElementById('apiBase').value : 'http://localhost:8000';

// --- HELPERS ---
function showToast(message, type = 'success') {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  setTimeout(() => { toast.className = 'toast'; }, 3000);
}

function setLoading(btn, isLoading, text="Processing...") {
    if(isLoading) {
        btn.dataset.originalText = btn.textContent;
        btn.textContent = text;
        btn.disabled = true;
    } else {
        btn.textContent = btn.dataset.originalText || "Submit";
        btn.disabled = false;
    }
}

// --- GUEST LOGIC ---
function continueAsGuest() {
    // Xóa token cũ để đảm bảo sạch sẽ
    localStorage.removeItem('token');
    
    // Chuyển hướng về trang chủ
    // Tại trang chủ (index.html), người dùng sẽ thấy nút "Guest" để đặt lịch
    window.location.href = "/";
}

// --- LOGIN ---
async function login(evt){
  evt && evt.preventDefault();
  const btn = evt.target.querySelector('button');
  setLoading(btn, true, "Logging in...");

  try {
      const body = new URLSearchParams();
      body.append('username', document.getElementById('loginEmail').value);
      body.append('password', document.getElementById('loginPass').value);
      
      const res = await fetch(api()+"/auth/login", { method:'POST', body });
      const txt = await res.text();
      
      if(res.ok){
        const json = JSON.parse(txt);
        localStorage.setItem('token', json.access_token);
        showToast('Login successful! Redirecting...', 'success');
        setTimeout(() => { window.location.href = "/"; }, 1000);
      } else {
        let errMsg = "Login failed";
        try { errMsg = JSON.parse(txt).detail || errMsg; } catch(e) {}
        showToast(errMsg, 'error');
      }
  } catch(e) {
      showToast("Network Error", 'error');
  } finally {
      setLoading(btn, false);
  }
}

// --- REGISTER ---
async function register(evt){
  evt && evt.preventDefault();
  const btn = evt.target.querySelector('button');
  setLoading(btn, true, "Creating Account...");
  
  try {
      const payload = {
          email: document.getElementById('regEmail').value,
          full_name: document.getElementById('regName').value,
          password: document.getElementById('regPass').value,
      };

      const res = await fetch(api()+"/auth/register", {
        method:'POST', 
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload),
      });
      
      const txt = await res.text();
      
      if(res.ok){
          showToast('Account created! Please login.', 'success');
          document.getElementById('loginEmail').value = payload.email;
          document.getElementById('regEmail').value = "";
          document.getElementById('regPass').value = "";
      } else {
          let errMsg = "Registration failed";
          try { errMsg = JSON.parse(txt).detail || errMsg; } catch(e) {}
          showToast(errMsg, 'error');
      }
  } catch(e) {
      showToast("Network Error", 'error');
  } finally {
      setLoading(btn, false);
  }
}

function api() { return API; }