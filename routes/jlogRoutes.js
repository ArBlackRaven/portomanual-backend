const express = require("express");
const router = express.Router();
const db = require("../db");
const jwt = require("jsonwebtoken");

const SECRET_KEY = "your_secret_key_here";

// Middleware to verify token
const verifyToken = (req, res, next) => {
  const token = req.headers["token"];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid token" });
    req.user = decoded;
    next();
  });
};

// POST - Add new jlog entry
router.post("/", verifyToken, (req, res) => {
  const { date, title, description } = req.body;
  const currentTime = new Date();

  db.query(
    "INSERT INTO jlog (date, title, description, modified, created) VALUES (?, ?, ?, ?, ?)",
    [date, title, description, currentTime, currentTime],
    (err, result) => {
      if (err) {
        console.error("Database error:", err);
        return res
          .status(500)
          .json({ message: "Server error", error: err.message });
      }
      res.json({
        message: "Journey log added successfully",
        id: result.insertId,
      });
    },
  );
});

// GET - Get all jlog entries
router.get("/", (req, res) => {
  db.query(
    "SELECT * FROM jlog ORDER BY STR_TO_DATE(date, '%Y-%m-%d') DESC",
    (err, results) => {
      if (err) {
        console.error("Database error:", err);
        return res
          .status(500)
          .json({ message: "Server error", error: err.message });
      }
      res.json(results);
    },
  );
});

// PUT - Update jlog entry
router.put("/:id", verifyToken, (req, res) => {
  const { date, title, description } = req.body;
  const updateTime = new Date();

  db.query(
    "UPDATE jlog SET date = ?, title = ?, description = ?, modified = ? WHERE id = ?",
    [date, title, description, updateTime, req.params.id],
    (err, result) => {
      if (err) {
        console.error("Database error:", err);
        return res
          .status(500)
          .json({ message: "Server error", error: err.message });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Journey log not found" });
      }
      res.json({ message: "Journey log updated successfully" });
    },
  );
});

// DELETE - Delete jlog entry
router.delete("/:id", verifyToken, (req, res) => {
  db.query("DELETE FROM jlog WHERE id = ?", [req.params.id], (err, result) => {
    if (err) {
      console.error("Database error:", err);
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Journey log not found" });
    }
    res.json({ message: "Journey log deleted successfully" });
  });
});

module.exports = router;
