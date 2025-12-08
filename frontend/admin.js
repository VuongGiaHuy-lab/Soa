// --- 1. SECURITY CHECK (Chạy ngay lập tức) ---
(function checkAdminAccess(){
    const t = localStorage.getItem('token');
    if(!t) {
        window.location.href = '/auth'; // Chưa đăng nhập -> Về trang Auth
        return;
    }
    
    try {
        // Giải mã JWT Payload để lấy role
        const base64Url = t.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        const payload = JSON.parse(jsonPayload);
        
        // Kiểm tra Role
        if(payload.role !== 'owner') {
            alert('Access Denied: You do not have permission to view this page.');
            window.location.href = '/'; // Không phải Owner -> Về trang chủ
        }
    } catch(e) {
        console.error("Invalid token", e);
        localStorage.removeItem('token');
        window.location.href = '/auth';
    }
})();

// --- 2. CONFIG & HELPERS ---
const API = document.getElementById('apiBase') ? document.getElementById('apiBase').value : 'http://localhost:8000';
function token(){ return localStorage.getItem('token'); }

function showToast(message, type = 'success') {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  
  // Set color
  toast.className = 'toast';
  if(type === 'success') toast.style.backgroundColor = '#10b981';
  else if(type === 'error') toast.style.backgroundColor = '#ef4444';
  else toast.style.backgroundColor = '#333';

  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => { toast.classList.remove('show'); }, 3000);
}

// --- 3. SERVICES ---
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
      else showToast("Failed to create service", "error");
  } catch(e) { console.error(e); }
}

// --- 4. USERS ---
async function listUsers(){
  try {
      const res = await fetch(API+"/admin/users", { headers:{ 'Authorization':'Bearer '+token() }});
      const txt = await res.text();
      document.getElementById('usersOut').textContent = txt;
  } catch(e) { showToast("Error loading users", "error"); }
}

// --- 5. MANAGE STYLISTS (Add, List, Delete, Edit) ---

// ADD NEW STYLIST (Tạo trực tiếp kèm tài khoản)
async function createNewStylist(evt){
    evt && evt.preventDefault();
    const btn = evt.target.querySelector('button');
    const originalText = btn.textContent;
    btn.textContent = "Creating Account...";
    btn.disabled = true;

    try {
        const payload = {
            // Thông tin tài khoản User
            full_name: document.getElementById('newStFullName').value,
            email: document.getElementById('newStEmail').value,
            password: document.getElementById('newStPass').value,
            
            // Thông tin Stylist
            display_name: document.getElementById('newStName').value,
            bio: document.getElementById('newStBio').value,
            start_hour: parseInt(document.getElementById('newStStart').value),
            end_hour: parseInt(document.getElementById('newStEnd').value)
        };

        const res = await fetch(API + "/stylists/", {
            method: 'POST',
            headers: { 
                'Authorization': 'Bearer ' + token(),
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify(payload)
        });

        if(res.ok) {
            showToast("Stylist account created!", "success");
            // Clear inputs
            document.getElementById('newStFullName').value = '';
            document.getElementById('newStEmail').value = '';
            document.getElementById('newStPass').value = '';
            document.getElementById('newStName').value = '';
            document.getElementById('newStBio').value = '';
            // Refresh list
            loadManageStylists();
            // Refresh users list too as we added a user
            listUsers();
        } else {
            const err = await res.json();
            showToast("Error: " + (err.detail || "Failed to add stylist"), "error");
        }
    } catch(e) {
        showToast("Network error", "error");
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// LIST STYLISTS
async function loadManageStylists(){
    try {
        const res = await fetch(API+"/stylists/");
        const data = await res.json();
        const wrap = document.getElementById('manageStylistList');
        wrap.innerHTML = '';
        
        if(!data || data.length === 0) {
            wrap.innerHTML = '<p class="text-muted">No stylists found.</p>';
            return;
        }

        data.forEach(st => {
            const card = document.createElement('div');
            card.className = 'stylist-card';
            card.style.textAlign = 'left';
            
            // Escape special chars
            const safeBio = (st.bio || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
            const safeName = st.display_name.replace(/'/g, "\\'").replace(/"/g, '&quot;');

            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:start;">
                    <h4 style="margin:0;">${st.display_name}</h4>
                    <small class="badge pending">ID: ${st.id}</small>
                </div>
                <p class="text-muted" style="font-size:0.9em; margin:8px 0;">${st.bio || 'No bio'}</p>
                <p style="font-size:0.9em;"><strong>Shift:</strong> ${st.start_hour}:00 - ${st.end_hour}:00</p>
                
                <div class="grid-two" style="margin-top:12px; gap:8px;">
                    <button onclick="openEditModal(${st.id}, '${safeName}', '${safeBio}', ${st.start_hour}, ${st.end_hour})" class="secondary" style="padding:6px; font-size:0.85rem;">Edit</button>
                    <button onclick="deleteStylist(${st.id})" class="danger" style="padding:6px; font-size:0.85rem;">Delete</button>
                </div>
            `;
            wrap.appendChild(card);
        });
    } catch(e) {
        document.getElementById('manageStylistList').innerHTML = '<p class="error">Error loading stylists</p>';
    }
}

// DELETE STYLIST
async function deleteStylist(id){
    if(!confirm(`Delete Stylist #${id}? This will fail if they have existing bookings.`)) return;
    
    try {
        const res = await fetch(API+`/stylists/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer '+token() }
        });
        
        if(res.ok) {
            showToast("Stylist deleted", "success");
            loadManageStylists();
        } else {
            const err = await res.json();
            showToast("Error: " + (err.detail || "Failed"), "error");
        }
    } catch(e) { showToast("Network error", "error"); }
}

// EDIT STYLIST MODAL
function openEditModal(id, name, bio, start, end) {
    document.getElementById('editId').value = id;
    document.getElementById('editName').value = name;
    document.getElementById('editBio').value = bio;
    document.getElementById('editStart').value = start;
    document.getElementById('editEnd').value = end;
    
    const modal = document.getElementById('editModal');
    if(modal) {
        modal.classList.add('active'); 
        modal.style.display = 'flex'; 
    }
}

function closeEditModal() {
    const modal = document.getElementById('editModal');
    if(modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
}

async function submitEditStylist(evt) {
    evt.preventDefault();
    const id = document.getElementById('editId').value;
    const btn = evt.target.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = "Saving...";
    btn.disabled = true;

    const payload = {
        display_name: document.getElementById('editName').value,
        bio: document.getElementById('editBio').value,
        start_hour: parseInt(document.getElementById('editStart').value),
        end_hour: parseInt(document.getElementById('editEnd').value)
    };

    try {
        const res = await fetch(API + `/stylists/${id}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token() 
            },
            body: JSON.stringify(payload)
        });

        if(res.ok) {
            showToast("Stylist updated successfully!", "success");
            closeEditModal();
            loadManageStylists();
        } else {
            const err = await res.json();
            showToast("Error: " + (err.detail || "Failed to update"), "error");
        }
    } catch(e) {
        showToast("Network error", "error");
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// --- 6. MANAGE BOOKINGS ---
async function loadAllBookings(){
  const out = document.getElementById('allBookingsTable');
  out.innerHTML = '<p class="text-muted">Loading...</p>';
  
  try{
    const res = await fetch(API+"/admin/bookings", { headers:{ 'Authorization':'Bearer '+token() }});
    const data = await res.json();
    
    if(!data || data.length === 0) {
        out.innerHTML = '<p class="text-muted">No bookings found.</p>';
        return;
    }

    let html = `<table>
        <thead>
            <tr>
                <th>ID</th><th>Customer</th><th>Service</th><th>Stylist</th><th>Time</th><th>Status</th><th>Action</th>
            </tr>
        </thead>
        <tbody>`;
    
    data.forEach(bk => {
        const customer = bk.is_walkin 
            ? `<strong>${bk.customer_name}</strong> (Walk-in)` 
            : `User #${bk.customer_id}`;
        
        let statusClass = 'badge pending';
        if(bk.status === 'confirmed') statusClass = 'badge confirmed';
        else if(bk.status === 'cancelled') statusClass = 'badge cancelled';

        html += `<tr>
            <td>${bk.id}</td>
            <td>${customer}</td>
            <td>${bk.service_id}</td>
            <td>${bk.stylist_id || '-'}</td>
            <td>${new Date(bk.start_time).toLocaleString()}</td>
            <td><span class="${statusClass}">${bk.status}</span></td>
            <td>
                <button onclick="deleteBooking(${bk.id})" class="danger" style="padding:4px 8px; font-size:0.8rem;">Delete</button>
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
    
    try {
        const res = await fetch(API+`/bookings/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer '+token() }
        });
        
        if(res.ok) {
            showToast("Booking deleted", "success");
            loadAllBookings();
        } else {
            showToast("Failed to delete", "error");
        }
    } catch(e) { showToast("Network error", "error"); }
}

// --- 7. WALK-IN POS FLOW ---
let walkinService = null;
let walkinStylist = null;
let walkinSelectedStart = null;

function updateWalkinConfirmation(){
  document.getElementById('walkinServiceId').value = walkinService?.id || '';
  document.getElementById('walkinStylistId').value = walkinStylist?.id || '';
  document.getElementById('walkinConfirmService').textContent = walkinService ? `${walkinService.name} ($${walkinService.price})` : '-';
  document.getElementById('walkinConfirmStylist').textContent = walkinStylist ? walkinStylist.display_name : '-';
  document.getElementById('walkinConfirmStart').textContent = walkinSelectedStart ? new Date(walkinSelectedStart).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '-';
}

async function loadServices(evt){
  evt && evt.preventDefault();
  try {
      const res = await fetch(API+"/services/");
      const data = await res.json();
      const wrap = document.getElementById('walkinServiceList');
      wrap.innerHTML = '';
      
      data.forEach(svc => {
        const btn = document.createElement('div');
        btn.className = 'slot-btn';
        btn.style.textAlign = 'left';
        btn.style.marginBottom = '4px';
        btn.textContent = `${svc.name} - $${svc.price} (${svc.duration_minutes}m)`;
        btn.onclick = () => { 
            walkinService = svc; 
            Array.from(wrap.children).forEach(c => c.classList.remove('selected'));
            btn.classList.add('selected');
            updateWalkinConfirmation(); 
        };
        wrap.appendChild(btn);
      });
  } catch(e) { console.error(e); }
}

async function loadStylists(evt){
  evt && evt.preventDefault();
  try {
      const res = await fetch(API+"/stylists/");
      const data = await res.json();
      const wrap = document.getElementById('walkinStylistList');
      wrap.innerHTML = '';
      
      data.forEach(st => {
        const btn = document.createElement('div');
        btn.className = 'slot-btn';
        btn.style.textAlign = 'left';
        btn.style.marginBottom = '4px';
        btn.textContent = st.display_name;
        btn.onclick = () => {
          walkinStylist = st;
          Array.from(wrap.children).forEach(c => c.classList.remove('selected'));
          btn.classList.add('selected');
          updateWalkinConfirmation();
        };
        wrap.appendChild(btn);
      });
  } catch(e) { console.error(e); }
}

async function loadWalkinSlots(){
  const svcId = walkinService?.id;
  const date = document.getElementById('walkin-date').value;
  const slotsEl = document.getElementById('walkin-slots');
  const selectedEl = document.getElementById('walkin-selected-slot');
  
  slotsEl.innerHTML = '<p class="text-muted">Loading...</p>';
  selectedEl.style.display = 'none';
  walkinSelectedStart = null;

  if(!svcId || !date){ 
      slotsEl.innerHTML = '<p class="text-muted">Please select service and date.</p>';
      return; 
  }

  const params = new URLSearchParams({ service_id: String(svcId), date });
  if (walkinStylist?.id) params.set('stylist_id', String(walkinStylist.id));

  try{
    const res = await fetch(`${API}/bookings/availability?${params.toString()}`, { headers:{ 'Authorization':'Bearer '+token() }});
    const slots = await res.json();
    slotsEl.innerHTML = '';
    
    if (slots.length === 0){ slotsEl.innerHTML = '<p class="text-muted">No slots available.</p>'; return; }
    
    slots.forEach(slot => {
      const btn = document.createElement('button');
      btn.className = 'slot-btn';
      btn.type = 'button';
      btn.textContent = new Date(slot.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      btn.onclick = () => {
        document.querySelectorAll('#walkin-slots .slot-btn.selected').forEach(el => el.classList.remove('selected'));
        btn.classList.add('selected');
        
        walkinSelectedStart = slot.start_time;
        
        selectedEl.style.display = 'inline-block';
        selectedEl.textContent = `Selected: ${new Date(slot.start_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
        
        updateWalkinConfirmation();
      };
      slotsEl.appendChild(btn);
    });
  } catch(e){
    slotsEl.innerHTML = '<p class="error">Error loading slots</p>';
  }
}

async function createWalkin(evt){
  evt && evt.preventDefault();
  if(!walkinService || !walkinStylist || !walkinSelectedStart){ 
      showToast("Please complete all steps (Service, Stylist, Time)", "warning"); 
      return; 
  }
  
  const payload = {
    service_id: walkinService.id,
    stylist_id: walkinStylist.id,
    start_time: walkinSelectedStart,
    customer_name: document.getElementById('walkinName').value,
    customer_email: document.getElementById('walkinEmail').value || null,
  };
  
  try {
      const res = await fetch(API+"/bookings/walkin", {
        method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+token() },
        body: JSON.stringify(payload),
      });
      
      const txt = await res.text();
      document.getElementById('walkinOut').innerHTML = res.ok 
        ? '<p style="color:green">Walk-in created successfully!</p>' 
        : `<p style="color:red">Error: ${txt}</p>`;
      
      if(res.ok) {
          showToast("Walk-in booking created", "success");
          loadAllBookings();
      }
  } catch(e) { showToast("Network error", "error"); }
}

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('walkin-load-slots');
  if (btn) btn.addEventListener('click', loadWalkinSlots);
  
  // Set default date to today
  const dateInput = document.getElementById('walkin-date');
  if (dateInput) {
      const today = new Date().toISOString().split('T')[0];
      dateInput.value = today;
      dateInput.addEventListener('change', () => { if (walkinService) loadWalkinSlots(); });
  }
  
  loadManageStylists();
});