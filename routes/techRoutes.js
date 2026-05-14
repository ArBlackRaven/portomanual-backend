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

const upload = createUploader("techs");

// POST - Add new tech
router.post("/", verifyToken, upload.single("logo"), (req, res) => {
  const { title, type, color, tech_url } = req.body;
  if (!req.file) return res.status(400).json({ message: "Logo image is required" });

  const image_url = req.file.path; // Cloudinary URL
  const now = new Date();

  db.query(
    "INSERT INTO techs (title, type, color, tech_url, image_url, modified, created) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [title, type, color, tech_url, image_url, now, now],
    (err) => {
      if (err) return res.status(500).json({ message: "Server error", error: err.message });
      res.json({ message: "Tech added successfully" });
    }
  );
});

// GET - Get all techs
router.get("/", (req, res) => {
  db.query("SELECT * FROM techs", (err, results) => {
    if (err) return res.status(500).json({ message: "Server error", error: err.message });
    res.json(results);
  });
});

// DELETE - Delete tech
router.delete("/:id", verifyToken, (req, res) => {
  db.query("SELECT image_url FROM techs WHERE id = ?", [req.params.id], async (err, results) => {
    if (err) return res.status(500).json({ message: "Server error" });

    if (results.length > 0 && results[0].image_url) {
      const url = results[0].image_url;
      const publicId = url.split("/upload/")[1]?.replace(/\.[^/.]+$/, "");
      if (publicId) await deleteFromCloudinary(publicId);
    }

    db.query("DELETE FROM techs WHERE id = ?", [req.params.id], (err) => {
      if (err) return res.status(500).json({ message: "Server error" });
      res.json({ message: "Tech deleted successfully", id: req.params.id });
    });
  });
});

// PUT - Update order
router.put("/order", verifyToken, (req, res) => {
  const { techs } = req.body;
  const promises = techs.map((tech, index) =>
    new Promise((resolve, reject) => {
      db.query("UPDATE techs SET tech_order = ? WHERE id = ?", [index, tech.id], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    })
  );
  Promise.all(promises)
    .then(() => res.json({ message: "Order updated successfully" }))
    .catch((err) => res.status(500).json({ message: "Server error", error: err.message }));
});

// PUT - Update tech
router.put("/:id", verifyToken, upload.single("logo"), (req, res) => {
  const { title, type, color, tech_url } = req.body;
  const image_url = req.file ? req.file.path : null;
  const now = new Date();

  let query, params;
  if (image_url) {
    query = "UPDATE techs SET title = ?, type = ?, color = ?, tech_url = ?, image_url = ?, modified = ? WHERE id = ?";
    params = [title, type, color, tech_url, image_url, now, req.params.id];
  } else {
    query = "UPDATE techs SET title = ?, type = ?, color = ?, tech_url = ?, modified = ? WHERE id = ?";
    params = [title, type, color, tech_url, now, req.params.id];
  }

  db.query(query, params, (err) => {
    if (err) return res.status(500).json({ message: "Server error", error: err.message });
    res.json({ message: "Tech updated successfully" });
  });
});

module.exports = router;
