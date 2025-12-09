const API = 'http://localhost:8000';
function token(){ return localStorage.getItem('token'); }

let selectedService = null;
let selectedStylist = null;
let selectedStart = null;

function updateConfirmation(){
  document.getElementById('bkServiceId').value = selectedService?.id || '';
  document.getElementById('bkStylistId').value = selectedStylist?.id || '';
  document.getElementById('bkStart').value = selectedStart || '';
  document.getElementById('confirmService').textContent = selectedService ? `${selectedService.name} (#${selectedService.id})` : '-';
  document.getElementById('confirmStylist').textContent = selectedStylist ? `${selectedStylist.display_name} (#${selectedStylist.id})` : '-';
  document.getElementById('confirmStart').textContent = selectedStart || '-';
}

async function loadServices(){
  const res = await fetch(API+"/services/");
  const data = await res.json();
  const wrap = document.getElementById('serviceList');
  wrap.innerHTML = '';
  data.forEach(svc => {
    const btn = document.createElement('button');
    btn.className = 'slot-btn';
    btn.textContent = `${svc.name} - $${svc.price} (${svc.duration_minutes}m)`;
    btn.onclick = () => { selectedService = svc; updateConfirmation(); };
    wrap.appendChild(btn);
  });
}

async function loadStylists(){
  const res = await fetch(API+"/stylists/");
  let data;
  try {
    data = await res.json();
  } catch (e) {
    const txt = await res.text();
    console.warn('Stylists response not JSON:', txt);
    document.getElementById('stylistList').innerHTML = '<p class="error">Failed to parse stylists list.</p>';
    return;
  }
  if (!Array.isArray(data)) {
    data = data.items || data.results || [];
  }
  const wrap = document.getElementById('stylistList');
  wrap.innerHTML = '';
  if (!data || data.length === 0) {
    wrap.innerHTML = '<p class="muted">No stylists found.</p>';
    return;
  }
  data.forEach(st => {
    const card = document.createElement('div');
    card.className = 'stylist-card';
    const name = st.display_name || st.name || st.full_name || ('Stylist #' + st.id);
    card.innerHTML = `<h4>${name}</h4><small>#${st.id}</small>`;
    card.onclick = () => {
      selectedStylist = st;
      [...wrap.children].forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      updateConfirmation();
    };
    wrap.appendChild(card);
  });
}

async function loadSlots(){
  if(!selectedService){ alert('Select a service first'); return; }
  if(!selectedStylist){ alert('Please choose a stylist first'); return; }
  const d = document.getElementById('availDate').value;
  if(!d){ alert('Please pick a date'); return; }
  const url = new URL(API+"/bookings/availability");
  url.searchParams.set('service_id', selectedService.id);
  url.searchParams.set('date', d);
  url.searchParams.set('stylist_id', selectedStylist.id);
  const res = await fetch(url);
  const slots = await res.json();
  const grid = document.getElementById('slotGrid');
  grid.innerHTML = '';
  if(slots.length === 0){ grid.textContent = 'No available slots'; return; }
  slots.forEach(slot => {
    const btn = document.createElement('button');
    btn.className = 'slot-btn';
    const timeStr = new Date(slot.start_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    btn.textContent = timeStr;
    btn.onclick = () => { selectedStart = slot.start_time; updateConfirmation(); };
    grid.appendChild(btn);
  });
}

async function createBooking(evt){
  evt && evt.preventDefault();
  if(!selectedService || !selectedStylist || !selectedStart){ alert('Select service, stylist and timeslot'); return; }
  const payload = {
    service_id: selectedService.id,
    stylist_id: selectedStylist.id,
    start_time: selectedStart,
  };
  const res = await fetch(API+"/bookings/", {
    method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+token() },
    body: JSON.stringify(payload),
  });
  document.getElementById('bkOut').textContent = await res.text();
}

async function payBooking(evt){
  evt && evt.preventDefault();
  const id = document.getElementById('payBookingId').value;
  const res = await fetch(API+`/bookings/${id}/pay`, {
    method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+token() },
    body: JSON.stringify({
      amount: parseFloat(document.getElementById('payAmount').value),
      card_number: document.getElementById('payCard').value,
      expiry_month: parseInt(document.getElementById('payMonth').value),
      expiry_year: parseInt(document.getElementById('payYear').value),
      cvv: document.getElementById('payCVV').value,
      cardholder_name: document.getElementById('payName').value,
    }),
  });
  document.getElementById('payOut').textContent = await res.text();
}
