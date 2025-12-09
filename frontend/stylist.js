const API = 'http://localhost:8000';
const token = localStorage.getItem('token');

if(!token) window.location.href = '/auth';

try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if(payload.role !== 'stylist') {
        alert('Access Denied. Stylists only.');
        window.location.href = '/';
    }
} catch(e) { window.location.href = '/auth'; }
async function loadSchedule() {
    const container = document.getElementById('scheduleTable');
    container.innerHTML = '<p class="text-muted">Updating...</p>';

    try {
        const res = await fetch(`${API}/bookings/stylist-schedule`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if(!res.ok) throw new Error('Failed to load');
        
        const bookings = await res.json();
        
        if(bookings.length === 0) {
            container.innerHTML = '<p class="text-muted">No bookings assigned yet.</p>';
            return;
        }

        let html = `<table>
            <thead>
                <tr>
                    <th>Time</th>
                    <th>Customer</th>
                    <th>Service ID</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>`;
            
        bookings.forEach(bk => {
            const date = new Date(bk.start_time);
            const timeStr = date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            const dateStr = date.toLocaleDateString();
            
            let statusClass = 'badge pending';
            if(bk.status === 'confirmed') statusClass = 'badge confirmed';
            else if(bk.status === 'cancelled') statusClass = 'badge cancelled';

            const customerInfo = bk.is_walkin 
                ? `<strong>${bk.customer_name}</strong> (Walk-in)` 
                : (bk.customer_name || `User #${bk.customer_id}`);

            html += `
                <tr>
                    <td>
                        <div style="font-weight:600;">${timeStr}</div>
                        <div style="font-size:0.85em; color:#666;">${dateStr}</div>
                    </td>
                    <td>${customerInfo}</td>
                    <td>#${bk.service_id}</td>
                    <td><span class="${statusClass}">${bk.status}</span></td>
                </tr>
            `;
        });
        
        html += '</tbody></table>';
        container.innerHTML = html;

    } catch(e) {
        container.innerHTML = '<p style="color:red">Error loading schedule.</p>';
    }
}

function logout() {
    localStorage.removeItem('token');
    window.location.href = '/auth';
}

document.addEventListener('DOMContentLoaded', loadSchedule);