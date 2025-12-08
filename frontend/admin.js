const API = 'http://localhost:8000';
function token(){ return localStorage.getItem('token'); }

// Helper Toast (Copy từ app.js để dùng chung)
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

// --- SERVICES ---
async function createService(evt){
  evt && evt.preventDefault();
  try {
      const res = await fetch(API+"/services/", {
        method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+token() },
        body: JSON.stringify({
          name: document.getElementById('svcName').value,
          description: document.getElementById('svcDesc').value,
          price: parseFloat(document.getElementById('svcPrice').value),
          duration_minutes: parseInt(document.getElementById('svcDur').value),
        }),
      });
      const txt = await res.text();
      document.getElementById('svcOut').textContent = txt;
      if(res.ok) showToast("Service created");
  } catch(e) { console.error(e); }
}

// --- USERS ---
async function listUsers(){
  const res = await fetch(API+"/admin/users", { headers:{ 'Authorization':'Bearer '+token() }});
  document.getElementById('usersOut').textContent = await res.text();
}

// --- MANAGE STYLISTS (MỚI) ---
async function loadManageStylists(){
    const res = await fetch(API+"/stylists/");
    const data = await res.json();
    const wrap = document.getElementById('manageStylistList');
    wrap.innerHTML = '';
    
    if(!data || data.length === 0) {
        wrap.innerHTML = '<p>No stylists found.</p>';
        return;
    }

    data.forEach(st => {
        const card = document.createElement('div');
        card.className = 'stylist-card';
        card.style.position = 'relative';
        card.innerHTML = `
            <h4>${st.display_name}</h4>
            <p><small>ID: ${st.id}</small></p>
            <p><small>Hours: ${st.start_hour}:00 - ${st.end_hour}:00</small></p>
            <button onclick="deleteStylist(${st.id})" class="danger" style="width:100%; margin-top:8px;">Delete</button>
        `;
        wrap.appendChild(card);
    });
}

async function deleteStylist(id){
    if(!confirm(`Delete Stylist #${id}? This will fail if they have existing bookings.`)) return;
    
    const res = await fetch(API+`/stylists/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer '+token() }
    });
    
    if(res.ok) {
        showToast("Stylist deleted");
        loadManageStylists();
    } else {
        const err = await res.json();
        alert("Error: " + err.detail);
    }
}

// --- MANAGE BOOKINGS (CẬP NHẬT) ---
async function loadAllBookings(){
  const out = document.getElementById('allBookingsTable');
  out.innerHTML = 'Loading...';
  
  try{
    const res = await fetch(API+"/admin/bookings", { headers:{ 'Authorization':'Bearer '+token() }});
    const data = await res.json();
    
    if(!data || data.length === 0) {
        out.innerHTML = '<p>No bookings found.</p>';
        return;
    }

    // Render Table
    let html = `<table>
        <thead>
            <tr>
                <th>ID</th><th>Customer</th><th>Service</th><th>Stylist</th><th>Time</th><th>Status</th><th>Action</th>
            </tr>
        </thead>
        <tbody>`;
    
    data.forEach(bk => {
        const customer = bk.is_walkin 
            ? `${bk.customer_name} (Walk-in)` 
            : `User #${bk.customer_id}`;
            
        html += `<tr>
            <td>${bk.id}</td>
            <td>${customer}</td>
            <td>${bk.service_id}</td>
            <td>${bk.stylist_id || '-'}</td>
            <td>${new Date(bk.start_time).toLocaleString()}</td>
            <td>${bk.status}</td>
            <td>
                <button onclick="deleteBooking(${bk.id})" class="danger" style="padding:4px 8px;">Delete</button>
            </td>
        </tr>`;
    });
    html += '</tbody></table>';
    out.innerHTML = html;
    
  }catch(e){
    out.textContent = 'Error loading bookings: '+e.message;
  }
}

async function deleteBooking(id){
    if(!confirm(`Permanently delete Booking #${id}? This cannot be undone.`)) return;
    
    const res = await fetch(API+`/bookings/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer '+token() }
    });
    
    if(res.ok) {
        showToast("Booking deleted");
        loadAllBookings();
    } else {
        alert("Failed to delete");
    }
}

// --- WALK-IN FLOW (Giữ nguyên logic cũ) ---
let walkinService = null;
let walkinStylist = null;
let walkinSelectedStart = null;

function updateWalkinConfirmation(){
  document.getElementById('walkinServiceId').value = walkinService?.id || '';
  document.getElementById('walkinStylistId').value = walkinStylist?.id || '';
  document.getElementById('walkinConfirmService').textContent = walkinService ? `${walkinService.name} (#${walkinService.id})` : '-';
  document.getElementById('walkinConfirmStylist').textContent = walkinStylist ? `${walkinStylist.display_name} (#${walkinStylist.id})` : '-';
  document.getElementById('walkinConfirmStart').textContent = walkinSelectedStart || '-';
}

async function loadServices(evt){
  evt && evt.preventDefault();
  const res = await fetch(API+"/services/");
  const data = await res.json();
  const wrap = document.getElementById('walkinServiceList');
  wrap.innerHTML = '';
  data.forEach(svc => {
    const btn = document.createElement('button');
    btn.className = 'slot-btn';
    btn.textContent = `${svc.name} - $${svc.price}`;
    btn.onclick = () => { walkinService = svc; updateWalkinConfirmation(); };
    wrap.appendChild(btn);
  });
}

async function loadStylists(evt){
  evt && evt.preventDefault();
  const res = await fetch(API+"/stylists/");
  const data = await res.json();
  const wrap = document.getElementById('walkinStylistList');
  wrap.innerHTML = '';
  data.forEach(st => {
    const card = document.createElement('div');
    card.className = 'stylist-card';
    card.innerHTML = `<h4>${st.display_name}</h4>`;
    card.onclick = () => {
      walkinStylist = st;
      [...wrap.children].forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      updateWalkinConfirmation();
    };
    wrap.appendChild(card);
  });
}

async function loadWalkinSlots(){
  const svcId = walkinService?.id;
  const date = document.getElementById('walkin-date').value;
  const slotsEl = document.getElementById('walkin-slots');
  const selectedEl = document.getElementById('walkin-selected-slot');
  slotsEl.innerHTML = 'Loading...';
  selectedEl.textContent = '';
  walkinSelectedStart = null;

  if(!svcId || !date){ alert('Select service and date first.'); return; }

  const params = new URLSearchParams({ service_id: String(svcId), date });
  if (walkinStylist?.id) params.set('stylist_id', String(walkinStylist.id));

  try{
    const res = await fetch(`${API}/bookings/availability?${params.toString()}`, { headers:{ 'Authorization':'Bearer '+token() }});
    const slots = await res.json();
    slotsEl.innerHTML = '';
    
    if (slots.length === 0){ slotsEl.innerHTML = '<p class="muted">No slots available.</p>'; return; }
    
    slots.forEach(slot => {
      const btn = document.createElement('button');
      btn.className = 'slot-btn';
      btn.type = 'button';
      btn.textContent = new Date(slot.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      btn.onclick = () => {
        document.querySelectorAll('#walkin-slots .slot-btn.selected').forEach(el => el.classList.remove('selected'));
        btn.classList.add('selected');
        walkinSelectedStart = slot.start_time;
        selectedEl.textContent = `Selected: ${slot.start_time}`;
        updateWalkinConfirmation();
      };
      slotsEl.appendChild(btn);
    });
  }catch(e){
    slotsEl.innerHTML = '<p class="error">Error loading slots</p>';
  }
}

async function createWalkin(evt){
  evt && evt.preventDefault();
  if(!walkinService || !walkinStylist || !walkinSelectedStart){ alert('Incomplete info'); return; }
  
  const payload = {
    service_id: walkinService.id,
    stylist_id: walkinStylist.id,
    start_time: walkinSelectedStart,
    customer_name: document.getElementById('walkinName').value,
    customer_email: document.getElementById('walkinEmail').value || null,
  };
  
  const res = await fetch(API+"/bookings/walkin", {
    method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+token() },
    body: JSON.stringify(payload),
  });
  document.getElementById('walkinOut').textContent = await res.text();
  if(res.ok) {
      showToast("Walk-in created");
      loadAllBookings(); // Refresh bookings list
  }
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('walkin-load-slots');
  if (btn) btn.addEventListener('click', loadWalkinSlots);
  const loadAllBtn = document.getElementById('load-all-bookings');
  if (loadAllBtn) loadAllBtn.addEventListener('click', (e)=>{ e.preventDefault(); loadAllBookings(); });
  
  const dateInput = document.getElementById('walkin-date');
  if (dateInput) {
      const today = new Date().toISOString().split('T')[0];
      dateInput.value = today;
      dateInput.addEventListener('change', () => { if (walkinService) loadWalkinSlots(); });
  }
});