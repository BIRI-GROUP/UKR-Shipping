/* Shared quotation rules. No production tariffs or confirmed route availability. */
(function (root, factory) {
  const rules = factory();
  if (typeof module === 'object' && module.exports) module.exports = rules;
  else root.UKRRules = rules;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const modes = ['compare', 'sea', 'air', 'road'];
  const cargoTypes = ['cartons', 'pallets', 'container', 'other'];
  function validNumber(value, min, max) {
    return value !== '' && Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max;
  }
  function localDate(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  function validateSearch(s, today = localDate()) {
    if (!s.origin || !s.destination) return 'Enter both the origin and destination.';
    if (s.origin.toLowerCase().trim() === s.destination.toLowerCase().trim()) return 'Choose a different origin and destination.';
    if (s.origin.length > 120 || s.destination.length > 120) return 'Keep each location under 120 characters.';
    const date = new Date(s.ready + 'T12:00:00');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.ready) || Number.isNaN(date.getTime()) || localDate(date) !== s.ready || s.ready < today) return 'Choose today or a future cargo-ready date.';
    if (!modes.includes(s.mode) || !cargoTypes.includes(s.cargoType)) return 'Choose a valid freight mode and cargo type.';
    if (!validNumber(s.weight, 0.01, 10000000)) return 'Enter a valid weight greater than zero.';
    if (s.cargoType !== 'container' && !validNumber(s.cbm, 0.01, 100000)) return 'Enter a valid volume greater than zero.';
    if (s.cargoType === 'container' && (!['20GP', '40GP', '40HC','45HC'].includes(s.containerSize) || !Number.isInteger(Number(s.containers)) || !validNumber(s.containers, 1, 100))) return 'Choose container equipment and a whole quantity from 1 to 100.';
    if (s.cargoType === 'container' && ['air', 'compare'].includes(s.mode)) return 'Full containers require sea or road service.';
    return '';
  }
  function options(s) {
    const offers = [];
    const add = (id, title, description, icon, priority) => offers.push({ id, title, description, icon, priority, status: 'REQUEST_ONLY' });
    if (s.mode === 'sea' || s.mode === 'compare') {
      if (s.cargoType === 'container') add('sea-fcl', 'Sea • Full container', `${s.containers} × ${s.containerSize} • Equipment and sailing to confirm`, '▰', 2);
      else {
        add('sea-smart', 'Sea • Smart', s.flex ? 'Flexible consolidation window requested' : 'Consolidated sea freight', '▰', 3);
        add('sea-priority', 'Sea • Priority', 'Request an earlier suitable sailing', '▰', 2);
      }
    }
    if (s.mode === 'air' || s.mode === 'compare') add('air', 'Air Cargo', 'Routing, chargeable weight and airline acceptance to confirm', '✈', 1);
    if (s.mode === 'road') add('road', 'Road Freight', 'Route, border requirements and vehicle to confirm', '▤', 2);
    return offers;
  }
  function margin(product, quantity, shipping, percent) {
    if (!validNumber(product, 0.01, 1e10) || !validNumber(quantity, 1, 1e10) || !Number.isInteger(Number(quantity)) || !validNumber(shipping, 0, 1e10) || !validNumber(percent, 0, 99.99)) throw new Error('Enter a positive product cost, a whole quantity, non-negative logistics cost and a margin below 100%.');
    const landed = Number(product) + Number(shipping) / Number(quantity);
    return { landed, selling: landed / (1 - Number(percent) / 100) };
  }
  function reviewFlags(details) {
    const flags = [];
    if (details.batteries) flags.push('Battery cargo: specification and transport acceptance need review.');
    if (details.dangerous) flags.push('Dangerous goods: classification, safety documents and carrier acceptance need review.');
    if (details.oversized) flags.push('Heavy or oversized cargo: lifting, dimensions and equipment need review.');
    if (!details.stackable) flags.push('Non-stackable cargo: space allocation may change the quotation.');
    if (details.scope === 'door') flags.push('Door delivery requested: duties, taxes, clearance and destination coverage must be confirmed in the formal quote.');
    return flags;
  }
  return { validateSearch, options, margin, reviewFlags, localDate };
});
