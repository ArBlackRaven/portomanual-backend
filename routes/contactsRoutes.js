const express = require("express");
const router = express.Router();
const db = require("../db");
const jwt = require("jsonwebtoken");
const { createUploader, deleteFromCloudinary } = require("../cloudinary");

const SECRET_KEY = process.env.SECRET_KEY || "your_secret_key_here";

const verifyToken = (req, res, next) => {
  const token = req.headers["token"];
  if (!token) return res.status(401).json({ message: "No token provided" });
  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid token" });
    req.user = decoded;
    next();
  });
};

const upload = createUploader("contacts");

// POST - Add new contact
router.post("/", verifyToken, upload.single("logo"), (req, res) => {
  const { title, link, color } = req.body;
  const image_url = req.file ? req.file.path : null;
  const now = new Date();

  db.query(
    "INSERT INTO icontacts (title, link, color, image_url, modified, created) VALUES (?, ?, ?, ?, ?, ?)",
    [title, link, color, image_url, now, now],
    (err, result) => {
      if (err) return res.status(500).json({ message: "Server error", error: err.message });
      res.json({ message: "Contact added successfully", id: result.insertId });
    }
  );
});

// GET - Get all contacts
router.get("/", (req, res) => {
  db.query("SELECT * FROM icontacts ORDER BY contact_order ASC", (err, results) => {
    if (err) return res.status(500).json({ message: "Server error", error: err.message });
    res.json(results);
  });
});

// DELETE - Delete contact
router.delete("/:id", verifyToken, (req, res) => {
  db.query("SELECT image_url FROM icontacts WHERE id = ?", [req.params.id], async (err, results) => {
    if (err) return res.status(500).json({ message: "Server error" });

    if (results.length > 0 && results[0].image_url) {
      const url = results[0].image_url;
      const publicId = url.split("/upload/")[1]?.replace(/\.[^/.]+$/, "");
      if (publicId) await deleteFromCloudinary(publicId);
    }

    db.query("DELETE FROM icontacts WHERE id = ?", [req.params.id], (err) => {
      if (err) return res.status(500).json({ message: "Server error" });
      res.json({ message: "Contact deleted successfully", id: req.params.id });
    });
  });
});

// PUT - Update order
router.put("/order", verifyToken, (req, res) => {
  const { contacts } = req.body;
  const promises = contacts.map((contact, index) =>
    new Promise((resolve, reject) => {
      db.query("UPDATE icontacts SET contact_order = ? WHERE id = ?", [index, contact.id], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    })
  );
  Promise.all(promises)
    .then(() => res.json({ message: "Order updated successfully" }))
    .catch((err) => res.status(500).json({ message: "Server error", error: err.message }));
});

// PUT - Update contact
router.put("/:id", verifyToken, upload.single("logo"), (req, res) => {
  const { title, link, color } = req.body;
  const image_url = req.file ? req.file.path : null;
  const now = new Date();

  let query, params;
  if (image_url) {
    query = "UPDATE icontacts SET title = ?, link = ?, color = ?, image_url = ?, modified = ? WHERE id = ?";
    params = [title, link, color, image_url, now, req.params.id];
  } else {
    query = "UPDATE icontacts SET title = ?, link = ?, color = ?, modified = ? WHERE id = ?";
    params = [title, link, color, now, req.params.id];
  }

  db.query(query, params, (err) => {
    if (err) return res.status(500).json({ message: "Server error", error: err.message });
    res.json({ message: "Contact updated successfully" });
  });
});

module.exports = router;
