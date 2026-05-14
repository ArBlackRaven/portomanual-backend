const express = require("express");
const router = express.Router();
const db = require("../db");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const sanitizeHtml = require("sanitize-html");

const SECRET_KEY = "your_secret_key_here";

// Middleware to verify token (admin only)
const verifyToken = (req, res, next) => {
  const token = req.headers["token"];
  if (!token) return res.status(401).json({ message: "No token provided" });
  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid token" });
    req.user = decoded;
    next();
  });
};

// MULTER for announcement images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/announcements/";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// GET - Get the latest ACTIVE announcement (public)
router.get("/active", (req, res) => {
  db.query(
    "SELECT * FROM announcements WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1",
    (err, results) => {
      if (err) return res.status(500).json({ message: "Server error", error: err.message });
      if (results.length === 0) return res.json(null);
      res.json(results[0]);
    }
  );
});

// GET - Get all announcements (admin)
router.get("/", verifyToken, (req, res) => {
  db.query("SELECT * FROM announcements ORDER BY created_at DESC", (err, results) => {
    if (err) return res.status(500).json({ message: "Server error", error: err.message });
    res.json(results);
  });
});

// POST - Create a new announcement (admin)
router.post("/", verifyToken, upload.single("image"), async (req, res) => {
  const { title, content } = req.body;
  let image_url = null;

  if (req.file) {
    try {
      const { fileTypeFromFile } = await import("file-type");
      const meta = await fileTypeFromFile(req.file.path);
      if (!meta || !meta.mime.startsWith("image/")) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: "Invalid image file. Only real images allowed." });
      }
      image_url = "announcements/" + req.file.filename;
    } catch (err) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(500).json({ message: "File validation error." });
    }
  }

  const cleanTitle = sanitizeHtml(title || "", { allowedTags: [], allowedAttributes: {} });
  const cleanContent = sanitizeHtml(content || "", { allowedTags: [], allowedAttributes: {} });

  // Deactivate all old announcements first, then insert new one as active
  db.query("UPDATE announcements SET is_active = 0", (err) => {
    if (err) return res.status(500).json({ message: "Server error", error: err.message });

    db.query(
      "INSERT INTO announcements (title, content, image_url, is_active, created_at) VALUES (?, ?, ?, 1, NOW())",
      [cleanTitle, cleanContent, image_url],
      (err, result) => {
        if (err) return res.status(500).json({ message: "Server error", error: err.message });
        res.json({ message: "Announcement created successfully", id: result.insertId });
      }
    );
  });
});

// PUT - Toggle active/inactive (admin)
router.put("/:id/toggle", verifyToken, (req, res) => {
  db.query(
    "SELECT is_active FROM announcements WHERE id = ?",
    [req.params.id],
    (err, results) => {
      if (err) return res.status(500).json({ message: "Server error" });
      if (results.length === 0) return res.status(404).json({ message: "Not found" });

      const newStatus = results[0].is_active ? 0 : 1;

      // If activating, deactivate all others first
      const activate = () => {
        db.query(
          "UPDATE announcements SET is_active = ? WHERE id = ?",
          [newStatus, req.params.id],
          (err) => {
            if (err) return res.status(500).json({ message: "Server error" });
            res.json({ message: "Status updated", is_active: newStatus });
          }
        );
      };

      if (newStatus === 1) {
        db.query("UPDATE announcements SET is_active = 0", (err) => {
          if (err) return res.status(500).json({ message: "Server error" });
          activate();
        });
      } else {
        activate();
      }
    }
  );
});

// DELETE - Delete an announcement (admin)
router.delete("/:id", verifyToken, (req, res) => {
  db.query("SELECT image_url FROM announcements WHERE id = ?", [req.params.id], (err, results) => {
    if (err) return res.status(500).json({ message: "Server error" });
    if (results.length === 0) return res.status(404).json({ message: "Not found" });

    const imageUrl = results[0].image_url;
    if (imageUrl) {
      const fullPath = path.join(__dirname, "../uploads", imageUrl);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }

    db.query("DELETE FROM announcements WHERE id = ?", [req.params.id], (err) => {
      if (err) return res.status(500).json({ message: "Server error" });
      res.json({ message: "Announcement deleted" });
    });
  });
});

module.exports = router;
