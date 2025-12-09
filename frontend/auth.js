const API = document.getElementById('apiBase') ? document.getElementById('apiBase').value : 'http://localhost:8000';

function showToast(msg, type='success'){
    let t = document.getElementById('toast'); if(!t){t=document.createElement('div');t.id='toast';t.className='toast';document.body.appendChild(t);}
    t.className='toast show '+type; t.textContent=msg; setTimeout(()=>t.className='toast',3000);
}

function setLoading(btn, loading){ if(loading){btn.disabled=true;btn.textContent="...";}else{btn.disabled=false;btn.textContent="Submit";} }

function continueAsGuest(){ localStorage.removeItem('token'); window.location.href="/?guest=true"; }

async function login(evt){
    evt.preventDefault();
    const btn=evt.target.querySelector('button'); setLoading(btn,true);
    try{
        const body = new URLSearchParams();
        body.append('username', document.getElementById('loginEmail').value);
        body.append('password', document.getElementById('loginPass').value);
        const res = await fetch(API+"/auth/login", { method:'POST', body });
        const txt = await res.text();
        
        if(res.ok){
            const json = JSON.parse(txt);
            localStorage.setItem('token', json.access_token);
            
            const payload = JSON.parse(atob(json.access_token.split('.')[1]));
            const role = payload.role;

            showToast("Login Success! Redirecting...", "success");
            
            setTimeout(() => {
                if (role === 'owner') window.location.href = "/frontend/admin.html";
                else if (role === 'stylist') window.location.href = "/stylist-portal";
                else window.location.href = "/";
            }, 1000);

        } else {
            let msg = "Failed";
            try { msg = JSON.parse(txt).detail; } catch(e){}
            showToast("Login Failed: " + msg, "error");
        }
    } catch(e){ showToast("Network Error", "error"); }
    finally{ setLoading(btn,false); }
}

async function register(evt){
    evt.preventDefault();
    const btn=evt.target.querySelector('button'); setLoading(btn,true);
    const payload={
        email: document.getElementById('regEmail').value,
        full_name: document.getElementById('regName').value,
        password: document.getElementById('regPass').value
    };
    const res = await fetch(API+"/auth/register", { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
    if(res.ok) { showToast("Registered! Please Login."); setTimeout(()=>window.location.href="/auth",1500); }
    else showToast("Failed", "error");
    setLoading(btn,false);
}