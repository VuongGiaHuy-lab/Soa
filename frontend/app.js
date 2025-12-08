// frontend/app.js (Cập nhật các hàm bên dưới, giữ nguyên phần đầu)

// ... (SPA Navigation, Utils, Auth, Services, Stylists giữ nguyên) ...

// --- BOOKING LOGIC ---
// ... (checkAvailability giữ nguyên) ...

// 1. Cập nhật createGuestBooking
async function createGuestBooking() {
    const btn = document.querySelector('#booking button[type="submit"]');
    setLoading(btn, true, "Reserving...");
    
    const name = document.getElementById('bkGuestName').value;
    const email = document.getElementById('bkGuestEmail').value;

    if(!name || !email) {
        showToast("Guest must provide Name and Email", "error");
        setLoading(btn, false);
        return;
    }

    try {
        const payload = {
            service_id: parseInt(document.getElementById('bkServiceId').value),
            stylist_id: parseInt(document.getElementById('bkStylistId').value),
            start_time: document.getElementById('bkStart').value,
            customer_name: name,
            customer_email: email
        };

        const res = await fetch(api()+"/bookings/guest", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        
        const data = await res.json();
        
        if(res.ok) {
            showToast("Reserved! Please pay to confirm.", "warning"); // Màu vàng cảnh báo
            // Tự động điền ID vào form thanh toán và cuộn tới đó
            preparePayment(data.id); 
        } else {
            showToast("Booking Failed: " + (data.detail || "Error"), "error");
        }

    } catch(e) {
        showToast("Network error", "error");
    } finally {
        setLoading(btn, false);
    }
}

// 2. Cập nhật createUserBooking
async function createUserBooking() {
    if(!token) return showToast("Please login first or use Guest Mode", "error");
    const btn = document.querySelector('#booking button[type="submit"]');
    setLoading(btn, true, "Reserving...");

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
        const data = await res.json();
        
        if(res.ok) {
            showToast("Reserved! Please pay to confirm.", "warning");
            loadMyBookings(); 
            // Chuyển sang tab My Bookings hoặc Payment
            preparePayment(data.id);
        } else {
            showToast("Booking failed: " + (data.detail || "Error"), "error");
        }
    } finally { setLoading(btn, false); }
}

// Hàm hỗ trợ: Điền thông tin vào form thanh toán và chuyển view
function preparePayment(bookingId) {
    // Chuyển sang view My Bookings (nơi có form thanh toán)
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('my-bookings').classList.add('active');
    
    // Điền ID
    document.getElementById('payBookingId').value = bookingId;
    
    // Scroll xuống form thanh toán
    document.getElementById('payBookingId').scrollIntoView({behavior: "smooth"});
    showToast("Enter card details to confirm Booking #" + bookingId, "info");
}

// --- MY BOOKINGS (Cập nhật hiển thị nút Pay) ---
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

        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.innerHTML = `
            <tr style="background:#eee; text-align:left;">
                <th style="padding:8px;">ID</th>
                <th>Service</th>
                <th>Time</th>
                <th>Status</th>
                <th>Action</th>
            </tr>
        `;
        
        data.forEach(bk => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #ddd';
            
            // Logic hiển thị Badge trạng thái
            let statusColor = '#fee2e2'; // Red (Cancel/Failed)
            let statusText = '#991b1b';
            if (bk.status === 'confirmed') { statusColor = '#d1fae5'; statusText = '#065f46'; } // Green
            else if (bk.status === 'pending') { statusColor = '#fef3c7'; statusText = '#92400e'; } // Yellow
            
            // Logic nút Action
            let actionHtml = '-';
            if (bk.status === 'pending') {
                // Nút Pay cho Pending
                actionHtml = `
                    <button onclick="preparePayment(${bk.id})" style="background:#f59e0b; color:white; padding:4px 8px; font-size:0.8em; border:none; border-radius:4px; cursor:pointer; margin-right:4px;">Pay</button>
                    <button onclick="cancelBooking(${bk.id})" style="background:#ef4444; color:white; padding:4px 8px; font-size:0.8em; border:none; border-radius:4px; cursor:pointer;">Cancel</button>
                `;
            } else if (bk.status === 'confirmed') {
                actionHtml = `<button onclick="cancelBooking(${bk.id})" style="background:#ef4444; color:white; padding:4px 8px; font-size:0.8em; border:none; border-radius:4px; cursor:pointer;">Cancel</button>`;
            }

            tr.innerHTML = `
                <td style="padding:8px;">#${bk.id}</td>
                <td>${bk.service_id}</td>
                <td>${new Date(bk.start_time).toLocaleString()}</td>
                <td>
                    <span style="
                        padding:2px 6px; border-radius:4px; font-size:0.8em;
                        background:${statusColor}; color:${statusText}; font-weight:bold;
                    ">${bk.status.toUpperCase()}</span>
                </td>
                <td>${actionHtml}</td>
            `;
            table.appendChild(tr);
        });
        container.appendChild(table);
        
    } catch(e) {
        document.getElementById('myBookingsList').textContent = "Error loading bookings.";
    }
}

// ... (Các hàm cancelBooking, payBooking, createService giữ nguyên) ...
// (Lưu ý: payBooking cần cập nhật UI nếu thành công thì reload list để thấy trạng thái chuyển sang Confirmed)

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
      
      if(res.ok) {
          showToast("Payment Successful! Booking Confirmed.", "success");
          loadMyBookings(); // Tải lại danh sách để thấy status đổi thành CONFIRMED
      }
      else showToast("Payment Failed: " + txt, "error");
      
  } catch(e) {
      showToast("Network Error", "error");
  } finally { setLoading(btn, false); }
}