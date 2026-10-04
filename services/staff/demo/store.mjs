/** Public demonstration data only. Never connects portal requests to operational tables. */
import {randomUUID} from 'node:crypto';
import {openDatabase, migrate, requireSchema} from '../phase1/db.mjs';
import {one} from '../phase1/core.mjs';
export const schema = 'ukr_username_demo_v1';
export const marker = 'UKR_PUBLIC_DEMONSTRATION_NO_REAL_DATA_V1';
export const identities = Object.freeze({admin: 'admin@ukr.test', customer: 'customer@ukr.test'});
export async function openDemoStore(connectionString) {
  const provision = await openDatabase(connectionString);
  try { await provision.tx(async db => {
    await db.query('CREATE SCHEMA IF NOT EXISTS '+schema);
    const tables = (await db.query('SELECT tablename FROM pg_tables WHERE schemaname=$1',[schema])).rows;
    if(tables.length && !tables.some(t=>t.tablename==='demo_identity')) throw Error('Non-demo schema must not be reused');
    await db.query(`CREATE TABLE IF NOT EXISTS ${schema}.demo_identity (id INTEGER PRIMARY KEY CHECK(id=1), marker TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    await db.query(`INSERT INTO ${schema}.demo_identity(id,marker) VALUES(1,$1) ON CONFLICT DO NOTHING`,[marker]);
    if((await one(db,`SELECT marker FROM ${schema}.demo_identity WHERE id=1`)).marker!==marker)throw Error('Demo isolation marker mismatch');
  }); } finally { await provision.close(); }
  const pool = await openDatabase(connectionString,{max:3, options:'-c search_path='+schema+',pg_catalog'});
  // Guard every transaction. SQL identifiers are never provided by a browser.
  const store = {...pool, tx: fn => pool.tx(async db=>{
    if((await one(db,'SELECT current_schema() AS name')).name!==schema)throw Error('Wrong demo SQL scope');
    return fn(db);
  })};
  try {
    await migrate(store); await requireSchema(store);
    await store.tx(async db=>{
      await db.query(`CREATE TABLE IF NOT EXISTS demo_sessions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), token_hash CHAR(64) NOT NULL UNIQUE, user_id UUID NOT NULL REFERENCES users(id), kind TEXT NOT NULL CHECK(kind IN ('staff','customer')), csrf TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), expires_at TIMESTAMPTZ NOT NULL)`);
      await db.query('CREATE INDEX IF NOT EXISTS demo_sessions_expiry ON demo_sessions(expires_at)');
      await db.query(`CREATE TABLE IF NOT EXISTS demo_limits (key CHAR(64) PRIMARY KEY, hits INTEGER NOT NULL, expires_at TIMESTAMPTZ NOT NULL)`);
      const legacyId=randomUUID();
      await db.query("INSERT INTO staff_users(id,email,name,role,password_hash,active,created_at) VALUES($1,$2,'Demo Admin','super_admin','disabled-no-legacy-login',1,$3) ON CONFLICT(email) DO NOTHING",[legacyId,identities.admin,Date.now()]);
      const staff=await one(db,'SELECT id FROM staff_users WHERE email=$1',[identities.admin]);
      await db.query("INSERT INTO users(email,display_name,kind,state,staff_user_id) VALUES($1,'Demo Admin','staff','active',$2) ON CONFLICT(email) DO NOTHING",[identities.admin,staff.id]);
      const admin=await one(db,'SELECT id FROM users WHERE email=$1',[identities.admin]);
      await db.query("INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE code='super_admin' ON CONFLICT DO NOTHING",[admin.id]);
      await db.query("INSERT INTO users(email,display_name,kind,state) VALUES($1,'Demo Customer','customer','active') ON CONFLICT(email) DO NOTHING",[identities.customer]);
      const user=await one(db,'SELECT id FROM users WHERE email=$1',[identities.customer]);
      await db.query("INSERT INTO customers(user_id,status,created_by) VALUES($1,'approved',$1) ON CONFLICT(user_id) DO NOTHING",[user.id]);
      const customer=await one(db,'SELECT id FROM customers WHERE user_id=$1',[user.id]);
      if(!await one(db,'SELECT id FROM customer_memberships WHERE customer_id=$1',[customer.id])) {
        const company=await one(db,"INSERT INTO customer_companies(legal_name,owner_customer_id,status,country_code,created_by) VALUES('Demo customer company',$1,'approved','AE',$2) RETURNING id",[customer.id,user.id]);
        await db.query("INSERT INTO customer_memberships(customer_id,customer_company_id,role,status,created_by) VALUES($1,$2,'owner','active',$3)",[customer.id,company.id,user.id]);
      }
      for(const id of [admin.id,user.id]) await db.query("INSERT INTO user_preferences(user_id,theme_id,language,created_by) SELECT $1,id,'en',$1 FROM themes WHERE code='ukr-blue' ON CONFLICT(user_id) DO NOTHING",[id]);
    });
    return store;
  } catch(error) {await pool.close();throw error;}
}
