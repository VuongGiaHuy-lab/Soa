const API = 'http://localhost:8000';
async function register(evt){
  evt && evt.preventDefault();
  const res = await fetch(API+"/auth/register", {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      email: document.getElementById('regEmail').value,
      full_name: document.getElementById('regName').value,
      password: document.getElementById('regPass').value,
    }),
  });
  document.getElementById('regOut').textContent = await res.text();
}
