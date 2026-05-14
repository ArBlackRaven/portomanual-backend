const express = require("express");
const router = express.Router();
const db = require("../db");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");

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

// MULTER CONFIGURATION
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/techs_logos/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// POST - Add new tech
router.post("/", verifyToken, upload.single("logo"), (req, res) => {
  const { title, type, color, tech_url } = req.body;
  const image_url = "techs_logos/" + req.file.filename;
  const techAddTime = new Date();

  db.query(
    "INSERT INTO techs (title, type, color, tech_url, image_url, modified, created) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [title, type, color, tech_url, image_url, techAddTime, techAddTime],
    (err, result) => {
      if (err) {
        console.error("Database error:", err);
        return res
          .status(500)
          .json({ message: "Server error", error: err.message });
      }
      res.json({ message: "Tech added successfully" });
    },
  );
});

// GET - Get all techs
router.get("/", (req, res) => {
  db.query("SELECT * FROM techs", (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });
    }
    res.json(results);
  });
});

// DELETE - Delete tech
router.delete("/:id", verifyToken, (req, res) => {
  db.query("DELETE FROM techs WHERE id = ?", [req.params.id], (err, result) => {
    if (err) {
      console.error("Database error:", err);
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });
    }
    res.json({ message: "Tech deleted successfully", id: req.params.id });
  });
});

// PUT - Update order
router.put("/order", verifyToken, (req, res) => {
  const { techs } = req.body;

  const promises = techs.map((tech, index) => {
    return new Promise((resolve, reject) => {
      db.query(
        "UPDATE techs SET tech_order = ? WHERE id = ?",
        [index, tech.id],
        (err, result) => {
          if (err) reject(err);
          else resolve(result);
        },
      );
    });
  });

  Promise.all(promises)
    .then(() => {
      res.json({ message: "Order updated successfully" });
    })
    .catch((err) => {
      res.status(500).json({ message: "Server error", error: err.message });
    });
});

// PUT - Update tech
router.put("/:id", verifyToken, upload.single("logo"), (req, res) => {
  const { title, type, color, tech_url } = req.body;
  const image_url = req.file ? "techs_logos/" + req.file.filename : null;
  const techUpdateTime = new Date();

  let query, params;
  if (image_url) {
    query =
      "UPDATE techs SET title = ?, type = ?, color = ?, tech_url = ?, image_url = ?, modified = ? WHERE id = ?";
    params = [
      title,
      type,
      color,
      tech_url,
      image_url,
      techUpdateTime,
      req.params.id,
    ];
  } else {
    query =
      "UPDATE techs SET title = ?, type = ?, color = ?, tech_url = ?, modified = ? WHERE id = ?";
    params = [title, type, color, tech_url, techUpdateTime, req.params.id];
  }

  db.query(query, params, (err, result) => {
    if (err) {
      console.error("Database error:", err);
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });
    }
    res.json({ message: "Tech updated successfully" });
  });
});

module.exports = router;
