const { Pool } = require("pg");

// Database configuration
const dbConfig = {
  host: "localhost",
  port: 5432,
  database: "uip_auth",
  user: "uip_user",
  password: "uip_secure_2024",
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

const pool = new Pool(dbConfig);

// Test database connection
pool.on("connect", () => {
  console.log("Connected to the database");
});

pool.on("error", (err) => {
  console.error("Database connection error:", err);
});

module.exports = pool;