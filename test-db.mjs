import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';

const pool = new pg.Pool({ connectionString: 'postgresql://postgres:@localhost:5432/gis_pdam' });
const db = drizzle(pool);

async function check() {
  try {
    const res = await db.execute(sql`SELECT count(*) FROM monitoring_data`);
    console.log("Count of monitoring_data:", res.rows[0].count);
    
    const res2 = await db.execute(sql`SELECT count(*) FROM network_node_names`);
    console.log("Count of network_node_names:", res2.rows[0].count);
  } catch (e) {
    console.error("DB Error:", e);
  } finally {
    pool.end();
  }
}
check();
