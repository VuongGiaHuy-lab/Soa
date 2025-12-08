const API = 'http://localhost:8000';
function token(){ return localStorage.getItem('token'); }
async function createService(evt){
  evt && evt.preventDefault();
  const res = await fetch(API+"/services/", {
    method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+token() },
    body: JSON.stringify({
      name: document.getElementById('svcName').value,
      description: document.getElementById('svcDesc').value,
      price: parseFloat(document.getElementById('svcPrice').value),
      duration_minutes: parseInt(document.getElementById('svcDur').value),
    }),
  });
  document.getElementById('svcOut').textContent = await res.text();
}
async function listUsers(){
  const res = await fetch(API+"/admin/users", { headers:{ 'Authorization':'Bearer '+token() }});
  document.getElementById('usersOut').textContent = await res.text();
}

async function loadAllBookings(){
  const out = document.getElementById('allBookingsOut');
  try{
    const res = await fetch(API+"/admin/bookings", { headers:{ 'Authorization':'Bearer '+token() }});
    const data = await res.json();
    out.textContent = JSON.stringify(data, null, 2);
  }catch(e){
    out.textContent = 'Error loading bookings: '+e.message;
  }
}

// Walk-in flow state
let walkinService = null;
let walkinStylist = null;
let walkinSelectedStart = null; // ISO string of selected start time

function updateWalkinConfirmation(){
  document.getElementById('walkinServiceId').value = walkinService?.id || '';
  document.getElementById('walkinStylistId').value = walkinStylist?.id || '';
  document.getElementById('walkinConfirmService').textContent = walkinService ? `${walkinService.name} (#${walkinService.id})` : '-';
  document.getElementById('walkinConfirmStylist').textContent = walkinStylist ? `${walkinStylist.display_name} (#${walkinStylist.id})` : '-';
  const st = walkinSelectedStart;
  document.getElementById('walkinConfirmStart').textContent = st || '-';
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
    btn.textContent = `${svc.name} - $${svc.price} (${svc.duration_minutes}m)`;
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
    card.innerHTML = `<h4>${st.display_name}</h4><small>#${st.id}</small>`;
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
  slotsEl.innerHTML = '';
  selectedEl.textContent = '';
  walkinSelectedStart = null;

  if(!svcId || !date){
    alert('Select service and date first.');
    return;
  }

  const params = new URLSearchParams({ service_id: String(svcId), date });
  if (walkinStylist?.id) params.set('stylist_id', String(walkinStylist.id));

  try{
    const res = await fetch(`${API}/bookings/availability?${params.toString()}`, { headers:{ 'Authorization':'Bearer '+token() }});
    let data;
    try {
      data = await res.json();
    } catch (e) {
      const txt = await res.text();
      console.warn('Availability response not JSON:', txt);
      slotsEl.innerHTML = '<p class="error">Failed to parse slots. See console.</p>';
      return;
    }
  const slots = Array.isArray(data) ? data : (data.slots || []);
    if (slots.length === 0){
      slotsEl.innerHTML = '<p class="muted">No available slots for selected inputs.</p>';
      return;
    }
    slots.forEach(slot => {
      const btn = document.createElement('button');
      btn.className = 'slot-btn';
      btn.type = 'button';
      btn.textContent = new Date(slot.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      btn.onclick = () => {
        document.querySelectorAll('#walkin-slots .slot-btn.selected').forEach(el => el.classList.remove('selected'));
        btn.classList.add('selected');
        walkinSelectedStart = slot.start_time;
        selectedEl.textContent = `Selected: ${slot.start_time} - ${slot.end_time}`;
        updateWalkinConfirmation();
      };
      slotsEl.appendChild(btn);
    });
  }catch(e){
    console.error('Failed to load slots', e);
    slotsEl.innerHTML = '<p class="error">Failed to load slots: '+e.message+'</p>';
  }
}

async function createWalkin(evt){
  evt && evt.preventDefault();
  if(!walkinService || !walkinStylist){ alert('Choose service and stylist'); return; }
  if(!walkinSelectedStart){ alert('Please select a timeslot.'); return; }
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
}

// Wire load slots button if present
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('walkin-load-slots');
  if (btn) btn.addEventListener('click', loadWalkinSlots);
  const loadAllBtn = document.getElementById('load-all-bookings');
  if (loadAllBtn) loadAllBtn.addEventListener('click', (e)=>{ e.preventDefault(); loadAllBookings(); });
  // Prefill date to today
  const dateInput = document.getElementById('walkin-date');
  if (dateInput && !dateInput.value) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth()+1).padStart(2,'0');
    const dd = String(today.getDate()).padStart(2,'0');
    dateInput.value = `${yyyy}-${mm}-${dd}`;
  }
  // Auto reload slots when date changes if service already chosen
  if (dateInput) {
    dateInput.addEventListener('change', () => {
      if (walkinService) loadWalkinSlots();
    });
  }
});
