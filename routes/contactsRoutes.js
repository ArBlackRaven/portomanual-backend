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
    cb(null, "uploads/icontact_logos/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// POST - Add new contact
router.post("/", verifyToken, upload.single("logo"), (req, res) => {
  const { title, link, color } = req.body;
  const image_url = req.file ? "icontact_logos/" + req.file.filename : null;
  const contactAddTime = new Date();

  db.query(
    "INSERT INTO icontacts (title, link, color, image_url, modified, created) VALUES (?, ?, ?, ?, ?, ?)",
    [title, link, color, image_url, contactAddTime, contactAddTime],
    (err, result) => {
      if (err) {
        console.error("Database error:", err);
        return res
          .status(500)
          .json({ message: "Server error", error: err.message });
      }
      res.json({ message: "Contact added successfully", id: result.insertId });
    },
  );
});

// GET - Get all contacts
router.get("/", (req, res) => {
  db.query(
    "SELECT * FROM icontacts ORDER BY contact_order ASC",
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

// DELETE - Delete contact
router.delete("/:id", verifyToken, (req, res) => {
  db.query(
    "DELETE FROM icontacts WHERE id = ?",
    [req.params.id],
    (err, result) => {
      if (err) {
        console.error("Database error:", err);
        return res
          .status(500)
          .json({ message: "Server error", error: err.message });
      }
      res.json({ message: "Contact deleted successfully", id: req.params.id });
    },
  );
});

// PUT - Update order
router.put("/order", verifyToken, (req, res) => {
  const { contacts } = req.body;

  const promises = contacts.map((contact, index) => {
    return new Promise((resolve, reject) => {
      db.query(
        "UPDATE icontacts SET contact_order = ? WHERE id = ?",
        [index, contact.id],
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

// PUT - Update contact
router.put("/:id", verifyToken, upload.single("logo"), (req, res) => {
  const { title, link, color } = req.body;
  const image_url = req.file ? "icontact_logos/" + req.file.filename : null;
  const contactUpdateTime = new Date();

  let query, params;
  if (image_url) {
    query =
      "UPDATE icontacts SET title = ?, link = ?, color = ?, image_url = ?, modified = ? WHERE id = ?";
    params = [title, link, color, image_url, contactUpdateTime, req.params.id];
  } else {
    query =
      "UPDATE icontacts SET title = ?, link = ?, color = ?, modified = ? WHERE id = ?";
    params = [title, link, color, contactUpdateTime, req.params.id];
  }

  db.query(query, params, (err, result) => {
    if (err) {
      console.error("Database error:", err);
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });
    }
    res.json({ message: "Contact updated successfully" });
  });
});

module.exports = router;
