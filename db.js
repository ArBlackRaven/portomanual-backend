require("dotenv").config();
const mysql = require("mysql2");

// Use DATABASE_URL if provided, otherwise fallback to separate variables
const db = process.env.DATABASE_URL 
  ? mysql.createConnection(process.env.DATABASE_URL)
  : mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT,
      ssl: {
        rejectUnauthorized: false
      }
    });

db.connect((err) => {
  if (err) {
    console.log("Connection failed:", err);
    return;
  }
  console.log("Connected to database!");
});

module.exports = db;
