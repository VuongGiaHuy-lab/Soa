const API = 'http://localhost:8000';
async function listServices(){
  const res = await fetch(API+"/services/");
  document.getElementById('servicesList').textContent = await res.text();
}
