const { Pool } = require('pg');
const config = require('../config');

const pool = new Pool({ connectionString: config.databaseUrl });

function query(text, params) {
  return pool.query(text, params);
}

function getClient() {
  return pool.connect();
}

module.exports = { pool, query, getClient };
