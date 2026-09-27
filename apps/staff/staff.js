'use strict';
const $ = id => document.getElementById(id);
let me = null, csrf = '', activeModule = '', editing = null, accessModel = [];
const fragment = new URLSearchParams(location.hash.slice(1));
let activationToken = fragment.get('setup') || fragment.get('invite') || fragment.get('reset') || '';
let authMode = fragment.has('setup') ? 'setup' : fragment.has('invite') ? 'invite' : fragment.has('reset') ? 'reset' : 'login';
if (activationToken) history.replaceState(null, '', location.pathname);
const element = (tag, text, className) => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (className) e.className = className; return e; };
const show = (id, value = true) => $(id).classList.toggle('hidden', !value);
function button(text, callback, className = 'secondary') { const b = element('button', text, className); b.type = 'button'; b.addEventListener('click', () => Promise.resolve(callback()).catch(report)); return b; }
function report(error) { $(me ? 'appError' : 'authError').textContent = error.message || 'Please try again.'; }
async function api(path, method = 'GET', data) {
  const response = await fetch('/api' + path, { method, credentials: 'same-origin', headers: { ...(data ? { 'Content-Type': 'application/json' } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) });
  const result = await response.json();
  if (!response.ok) { if (response.status === 401 && me) signedOut(); throw new Error(result.error || 'Please try again.'); }
  return result;
}
function signedOut() { me = null; csrf = ''; $('workspaceContent').replaceChildren(); show('appView', false); show('loginView'); $('authPassword').value = ''; }
function configureAuth() {
  const activating = authMode !== 'login';
  $('authTitle').textContent = authMode === 'setup' ? 'Set up the owner account' : authMode === 'invite' ? 'Activate your staff account' : authMode === 'reset' ? 'Reset your password' : 'Welcome back';
  $('authDescription').textContent = activating ? 'Use the email linked to your invitation and choose your own password.' : 'Sign in with your UKR staff account.';
  $('authSubmit').textContent = activating ? 'Create my password →' : 'Sign in →';
  $('authPassword').autocomplete = activating ? 'new-password' : 'current-password';
  show('setupNameField', authMode === 'setup'); $('authName').required = authMode === 'setup'; show('passwordHelp', activating);
}
$('authForm').addEventListener('submit', async event => {
  event.preventDefault(); $('authError').textContent = ''; $('authSubmit').disabled = true;
  try {
    const result = await api(authMode === 'setup' ? '/setup' : authMode === 'invite' ? '/accept-invite' : authMode === 'reset' ? '/reset-password' : '/login', 'POST', { name: $('authName').value, email: $('authEmail').value, password: $('authPassword').value, token: activationToken });
    $('authPassword').value = '';
    if (authMode !== 'login') { authMode = 'login'; activationToken = ''; configureAuth(); $('connectionNotice').textContent = result.message; show('connectionNotice'); }
    else { csrf = result.csrf; await enterWorkspace(); }
  } catch (error) { report(error); } finally { $('authSubmit').disabled = false; }
});
async function openAccess() {
  if (!accessModel.length) accessModel = (await api('/access-model')).roles;
  $('accessList').replaceChildren();
  for (const role of accessModel) {
    const card = element('article', undefined, 'access-card'); card.append(element('h3', role.name), element('p', role.purpose));
    const list = element('ul');
    for (const grant of role.modules) list.append(element('li', `${grant.label}: ${grant.write ? (grant.write === 'all' ? 'manage department' : 'update assigned work') : (grant.read === 'all' ? 'view department' : 'view assigned work')}${grant.approve ? '; approve' : ''}`));
    card.append(list); $('accessList').append(card);
  }
  $('accessDialog').showModal();
}
$('showAccess').addEventListener('click', () => openAccess().catch(report));
$('closeAccess').addEventListener('click', () => $('accessDialog').close());
$('closeWork').addEventListener('click', () => $('workDialog').close());
$('logoutButton').addEventListener('click', async () => { try { await api('/logout', 'POST', {}); signedOut(); } catch (e) { report(e); } });
async function enterWorkspace() {
  me = await api('/me'); csrf = me.csrf;
  $('staffName').textContent = me.user.name; $('staffRole').textContent = me.user.roleName;
  show('loginView', false); show('appView');
  const nav = $('staffNav'); nav.replaceChildren();
  const add = (label, key, action) => { const b = button(label, async () => { $('appError').textContent = ''; $('appSuccess').textContent = ''; nav.querySelectorAll('button').forEach(x => x.classList.remove('active')); b.classList.add('active'); await action(); }, ''); b.dataset.page = key; nav.append(b); };
  add('Overview', 'overview', dashboard);
  for (const module of me.modules) add(module.label, module.key, () => queue(module.key));
  if (me.canManageUsers) add('Staff & invitations', 'users', usersPage);
  if (me.canReadAudit) add('Audit trail', 'audit', auditPage);
  add('My access', 'access', accessPage);
  add('Password', 'password', passwordPage);
  nav.querySelector('button').classList.add('active'); await dashboard();
}
function page(title) { $('pageTitle').textContent = title; $('workspaceContent').replaceChildren(); return $('workspaceContent'); }
function panel(title, copy) { const p = element('section', undefined, 'panel'); p.append(element('h2', title)); if (copy) p.append(element('p', copy, 'helper')); return p; }
async function dashboard() {
  const content = page('My workspace'); const all = await Promise.all(me.modules.map(m => api('/work?module=' + m.key)));
  const records = all.flatMap(x => x.items), assigned = records.filter(r => r.assignee_id === me.user.id);
  const stats = element('div', undefined, 'stats');
  for (const [label, count] of [['Accessible queues', me.modules.length], ['Work I can see', records.length], ['Assigned to me', assigned.length]]) { const p = element('div', undefined, 'stat'); p.append(element('strong', String(count)), element('span', label)); stats.append(p); }
  content.append(stats);
  const welcome = panel(`Welcome, ${me.user.name}`, 'Review your assignments, update progress and keep your team informed.');
  welcome.append(element('p', me.user.roleName, 'pill')); content.append(welcome);
  const next = panel('Start with your department', 'Choose a queue to review your work and follow up on outstanding tasks.');
  me.modules.forEach(m => next.append(button(m.label, () => queue(m.key)))); content.append(next);
}
async function queue(key) {
  activeModule = key; const grant = me.modules.find(m => m.key === key); if (!grant) return;
  const content = page(grant.label); const result = await api('/work?module=' + key);
  const heading = element('div', undefined, 'queue-head'); heading.append(element('p', grant.read === 'all' ? 'Department work visible to your role' : 'Only work assigned to you'));
  if (grant.create) heading.append(button('＋ New work item', () => openWork(), 'primary')); content.append(heading);
  if (!result.items.length) { content.append(element('p', 'No work items yet. New assignments will appear here.', 'empty')); return; }
  const list = element('div', undefined, 'work-list');
  for (const item of result.items) {
    const card = element('article', undefined, 'work-card'), copy = element('div');
    copy.append(element('span', item.status, 'pill'), element('h3', item.title), element('p', item.reference || 'No reference added'));
    if (item.note) copy.append(element('p', item.note)); card.append(copy);
    if (grant.write) card.append(button('Open / update', () => openWork(item)));
    list.append(card);
  }
  content.append(list);
}
async function openWork(item = null) {
  editing = item; const grant = me.modules.find(m => m.key === activeModule);
  $('workTitle').textContent = item ? 'Update work item' : `New ${grant.label.toLowerCase()} item`;
  $('workName').value = item?.title || ''; $('workReference').value = item?.reference || ''; $('workNote').value = item?.note || ''; $('workError').textContent = '';
  $('workStatus').replaceChildren();
  for (const state of grant.states) { const o = element('option', state); o.value = state; if (!grant.approve && ['Approved', 'Sent', 'Accepted', 'Recorded', 'Reconciled'].includes(state)) o.disabled = true; $('workStatus').append(o); }
  $('workStatus').value = item?.status || grant.states[0];
  const assignees = (await api('/assignees?module=' + activeModule)).users; $('workAssignee').replaceChildren();
  for (const user of assignees) { const o = element('option', user.name); o.value = user.id; $('workAssignee').append(o); }
  $('workAssignee').value = item?.assignee_id || me.user.id;
  $('workDialog').showModal();
}
$('workForm').addEventListener('submit', async event => {
  event.preventDefault(); const submit = event.submitter; submit.disabled = true; $('workError').textContent = '';
  try { await api(editing ? '/work/' + editing.id : '/work', editing ? 'PATCH' : 'POST', { module: activeModule, title: $('workName').value, reference: $('workReference').value, note: $('workNote').value, status: $('workStatus').value, assignee_id: $('workAssignee').value, version: editing?.version }); $('workDialog').close(); await queue(activeModule); $('appSuccess').textContent = 'Work item saved. The change was added to the audit trail.'; }
  catch (error) { $('workError').textContent = error.message; } finally { submit.disabled = false; }
});
function roleSelect(value) { const s = element('select'); for (const role of accessModel) { const o = element('option', role.name); o.value = role.id; s.append(o); } s.value = value; return s; }
async function usersPage() {
  const content = page('Staff & invitations'); if (!accessModel.length) accessModel = (await api('/roles')).roles;
  const users = (await api('/users')).users;
  const invite = panel('Invite an employee', 'Choose a role before creating a private activation link. The employee chooses their own password.');
  const form = element('form');
  form.innerHTML = '<div class="form-grid"><div><label for="inviteName">Employee name</label><input id="inviteName" required maxlength="100"></div><div><label for="inviteEmail">Work email</label><input id="inviteEmail" type="email" required maxlength="254"></div></div><label for="inviteRole">Access level</label><div id="roleSlot"></div><p class="helper">Super Admin can manage all staff and permissions. Assign it only to trusted owners.</p><button type="submit" class="primary">Create invitation link</button><p id="inviteError" class="error" role="alert"></p><div id="inviteResult"></div>';
  const select = roleSelect('sales'); select.id = 'inviteRole'; form.querySelector('#roleSlot').append(select);
  form.addEventListener('submit', async e => { e.preventDefault(); const submit = e.submitter; submit.disabled = true; $('inviteError').textContent = ''; try { const result = await api('/invites', 'POST', { name: $('inviteName').value, email: $('inviteEmail').value, role: select.value }); $('inviteResult').replaceChildren(element('p', result.message, 'notice')); const field = element('textarea', undefined, 'private-link'); field.readOnly = true; field.value = result.link; field.setAttribute('aria-label', 'Private activation link'); $('inviteResult').append(field); } catch (error) { $('inviteError').textContent = error.message; } finally { submit.disabled = false; } });
  invite.append(form); content.append(invite);
  const p = panel('Staff accounts', 'Changing a role or disabling an account ends that employee’s existing sessions.'); const wrap = element('div', undefined, 'table-wrap'), table = element('table');
  table.innerHTML = '<thead><tr><th>Employee</th><th>Access level</th><th>Account</th><th>Action</th></tr></thead>'; const tbody = element('tbody');
  for (const user of users) { const row = element('tr'), identity = element('td'); identity.append(element('strong', user.name), element('p', user.email)); const roleCell = element('td'), role = roleSelect(user.role); role.setAttribute('aria-label', `Role for ${user.name}`); roleCell.append(role); const activeCell = element('td'), active = element('select'); for (const [v, label] of [['1', 'Active'], ['0', 'Disabled']]) { const o = element('option', label); o.value = v; active.append(o); } active.value = user.active ? '1' : '0'; active.setAttribute('aria-label', `Status for ${user.name}`); activeCell.append(active); const action = element('td'); action.append(button('Save access', async () => { await api('/users/' + user.id, 'PATCH', { role: role.value, active: active.value === '1' }); if (user.id === me.user.id) { signedOut(); $('authError').textContent = 'Your access changed. Please sign in again.'; } else { $('appSuccess').textContent = 'Access updated and existing sessions revoked.'; await usersPage(); } })); row.append(identity, roleCell, activeCell, action); tbody.append(row); }
  table.append(tbody); wrap.append(table); p.append(wrap); content.append(p);
  for (const [index, user] of users.entries()) {
    if (!user.active) continue;
    tbody.children[index].lastElementChild.append(button('Password reset link', async () => {
      const result = await api('/users/' + user.id + '/reset', 'POST', {});
      const output = panel('Reset password for ' + user.name, result.message);
      const field = element('textarea', undefined, 'private-link'); field.readOnly = true; field.value = result.link;
      field.setAttribute('aria-label', 'Private password reset link'); output.append(field); content.prepend(output);
    }));
  }
}
async function auditPage() {
  const content = page('Audit trail'), result = await api('/audit'), p = panel('Recent activity', 'The most recent 100 access and work changes. Passwords and activation links are not recorded here.');
  const wrap = element('div', undefined, 'table-wrap'), table = element('table'); table.innerHTML = '<thead><tr><th>When</th><th>Employee</th><th>Action</th><th>Details</th></tr></thead>'; const body = element('tbody');
  result.events.forEach(event => { const row = element('tr'); [new Date(Number(event.created_at)).toLocaleString(), event.actor_name || 'System', event.action, event.detail || event.target].forEach(value => row.append(element('td', value))); body.append(row); }); table.append(body); wrap.append(table); p.append(wrap); content.append(p);
}
function accessPage() {
  const content = page('My access'), p = panel(me.user.roleName, 'Access below is granted to your current staff account. Role changes take effect on the server.');
  for (const m of me.modules) p.append(element('p', `${m.label}: ${m.write ? 'update ' + (m.write === 'all' ? 'department work' : 'assigned work') : 'view ' + (m.read === 'all' ? 'department work' : 'assigned work')}${m.approve ? '; manager approval permitted' : ''}`, 'notice'));
  if (me.canManageUsers) p.append(element('p', 'Manage staff accounts, invitations and role assignments.', 'notice'));
  content.append(p, button('View all access levels', openAccess));
}
function passwordPage() {
  const content = page('Change password'), p = panel('Your account password', 'Changing your password signs out every active session.'); const form = element('form', undefined, 'security-form');
  form.innerHTML = '<label for="currentPassword">Current password</label><input id="currentPassword" type="password" required autocomplete="current-password"><label for="newPassword">New password</label><input id="newPassword" type="password" required minlength="12" maxlength="128" autocomplete="new-password"><button type="submit" class="primary">Change password & sign out</button>';
  form.addEventListener('submit', async e => { e.preventDefault(); e.submitter.disabled = true; try { const result = await api('/password', 'POST', { currentPassword: $('currentPassword').value, password: $('newPassword').value }); signedOut(); $('connectionNotice').textContent = result.message; show('connectionNotice'); } catch (error) { report(error); e.submitter.disabled = false; } }); p.append(form); content.append(p);
}
async function start() {
  configureAuth();
  const status = await api('/status');
  if (!status.ready) { $('connectionNotice').textContent = 'The staff workspace is built. Sign-in will activate when its dedicated UKR database is connected. You can explore the access levels below.'; show('connectionNotice'); $('authSubmit').disabled = true; return; }
  if (authMode === 'login') { try { await enterWorkspace(); } catch (error) { if (!error.message.includes('sign in')) report(error); } }
}
start().catch(report);
