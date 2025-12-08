// SPA navigation
(function(){
  const links = document.querySelectorAll('[data-view]');
  const views = document.querySelectorAll('.view');
  function activate(id){
    views.forEach(v => v.classList.toggle('active', v.id === id));
  }
  links.forEach(a => {
    a.addEventListener('click', (e)=>{ 
        e.preventDefault(); 
        const id = a.getAttribute('href').replace('#','');
        activate(id); 
    });
  });
  activate('home');
})();

let token = localStorage.getItem('token') || null;
if(token) setStatus('Logged in (saved session)', true);

function api() { return document.getElementById('apiBase').value.trim(); }

function setStatus(text, ok=true){
  const el = document.getElementById('status');
  el.textContent = text;
  el.style.color = ok ? 'green' : 'red';
}

// --- UTILS: Toast & Loading ---
function showToast(message, type = 'success') {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast'; // CSS class in styles.css
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

// --- AUTH ---
async function register(evt){
  evt && evt.preventDefault();
  const btn = evt.target.querySelector('button');
  setLoading(btn, true);
  
  try {
      const res = await fetch(api()+"/auth/register", {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: document.getElementById('regEmail').value,
          full_name: document.getElementById('regName').value,
          password: document.getElementById('regPass').value,
        }),
      });
      const txt = await res.text();
      if(res.ok) {
          showToast("Registration successful! Please login.", "success");
      } else {
          showToast("Registration failed", "error");
      }
  } catch(e) { showToast("Network error", "error"); }
  finally { setLoading(btn, false); }
}

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
      
      if (res.ok){
        const json = JSON.parse(txt);
        token = json.access_token;
        localStorage.setItem('token', token);
        setStatus('Logged in', true);
        showToast("Login successful", "success");
      } else {
        setStatus('Login failed', false);
        showToast("Invalid credentials", "error");
      }
  } catch(e) { showToast("Network error", "error"); }
  finally { setLoading(btn, false); }
}

// --- SERVICES & STYLISTS ---
async function listServices(){
  const res = await fetch(api()+"/services/");
  document.getElementById('servicesList').textContent = await res.text();
}

async function listStylists(){
  const res = await fetch(api()+"/stylists/");
  document.getElementById('stylistsList').textContent = await res.text();
}

// --- BOOKING ---
async function checkAvailability(evt){
  evt && evt.preventDefault();
  const btn = evt.target.querySelector('button');
  setLoading(btn, true, "Checking...");

  try {
      const sid = document.getElementById('availServiceId').value;
      const d = document.getElementById('availDate').value;
      const stid = document.getElementById('availStylistId').value;
      
      const url = new URL(api()+"/bookings/availability");
      url.searchParams.set('service_id', sid);
      url.searchParams.set('date', d);
      if (stid) url.searchParams.set('stylist_id', stid);
      
      const res = await fetch(url);
      const txt = await res.text();
      document.getElementById('availOut').textContent = txt;
  } finally { setLoading(btn, false); }
}

async function createBooking(evt){
  evt && evt.preventDefault();
  if(!token) return showToast("Please login first", "error");
  
  const btn = evt.target.querySelector('button');
  setLoading(btn, true, "Booking...");

  try {
      const res = await fetch(api()+"/bookings/", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer '+token },
        body: JSON.stringify({
          service_id: parseInt(document.getElementById('bkServiceId').value),
          stylist_id: parseInt(document.getElementById('bkStylistId').value),
          start_time: document.getElementById('bkStart').value,
        }),
      });
      const txt = await res.text();
      document.getElementById('bkOut').textContent = txt;
      if(res.ok) {
          showToast("Booking created!", "success");
          loadMyBookings(); // Reload list if open
      } else {
          showToast("Booking failed", "error");
      }
  } finally { setLoading(btn, false); }
}

// --- MY BOOKINGS & CANCEL ---
async function loadMyBookings(){
    if(!token) {
        document.getElementById('myBookingsList').innerHTML = '<p style="color:red">Please login to view bookings.</p>';
        return;
    }
    
    try {
        const res = await fetch(api()+"/bookings/me", {
            headers: { 'Authorization': 'Bearer '+token }
        });
        if(!res.ok) throw new Error("Failed to fetch");
        
        const data = await res.json();
        const container = document.getElementById('myBookingsList');
        container.innerHTML = "";
        
        if(data.length === 0) {
            container.innerHTML = "<p>No bookings found.</p>";
            return;
        }

        // Render bảng booking
        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.innerHTML = `
            <tr style="background:#eee; text-align:left;">
                <th style="padding:8px;">ID</th>
                <th>Service</th>
                <th>Start Time</th>
                <th>Status</th>
                <th>Action</th>
            </tr>
        `;
        
        data.forEach(bk => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #ddd';
            const canCancel = (bk.status !== 'cancelled' && bk.status !== 'completed');
            
            tr.innerHTML = `
                <td style="padding:8px;">#${bk.id}</td>
                <td>${bk.service_id}</td>
                <td>${new Date(bk.start_time).toLocaleString()}</td>
                <td>
                    <span style="
                        padding:2px 6px; border-radius:4px; font-size:0.8em;
                        background:${bk.status === 'confirmed' ? '#d1fae5' : '#fee2e2'};
                        color:${bk.status === 'confirmed' ? '#065f46' : '#991b1b'};
                    ">${bk.status.toUpperCase()}</span>
                </td>
                <td>
                    ${canCancel ? `<button onclick="cancelBooking(${bk.id})" style="background:#ef4444; padding:4px 8px; font-size:0.8em;">Cancel</button>` : '-'}
                </td>
            `;
            table.appendChild(tr);
        });
        container.appendChild(table);
        
    } catch(e) {
        document.getElementById('myBookingsList').textContent = "Error loading bookings.";
    }
}

async function cancelBooking(id) {
    if(!confirm("Are you sure you want to cancel this booking?")) return;
    
    try {
        const res = await fetch(api()+`/bookings/${id}/cancel`, {
            method: 'PUT',
            headers: { 'Authorization': 'Bearer '+token }
        });
        if(res.ok) {
            showToast("Booking cancelled", "success");
            loadMyBookings(); // Reload list
        } else {
            const txt = await res.text();
            showToast("Failed: " + txt, "error");
        }
    } catch(e) {
        showToast("Network error", "error");
    }
}

// --- PAY ---
async function payBooking(evt){
  evt && evt.preventDefault();
  const btn = evt.target.querySelector('button');
  setLoading(btn, true, "Processing Payment...");
  
  try {
      const id = document.getElementById('payBookingId').value;
      const res = await fetch(api()+`/bookings/${id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer '+token },
        body: JSON.stringify({
          amount: parseFloat(document.getElementById('payAmount').value),
          card_number: document.getElementById('payCard').value,
          expiry_month: parseInt(document.getElementById('payMonth').value),
          expiry_year: parseInt(document.getElementById('payYear').value),
          cvv: document.getElementById('payCVV').value,
          cardholder_name: document.getElementById('payName').value,
        }),
      });
      const txt = await res.text();
      document.getElementById('payOut').textContent = txt;
      
      if(res.ok) showToast("Payment Successful!", "success");
      else showToast("Payment Failed", "error");
      
  } finally { setLoading(btn, false); }
}

// --- OWNER ---
async function createService(evt){
  evt && evt.preventDefault();
  const btn = evt.target.querySelector('button');
  setLoading(btn, true);

  try {
      const res = await fetch(api()+"/services/", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer '+token },
        body: JSON.stringify({
          name: document.getElementById('svcName').value,
          description: document.getElementById('svcDesc').value,
          price: parseFloat(document.getElementById('svcPrice').value),
          duration_minutes: parseInt(document.getElementById('svcDur').value),
        }),
      });
      const txt = await res.text();
      document.getElementById('svcOut').textContent = txt;
      if(res.ok) showToast("Service created", "success");
  } finally { setLoading(btn, false); }
}