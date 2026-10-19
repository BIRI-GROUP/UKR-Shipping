/* Company-level customer portal access. Only authorised staff can change it.
   The customer login is invitation-only; existing POS/customer records are never imported here. */
import {all,one,uuid,must,email,audit,optimistic} from './core.mjs';
import {requirePermission} from './rbac.mjs';

function requireAdmin(actor,action) {
  must(actor.kind==='staff',403,'access_denied');
  requirePermission(actor,'customers',action);
  must(actor.super || actor.grants.some(g=>g.module==='customers'&&g.action===action&&g.scope==='all'),403,'access_denied');
}

export async function portalEmailAllowed(db,address,now=Date.now()) {
  const row=await one(db,`
    SELECT (
      EXISTS(
        SELECT 1 FROM users u
        JOIN customers c ON c.user_id=u.id AND c.deleted_at IS NULL
        JOIN customer_memberships m ON m.customer_id=c.id AND m.deleted_at IS NULL
        JOIN customer_companies co ON co.id=m.customer_company_id
        WHERE u.email=$1 AND u.kind='customer' AND u.state IN ('pending','active')
          AND u.deleted_at IS NULL AND m.status IN ('active','pending')
          AND co.status='approved' AND co.portal_enabled=TRUE AND co.deleted_at IS NULL
      )
      OR EXISTS(
        SELECT 1 FROM customer_invitations i
        JOIN customer_companies co ON co.id=i.customer_company_id
        WHERE i.email=$1 AND i.status='pending' AND i.deleted_at IS NULL
          AND i.expires_at>$2 AND co.status='approved'
          AND co.portal_enabled=TRUE AND co.deleted_at IS NULL
      )
    ) AS allowed`,[address,new Date(now)]);
  return row?.allowed===true;
}

export async function listPortalCompanies(db,actor) {
  requireAdmin(actor,'view');
  return all(db,`
    SELECT co.id,co.legal_name,co.status,co.country_code,co.portal_enabled,
           co.portal_enabled_at,co.version,
           (SELECT u.email FROM customer_memberships m
            JOIN customers c ON c.id=m.customer_id JOIN users u ON u.id=c.user_id
            WHERE m.customer_company_id=co.id AND m.role='owner'
              AND m.deleted_at IS NULL AND m.status<>'disabled'
            ORDER BY m.created_at LIMIT 1) AS owner_email,
           (SELECT count(*)::int FROM customer_memberships m
            WHERE m.customer_company_id=co.id AND m.status='active'
              AND m.deleted_at IS NULL) AS active_members
    FROM customer_companies co WHERE co.deleted_at IS NULL
    ORDER BY co.legal_name,co.id LIMIT 500`);
}

export async function setPortalAccess(db,actor,companyId,data,now=Date.now()) {
  requireAdmin(actor,'edit');
  must(data&&typeof data.enabled==='boolean'&&Object.keys(data).every(k=>['enabled','version'].includes(k)),400,'invalid_input');
  const company=await one(db,'SELECT * FROM customer_companies WHERE id=$1 AND deleted_at IS NULL',[uuid(companyId)]);
  optimistic(company,data.version);
  must(!data.enabled||company.status==='approved',409,'company_not_approved');
  if(company.portal_enabled===data.enabled)return {id:company.id,enabled:company.portal_enabled,version:company.version};
  const updated=await one(db,`
    UPDATE customer_companies SET portal_enabled=$1,portal_enabled_at=$2,portal_enabled_by=$3,
      version=version+1,updated_at=$2
    WHERE id=$4 AND version=$5 RETURNING id,portal_enabled,version`,
    [data.enabled,new Date(now),actor.id,company.id,company.version]);
  must(updated,409,'record_changed');
  if(!data.enabled){
    // Revocation takes effect instantly and does not alter cargo, invoices or bookings.
    await db.query(`UPDATE sessions SET revoked_at=$2
      WHERE kind='customer' AND revoked_at IS NULL AND user_id IN (
        SELECT u.id FROM users u JOIN customers c ON c.user_id=u.id
        JOIN customer_memberships m ON m.customer_id=c.id
        WHERE m.customer_company_id=$1 AND m.deleted_at IS NULL)`,[company.id,new Date(now)]);
    await db.query(`UPDATE otp_codes SET invalidated_at=$2
      WHERE kind='customer' AND consumed_at IS NULL AND invalidated_at IS NULL
        AND email IN (
          SELECT u.email FROM users u JOIN customers c ON c.user_id=u.id
          JOIN customer_memberships m ON m.customer_id=c.id
          WHERE m.customer_company_id=$1 AND m.deleted_at IS NULL
          UNION SELECT i.email FROM customer_invitations i
          WHERE i.customer_company_id=$1 AND i.status='pending' AND i.deleted_at IS NULL)`,
      [company.id,new Date(now)]);
    await db.query(`UPDATE customer_invitations SET status='revoked',updated_at=$2
       WHERE customer_company_id=$1 AND status='pending' AND deleted_at IS NULL`,
      [company.id,new Date(now)]);
  }
  await audit(db,actor.id,'customer_company.portal_access_changed','customer_companies',company.id,
    {enabled:company.portal_enabled},{enabled:data.enabled});
  return {id:updated.id,enabled:updated.portal_enabled,version:updated.version};
}

export async function invitePortalCustomer(db,actor,companyId,data,now=Date.now()) {
  requireAdmin(actor,'edit');
  const address=email(data?.email);
  const role=data?.role||'staff';
  must(['staff','view_only'].includes(role),400,'invalid_role');
  must(Object.keys(data||{}).every(k=>['email','role'].includes(k)),400,'invalid_input');
  const company=await one(db,`SELECT id,legal_name FROM customer_companies
    WHERE id=$1 AND status='approved' AND portal_enabled=TRUE AND deleted_at IS NULL`,[uuid(companyId)]);
  must(company,409,'portal_not_enabled');
  const existing=await one(db,'SELECT id,kind,state FROM users WHERE email=$1 AND deleted_at IS NULL',[address]);
  must(!existing||existing.kind==='customer'&&existing.state!=='disabled',409,'account_unavailable');
  const other=await one(db,`SELECT m.id FROM customer_memberships m
    JOIN customers c ON c.id=m.customer_id JOIN users u ON u.id=c.user_id
    WHERE u.email=$1 AND m.customer_company_id<>$2 AND m.deleted_at IS NULL
      AND m.status<>'disabled'`,[address,company.id]);
  must(!other,409,'account_already_linked');
  const expires=new Date(now+7*86400000);
  const row=await one(db,`INSERT INTO customer_invitations
    (customer_company_id,email,member_role,expires_at,created_by)
    VALUES($1,$2,$3,$4,$5)
    ON CONFLICT(customer_company_id,email) DO UPDATE
      SET member_role=EXCLUDED.member_role,status='pending',
          expires_at=EXCLUDED.expires_at,created_by=EXCLUDED.created_by,
          deleted_at=NULL,updated_at=now()
    RETURNING id,expires_at`,[company.id,address,role,expires,actor.id]);
  await audit(db,actor.id,'customer_company.portal_invitation_created','customer_invitations',row.id,
    null,{company_id:company.id,email:address,role});
  // Staff shares the portal URL. The verified-email OTP is generated only at login,
  // and is sent by the configured production mail service, never in this response.
  return {id:row.id,email:address,expires_at:row.expires_at,emailSent:false,
    login_path:'/customer/'};
}
