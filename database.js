const sql = require('mssql');

const config = {
  server: process.env.DB_SERVER || 'cw-webapps.database.windows.net',
  database: process.env.DB_DATABASE || 'lava',
  user: process.env.DB_USER || 'ExternalReadOnly',
  password: process.env.DB_PASSWORD || '5&Q629c&N8vW',
  port: parseInt(process.env.DB_PORT) || 1433,
  options: {
    encrypt: true,
    trustServerCertificate: false,
    enableArithAbort: true,
    hostNameInCertificate: '*.sql.azuresynapse.net',
    validateBulkLoadParameters: false,
    useUTC: false
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  },
  requestTimeout: 120000, // 2 minutes for complex queries
  connectionTimeout: 30000
};

let pool = null;

const connect = async () => {
  try {
    if (pool) {
      return pool;
    }
    
    console.log('Attempting to connect to Azure Synapse SQL...');
    console.log('Server:', config.server);
    console.log('Database:', config.database);
    console.log('User:', config.user);
    
    pool = await sql.connect(config);
    console.log('✅ Connected to Azure Synapse SQL Database');
    return pool;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Error code:', error.code);
    if (error.originalError) {
      console.error('Original error:', error.originalError.message);
    }
    throw error;
  }
};

const close = async () => {
  try {
    if (pool) {
      await pool.close();
      pool = null;
      console.log('Database connection closed');
    }
  } catch (error) {
    console.error('Error closing database connection:', error);
    throw error;
  }
};

const getPool = () => {
  if (!pool) {
    throw new Error('Database not connected. Call connect() first.');
  }
  return pool;
};

module.exports = {
  connect,
  close,
  getPool,
  sql
};
