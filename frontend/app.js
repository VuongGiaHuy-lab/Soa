// SPA navigation
(function(){
  const links = document.querySelectorAll('[data-view]');
  const views = document.querySelectorAll('.view');
  function activate(id){
    views.forEach(v => v.classList.toggle('active', v.id === id));
  }
  links.forEach(a => {
    a.addEventListener('click', (e)=>{ e.preventDefault(); activate(a.getAttribute('href').replace('#','')); });
  });
  // default view
  activate('home');
})();

let token = null;
function api() { return document.getElementById('apiBase').value.trim(); }
function setStatus(text, ok=true){
  const el = document.getElementById('status');
  el.textContent = text;
  el.style.color = ok ? 'green' : 'red';
}

async function register(evt){
  evt && evt.preventDefault();
  const res = await fetch(api()+"/auth/register", {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: document.getElementById('regEmail').value,
      full_name: document.getElementById('regName').value,
      password: document.getElementById('regPass').value,
    }),
  });
  document.getElementById('regOut').textContent = await res.text();
}

async function login(evt){
  evt && evt.preventDefault();
  const body = new URLSearchParams();
  body.append('username', document.getElementById('loginEmail').value);
  body.append('password', document.getElementById('loginPass').value);
  const res = await fetch(api()+"/auth/login", { method:'POST', body });
  const txt = await res.text();
  document.getElementById('loginOut').textContent = txt;
  if (res.ok){
    const json = JSON.parse(txt);
    token = json.access_token;
    setStatus('Logged in', true);
  } else {
    setStatus('Login failed', false);
  }
}

async function listServices(){
  const res = await fetch(api()+"/services/");
  document.getElementById('servicesList').textContent = await res.text();
}

async function listStylists(){
  const res = await fetch(api()+"/stylists/");
  document.getElementById('stylistsList').textContent = await res.text();
}

async function checkAvailability(evt){
  evt && evt.preventDefault();
  const sid = document.getElementById('availServiceId').value;
  const d = document.getElementById('availDate').value;
  const stid = document.getElementById('availStylistId').value;
  const url = new URL(api()+"/bookings/availability");
  url.searchParams.set('service_id', sid);
  url.searchParams.set('date', d);
  if (stid) url.searchParams.set('stylist_id', stid);
  const res = await fetch(url);
  document.getElementById('availOut').textContent = await res.text();
}

async function createService(evt){
  evt && evt.preventDefault();
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
  document.getElementById('svcOut').textContent = await res.text();
}

async function createBooking(evt){
  evt && evt.preventDefault();
  const res = await fetch(api()+"/bookings/", {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer '+token },
    body: JSON.stringify({
      service_id: parseInt(document.getElementById('bkServiceId').value),
      stylist_id: document.getElementById('bkStylistId').value ? parseInt(document.getElementById('bkStylistId').value) : null,
      start_time: document.getElementById('bkStart').value,
    }),
  });
  document.getElementById('bkOut').textContent = await res.text();
}

async function payBooking(evt){
  evt && evt.preventDefault();
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
  document.getElementById('payOut').textContent = await res.text();
}
