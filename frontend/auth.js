const API = 'http://localhost:8000';
function setStatus(ok){
  // noop for now
}
async function login(evt){
  evt && evt.preventDefault();
  const body = new URLSearchParams();
  body.append('username', document.getElementById('loginEmail').value);
  body.append('password', document.getElementById('loginPass').value);
  const res = await fetch(API+"/auth/login", { method:'POST', body });
  const txt = await res.text();
  document.getElementById('loginOut').textContent = txt;
  if(res.ok){
    const json = JSON.parse(txt);
    localStorage.setItem('token', json.access_token);
    alert('Login successful');
  } else {
    alert('Login failed');
  }
}
