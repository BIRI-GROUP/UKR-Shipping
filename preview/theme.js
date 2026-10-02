'use strict';
// Preview-only visual interactions. No HTTP API calls or persistent customer storage.
document.querySelectorAll('[data-mode]').forEach(link => link.addEventListener('click', () => {
  chooseService(link.dataset.mode);
  setTimeout(() => document.getElementById('bookingShell').scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'}), 0);
}));
document.getElementById('serviceTabs').addEventListener('click', event => {
  const tab = event.target.closest('[role="tab"]');
  if (tab && matchMedia('(max-width:980px)').matches) {
    const container = document.getElementById('serviceTabs');
    container.scrollTo({left:tab.offsetLeft - container.offsetLeft - 16,behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});
  }
});
// Give the icon-only mobile tracking button an accessible name.
document.getElementById('trackOpen').setAttribute('aria-label', 'Track shipment');
