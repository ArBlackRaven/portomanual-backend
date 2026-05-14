const express = require("express");
const router = express.Router();
const db = require("../db");
const jwt = require("jsonwebtoken");
const sanitizeHtml = require("sanitize-html");
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

const upload = createUploader("messages");

// POST - Create a new message (public)
router.post("/", upload.single("image"), async (req, res) => {
  const { name, message } = req.body;

  let image_url = null;
  if (req.file) {
    image_url = req.file.path; // Cloudinary URL
  }

  const cleanName = typeof name === "string" ? sanitizeHtml(name, { allowedTags: [], allowedAttributes: {} }) : "";
  const cleanMessage = typeof message === "string" ? sanitizeHtml(message, { allowedTags: [], allowedAttributes: {} }) : "";
  const displayName = cleanName && cleanName.trim() ? cleanName : "Secret User";

  db.query(
    "INSERT INTO messages (name, message, image_url, created_at) VALUES (?, ?, ?, NOW())",
    [displayName, cleanMessage, image_url],
    (err, result) => {
      if (err) return res.status(500).json({ message: "Server error", error: err.message });
      res.json({ message: "Message sent successfully", id: result.insertId });
    }
  );
});

// GET - Get all messages (admin)
router.get("/", verifyToken, (req, res) => {
  db.query("SELECT * FROM messages ORDER BY created_at DESC", (err, results) => {
    if (err) return res.status(500).json({ message: "Server error", error: err.message });
    res.json(results);
  });
});

// DELETE - Delete a message (admin)
router.delete("/:id", verifyToken, (req, res) => {
  db.query("SELECT image_url FROM messages WHERE id = ?", [req.params.id], async (err, results) => {
    if (err) return res.status(500).json({ message: "Server error" });

    // Delete from Cloudinary if image exists
    if (results.length > 0 && results[0].image_url) {
      // Extract public_id from Cloudinary URL
      const url = results[0].image_url;
      const publicId = url.split("/upload/")[1]?.replace(/\.[^/.]+$/, "");
      if (publicId) await deleteFromCloudinary(publicId);
    }

    db.query("DELETE FROM messages WHERE id = ?", [req.params.id], (err) => {
      if (err) return res.status(500).json({ message: "Server error" });
      res.json({ message: "Message deleted successfully", id: req.params.id });
    });
  });
});

module.exports = router;
