export const modules = {
  leads: { label: 'Leads & CRM', states: ['New', 'Contacted', 'Qualified', 'Quoting', 'Won', 'Lost'] },
  quotes: { label: 'Quotation work', states: ['Draft', 'Review required', 'Approved', 'Sent', 'Accepted', 'Declined'] },
  shipments: { label: 'Shipment work', states: ['Planned', 'Booked', 'Origin handling', 'In transit', 'Arrived', 'Delivered', 'Closed'] },
  warehouse: { label: 'China warehouse', states: ['Expected', 'Received', 'Measured', 'Ready to consolidate', 'Loaded', 'Released'] },
  customs: { label: 'Customs clearance', states: ['Documents needed', 'Under review', 'Submitted', 'Hold', 'Released'] },
  transport: { label: 'Transport & dispatch', states: ['Unassigned', 'Scheduled', 'Picked up', 'Out for delivery', 'Delivered', 'POD received'] },
  finance: { label: 'Finance work', states: ['Draft', 'Review required', 'Approved', 'Recorded', 'Reconciled'] }
};
const own = { read: 'assigned', write: 'assigned', create: true, approve: false };
const team = { read: 'all', write: 'all', create: true, approve: true };
const view = { read: 'assigned' };
const allView = { read: 'all' };
export const roles = {
  super_admin: { name: 'Super Admin', purpose: 'Manage staff, access, audit history and all work queues.', grants: Object.fromEntries(Object.keys(modules).map(k => [k, team])), users: true, audit: true },
  management: { name: 'Management', purpose: 'Read company-wide work queues and audit activity; no user or record changes.', grants: Object.fromEntries(Object.keys(modules).map(k => [k, allView])), audit: true },
  sales_manager: { name: 'Sales Manager', purpose: 'Manage sales leads and quotation work; approve quotation work and view shipment progress.', grants: { leads: team, quotes: team, shipments: allView } },
  sales: { name: 'Sales', purpose: 'Create and follow assigned leads and quotation work; view assigned shipment progress.', grants: { leads: own, quotes: own, shipments: view } },
  operations_manager: { name: 'Operations Manager', purpose: 'Manage shipment, warehouse, customs and transport queues.', grants: { shipments: team, warehouse: team, customs: team, transport: team } },
  operations: { name: 'Operations', purpose: 'Update assigned shipment work; read linked departmental assignments.', grants: { shipments: own, warehouse: view, customs: view, transport: view } },
  china_manager: { name: 'China Manager', purpose: 'Manage warehouse receipts and loading work; view assigned shipments.', grants: { warehouse: team, shipments: view } },
  china_warehouse: { name: 'China Warehouse', purpose: 'Receive, measure and update assigned warehouse/loading work.', grants: { warehouse: own } },
  customs: { name: 'Customs', purpose: 'Update assigned clearance work and view assigned shipments.', grants: { customs: own, shipments: view } },
  transport_manager: { name: 'Transport Manager', purpose: 'Manage transport jobs and dispatch assignments; view assigned shipments.', grants: { transport: team, shipments: view } },
  dispatcher: { name: 'Dispatcher', purpose: 'Update assigned pickup, delivery and POD work.', grants: { transport: own } },
  finance_manager: { name: 'Finance Manager', purpose: 'Manage and approve finance work; view quotation work.', grants: { finance: team, quotes: allView } },
  accounts: { name: 'Accounts', purpose: 'Prepare and update assigned finance work; approval remains with a manager.', grants: { finance: own } }
};
export function can(user, action, module, item) {
  const role = roles[user?.role]; if (!role || !user.active) return false;
  if (['users', 'audit'].includes(action)) return !!role[action];
  const grant = role.grants[module]; if (!grant) return false;
  if (action === 'create' || action === 'approve') return !!grant[action];
  const scope = grant[action];
  return scope === 'all' || (scope === 'assigned' && item?.assignee_id === user.id);
}
Object.setPrototypeOf(roles, null);
Object.setPrototypeOf(modules, null);
export function accessDescription(role) {
  return Object.entries(roles[role].grants).map(([key, grant]) => ({ key, label: modules[key].label, states: modules[key].states, read: grant.read, write: grant.write || false, create: !!grant.create, approve: !!grant.approve }));
}
