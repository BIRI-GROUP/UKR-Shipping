// Keep login availability truthful; no authentication tokens or personal data are read.
document.addEventListener('DOMContentLoaded',async()=>{
 try{
  const response=await fetch('/api/portal/status',{credentials:'same-origin',cache:'no-store'});
  if(!response.ok)return;
  const state=await response.json();
  if(!state.signInAvailable){
   const notice=document.getElementById('authMessage');
   const source=state.emailDeliveryConfigured?'Service unavailable. Please contact UKR.':'Email delivery is not configured. Contact UKR.';
   if(notice){notice.dataset.t=source;notice.textContent=window.UKRPortal?.t(source)||source;}
   document.querySelector('#loginForm button[type=submit]')?.setAttribute('disabled','');
  }
 }catch{}
},{once:true});
