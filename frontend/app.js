const API = document.getElementById('apiBase') ? document.getElementById('apiBase').value : 'http://localhost:8000';
let token = localStorage.getItem('token') || null;
let isGuestMode = false;
let userRole = null;

if(token) {
    try { const payload = JSON.parse(atob(token.split('.')[1])); userRole = payload.role; } 
    catch(e) { console.error("Invalid token"); token = null; }
}

function api() { return API; }

// --- NAV & GUARD ---
(function(){
  const links = document.querySelectorAll('[data-view]');
  const views = document.querySelectorAll('.view');
  function activate(id){
    if (!checkAccess(id)) { if(id!=='home') showToast("Please login first", "warning"); activate('home'); return; }
    views.forEach(v => v.classList.remove('active'));
    const activeView = document.getElementById(id);
    if(activeView) activeView.classList.add('active');
    links.forEach(l => l.classList.toggle('active', l.getAttribute('href').replace('#','') === id));
  }
  links.forEach(a => a.addEventListener('click', (e)=>{ e.preventDefault(); activate(a.getAttribute('href').replace('#','')); }));
  const hash = window.location.hash.replace('#','');
  if(hash && document.getElementById(hash)) activate(hash); else activate('home');
})();

function checkAccess(id) {
    if (id === 'home') return true;
    if (isGuestMode) { return (id === 'booking' || id === 'browse' || id === 'my-bookings'); }
    if (token) { if (id === 'owner') return userRole === 'owner'; return true; }
    return false;
}

function updateUI() {
    const navServices = document.getElementById('nav-services');
    const navBooking = document.getElementById('nav-booking');
    const navHistory = document.getElementById('nav-history');
    const navOwner = document.getElementById('nav-owner');
    const navLogout = document.getElementById('nav-logout');
    
    [navServices, navBooking, navHistory, navOwner, navLogout].forEach(el => { if(el) el.style.display = 'none'; });

    if (isGuestMode) {
        if(navServices) navServices.style.display='block'; if(navBooking) navBooking.style.display='block';
        if(navLogout) { navLogout.style.display='block'; navLogout.textContent="Exit Guest Mode"; }
        document.getElementById('home-options').style.display='none'; document.getElementById('home-logged-in').style.display='none';
    } else if (token) {
        if(navServices) navServices.style.display='block'; if(navBooking) navBooking.style.display='block'; if(navHistory) navHistory.style.display='block';
        if(navLogout) { navLogout.style.display='block'; navLogout.textContent="Logout"; }
        if(userRole==='owner' && navOwner) navOwner.style.display='block';
        document.getElementById('home-options').style.display='none'; document.getElementById('home-logged-in').style.display='block';
    } else {
        document.getElementById('home-options').style.display='grid'; document.getElementById('home-logged-in').style.display='none';
    }
}

// --- INIT ---
function enableGuestMode() {
    isGuestMode=true; token=null; localStorage.removeItem('token'); userRole=null; updateUI();
    document.getElementById('guestFields').style.display='block';
    document.getElementById('bookingModeBadge').style.display='inline-block';
    document.querySelector('a[href="#booking"]').click();
    showToast("Guest Mode Activated!", "success");
}
function handleLogout() { token=null; localStorage.removeItem('token'); isGuestMode=false; userRole=null; window.location.href="/"; }

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('guest') === 'true') { isGuestMode=true; window.history.replaceState({}, document.title, "/"); }
    const statusEl = document.getElementById('status');
    if(token && statusEl) { statusEl.textContent="Logged in"; statusEl.className="badge success"; statusEl.style.display='inline-block'; }
    updateUI(); await populateBookingDropdowns();
    const dateInput = document.getElementById('bkSelectDate'); if(dateInput) dateInput.value = new Date().toISOString().split('T')[0];
});

// --- BOOKING ---
async function populateBookingDropdowns() {
    try {
        const resSvc = await fetch(api()+"/services/"); const services = await resSvc.json();
        document.getElementById('bkSelectService').innerHTML = '<option value="">-- Choose Service --</option>' + 
            services.map(s => `<option value="${s.id}" data-name="${s.name}" data-price="${s.price}">${s.name} ($${s.price})</option>`).join('');
        const resSt = await fetch(api()+"/stylists/"); const stylists = await resSt.json();
        document.getElementById('bkSelectStylist').innerHTML = '<option value="">-- Choose Stylist --</option>' + 
            stylists.map(s => `<option value="${s.id}" data-name="${s.display_name}">${s.display_name}</option>`).join('');
    } catch(e) {}
}

async function autoLoadSlots() {
    const sid = document.getElementById('bkSelectService').value;
    const stid = document.getElementById('bkSelectStylist').value;
    const date = document.getElementById('bkSelectDate').value;
    const slotsArea = document.getElementById('slotsArea'); const grid = document.getElementById('slotsGrid'); const msg = document.getElementById('slotsMsg');
    const actions = document.getElementById('bookingActions');
    document.getElementById('bkStart').value = ''; if(actions) actions.style.display = 'none';

    if (!sid || !stid || !date) { if(slotsArea) slotsArea.style.display = 'none'; return; }
    slotsArea.style.display = 'block'; grid.innerHTML = ''; msg.style.display = 'block'; msg.textContent = 'Checking availability...';

    try {
        const res = await fetch(`${api()}/bookings/availability?service_id=${sid}&date=${date}&stylist_id=${stid}`);
        const slots = await res.json();
        if (!slots.length) { msg.textContent = 'No slots available.'; return; }
        msg.style.display = 'none';
        slots.forEach(slot => {
            const timeLabel = new Date(slot.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            const btn = document.createElement('button');
            btn.type = 'button'; btn.className = 'time-chip'; btn.textContent = timeLabel;
            btn.style.margin="5px"; btn.style.padding="10px"; btn.style.border="1px solid #ccc"; btn.style.background="white"; btn.style.cursor="pointer";
            btn.onclick = () => selectTimeChip(btn, slot.start_time, timeLabel);
            grid.appendChild(btn);
        });
    } catch(e) { msg.textContent = 'Error loading slots.'; }
}

function selectTimeChip(element, isoTime, timeLabel) {
    document.querySelectorAll('.time-chip').forEach(el => { el.style.background="white"; el.style.color="black"; });
    element.style.background="#6366f1"; element.style.color="white";
    document.getElementById('bkStart').value = isoTime;
    document.getElementById('bkServiceId').value = document.getElementById('bkSelectService').value;
    document.getElementById('bkStylistId').value = document.getElementById('bkSelectStylist').value;
    
    const svcOpt = document.getElementById('bkSelectService').selectedOptions[0];
    const stOpt = document.getElementById('bkSelectStylist').selectedOptions[0];
    document.getElementById('sumService').textContent = svcOpt ? svcOpt.dataset.name : '';
    document.getElementById('sumStylist').textContent = stOpt ? stOpt.dataset.name : '';
    document.getElementById('sumTime').textContent = timeLabel;
    
    const actions = document.getElementById('bookingActions');
    if(actions) { actions.style.display = 'block'; actions.scrollIntoView({behavior:"smooth"}); }
}

async function submitStreamlinedBooking() {
    const start = document.getElementById('bkStart').value;
    if (!start) { showToast("Select time", "warning"); return; }
    const btn = document.querySelector('#booking button'); setLoading(btn, true);
    if (isGuestMode) await createGuestBookingLogic(); else await createUserBookingLogic();
    setLoading(btn, false);
}

async function createGuestBookingLogic() {
    const name = document.getElementById('bkGuestName').value;
    const email = document.getElementById('bkGuestEmail').value;
    const phone = document.getElementById('bkGuestPhone').value;
    if(!name || !email || !phone) { showToast("Missing Info", "error"); return; }
    
    const payload = {
        service_id: parseInt(document.getElementById('bkServiceId').value),
        stylist_id: parseInt(document.getElementById('bkStylistId').value),
        start_time: document.getElementById('bkStart').value,
        customer_name: name, customer_email: email, customer_phone: phone
    };
    try {
        const res = await fetch(api()+"/bookings/guest", { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
        const data = await res.json();
        if(res.ok) { showToast("Reserved! Proceed to payment.", "success"); preparePayment(data.id); }
        else showToast("Failed: "+data.detail, "error");
    } catch(e) { showToast("Error", "error"); }
}

async function createUserBookingLogic() {
    if(!token) { showToast("Login first", "warning"); return; }
    const payload = {
        service_id: parseInt(document.getElementById('bkServiceId').value),
        stylist_id: parseInt(document.getElementById('bkStylistId').value),
        start_time: document.getElementById('bkStart').value
    };
    try {
        const res = await fetch(api()+"/bookings/", { method:'POST', headers:{'Content-Type':'application/json', 'Authorization':'Bearer '+token}, body:JSON.stringify(payload)});
        const data = await res.json();
        if(res.ok) { showToast("Reserved! Proceed to payment.", "success"); loadMyBookings(); preparePayment(data.id); }
        else showToast("Failed", "error");
    } catch(e) { showToast("Error", "error"); }
}

// --- PAYMENTS ---
function preparePayment(id) {
    document.querySelector('a[href="#my-bookings"]').click();
    setTimeout(() => {
        const input = document.getElementById('payBookingId');
        if(input) { input.value = id; input.scrollIntoView({behavior:"smooth"}); }
        
        // Auto fill price
        const svcSelect = document.getElementById('bkSelectService');
        if(svcSelect && svcSelect.selectedIndex > 0) {
             const price = svcSelect.options[svcSelect.selectedIndex].text.match(/\$(\d+)/);
             if(price) document.getElementById('payAmount').value = price[1];
        }
    }, 100);
}

async function handlePayment(endpoint, btnText) {
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = "Processing..."; btn.disabled = true;
    
    try {
        const id = document.getElementById('payBookingId').value;
        const headers = { 'Content-Type': 'application/json' };
        if(token) headers['Authorization'] = 'Bearer ' + token;

        const res = await fetch(api()+`/bookings/${id}/${endpoint}`, {
            method: 'POST', headers: headers,
            body: JSON.stringify({
                amount: parseFloat(document.getElementById('payAmount').value) || 0,
                card_number: document.getElementById('payCard').value,
                expiry_month: 12, expiry_year: 2099, cvv: "123", cardholder_name: "Alice"
            })
        });

        const txt = await res.text();
        if(res.ok) {
            document.getElementById('payOut').innerHTML = `<span style="color:green; font-weight:bold;">${btnText} Successful! Booking Confirmed.</span>`;
            showToast("Success!", "success");
            if(token) loadMyBookings();
        } else {
            document.getElementById('payOut').textContent = "Error: " + txt;
            showToast("Failed", "error");
        }
    } catch(e) { showToast("Network Error", "error"); } 
    finally { btn.textContent = originalText; btn.disabled = false; }
}

function payFull() { handlePayment('pay', 'Full Payment'); }
function payDeposit() { handlePayment('pay-deposit', 'Deposit'); }

function showToast(msg, type='success'){ 
    let t = document.getElementById('toast'); if(!t){t=document.createElement('div');t.id='toast';t.className='toast';document.body.appendChild(t);}
    t.className='toast show '+type; t.textContent=msg; setTimeout(()=>t.className='toast',3000); 
}
function setLoading(btn, l){ if(btn){ if(l){btn.dataset.tx=btn.innerText;btn.innerText="..."}else{btn.innerText=btn.dataset.tx||"Submit"} btn.disabled=l; } }
async function loadMyBookings(){
    if(!token) return;
    try {
        const res = await fetch(api()+"/bookings/me", { headers:{'Authorization':'Bearer '+token} });
        const data = await res.json();
        document.getElementById('myBookingsList').innerHTML = data.length ? 
            `<table>${data.map(b=>`<tr><td>#${b.id}</td><td>${b.status}</td><td>${b.status==='pending'?`<button onclick="preparePayment(${b.id})">Pay</button>`:''}</td></tr>`).join('')}</table>` 
            : 'No bookings';
    } catch(e){}
}
async function listServices(){ const res=await fetch(api()+"/services/"); const d=await res.json(); document.getElementById('servicesList').innerHTML=d.map(s=>`<div class="card"><h4>${s.name}</h4><p>$${s.price}</p></div>`).join(''); }
async function listStylists(){ const res=await fetch(api()+"/stylists/"); const d=await res.json(); document.getElementById('stylistsList').innerHTML=d.map(s=>`<div class="stylist-card"><h4>${s.display_name}</h4></div>`).join(''); }
window.cancelBooking = async (id) => { if(confirm("Cancel?")) { await fetch(api()+`/bookings/${id}/cancel`, {method:'PUT', headers:{'Authorization':'Bearer '+token}}); loadMyBookings(); } };