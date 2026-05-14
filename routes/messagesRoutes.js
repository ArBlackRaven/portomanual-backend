const express = require("express");
const router = express.Router();
const db = require("../db");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const sanitizeHtml = require("sanitize-html");

const SECRET_KEY = "your_secret_key_here";

// Middleware to verify token (for admin operations)
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

// MULTER CONFIGURATION for message images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/messages_images/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// POST - Create a new message (public - no auth required)
router.post("/", upload.single("image"), async (req, res) => {
  const { name, message } = req.body;
  let image_url = null;

  if (req.file) {
    try {
      // Dynamically import file-type (ESM) to read magic bytes
      const { fileTypeFromFile } = await import("file-type");
      const meta = await fileTypeFromFile(req.file.path);

      // Verify that it's actually an image
      if (!meta || !meta.mime.startsWith("image/")) {
        // It's not an image (could be a renamed script)! Delete it safely.
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: "Invalid image file detected! Only valid images are allowed." });
      }

      image_url = "messages_images/" + req.file.filename;
    } catch (error) {
      console.error("File validation error:", error);
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(500).json({ message: "Server error during file validation." });
    }
  }

  // Sanitize text inputs to prevent XSS
  const cleanName = typeof name === "string" ? sanitizeHtml(name, { allowedTags: [], allowedAttributes: {} }) : "";
  const cleanMessage = typeof message === "string" ? sanitizeHtml(message, { allowedTags: [], allowedAttributes: {} }) : "";

  const displayName = cleanName && cleanName.trim() ? cleanName : "Secret User";

  db.query(
    "INSERT INTO messages (name, message, image_url, created_at) VALUES (?, ?, ?, NOW())",
    [displayName, cleanMessage, image_url],
    (err, result) => {
      if (err) {
        console.error("Database error:", err);
        return res
          .status(500)
          .json({ message: "Server error", error: err.message });
      }
      res.json({ message: "Message sent successfully", id: result.insertId });
    },
  );
});

// GET - Get all messages (admin only - requires auth)
router.get("/", verifyToken, (req, res) => {
  db.query(
    "SELECT * FROM messages ORDER BY created_at DESC",
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

// DELETE - Delete a message (admin only - requires auth)
router.delete("/:id", verifyToken, (req, res) => {
  db.query(
    "DELETE FROM messages WHERE id = ?",
    [req.params.id],
    (err, result) => {
      if (err) {
        console.error("Database error:", err);
        return res
          .status(500)
          .json({ message: "Server error", error: err.message });
      }
      res.json({ message: "Message deleted successfully", id: req.params.id });
    },
  );
});

module.exports = router;
