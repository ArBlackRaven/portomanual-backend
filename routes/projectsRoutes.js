const express = require("express");
const router = express.Router();
const db = require("../db");
const jwt = require("jsonwebtoken");
const { createUploader, deleteFromCloudinary, cloudinary } = require("../cloudinary");

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

const upload = createUploader("projects");

// Helper: extract public_id from a Cloudinary URL for deletion
const getPublicId = (url) => {
  if (!url || !url.includes("/upload/")) return null;
  return url.split("/upload/")[1]?.replace(/\.[^/.]+$/, "") || null;
};

// POST - Add new project
router.post(
  "/",
  verifyToken,
  upload.fields([
    { name: "thumbnail", maxCount: 1 },
    { name: "gallery", maxCount: 10 },
  ]),
  (req, res) => {
    const { title, description, tags, htmlContent } = req.body;

    let parsedTags = [];
    try { parsedTags = JSON.parse(tags); }
    catch (e) { parsedTags = tags ? tags.split(",").map((t) => t.trim()) : []; }

    // Cloudinary returns full URLs via req.file.path
    const thumbnailPath = req.files?.thumbnail ? req.files.thumbnail[0].path : "";
    const galleryPaths = req.files?.gallery ? req.files.gallery.map((f) => f.path) : [];

    db.query(
      "INSERT INTO projects (title, description, tags, thumbnail, gallery, htmlContent) VALUES (?, ?, ?, ?, ?, ?)",
      [title, description, JSON.stringify(parsedTags), thumbnailPath, JSON.stringify(galleryPaths), htmlContent],
      (err, result) => {
        if (err) return res.status(500).json({ message: "Server error", error: err.message });
        res.json({ message: "Project added successfully", id: result.insertId });
      }
    );
  }
);

// GET - Get all projects
router.get("/", (req, res) => {
  db.query("SELECT * FROM projects ORDER BY created_at DESC", (err, results) => {
    if (err) return res.status(500).json({ message: "Server error", error: err.message });

    const formattedResults = results.map((proj) => ({
      ...proj,
      tags: typeof proj.tags === "string" ? JSON.parse(proj.tags) : proj.tags,
      gallery: typeof proj.gallery === "string" ? JSON.parse(proj.gallery) : proj.gallery,
    }));

    res.json(formattedResults);
  });
});

// GET - Get single project
router.get("/:id", (req, res) => {
  db.query("SELECT * FROM projects WHERE id = ?", [req.params.id], (err, results) => {
    if (err) return res.status(500).json({ message: "Server error", error: err.message });
    if (results.length === 0) return res.status(404).json({ message: "Project not found" });

    const proj = results[0];
    proj.tags = typeof proj.tags === "string" ? JSON.parse(proj.tags) : proj.tags;
    proj.gallery = typeof proj.gallery === "string" ? JSON.parse(proj.gallery) : proj.gallery;

    res.json(proj);
  });
});

// PUT - Update project
router.put(
  "/:id",
  verifyToken,
  upload.fields([
    { name: "thumbnail", maxCount: 1 },
    { name: "gallery", maxCount: 10 },
  ]),
  (req, res) => {
    const { title, description, tags, htmlContent } = req.body;
    const projectId = req.params.id;

    db.query("SELECT * FROM projects WHERE id = ?", [projectId], async (err, results) => {
      if (err) return res.status(500).json({ message: "Server error", error: err.message });
      if (results.length === 0) return res.status(404).json({ message: "Project not found" });

      const existingProject = results[0];

      let parsedTags = [];
      try { parsedTags = JSON.parse(tags); }
      catch (e) { parsedTags = tags ? tags.split(",").map((t) => t.trim()) : []; }

      // Thumbnail: use new upload or keep existing
      const thumbnailPath = req.files?.thumbnail
        ? req.files.thumbnail[0].path
        : existingProject.thumbnail;

      // If a new thumbnail was uploaded, delete the old one from Cloudinary
      if (req.files?.thumbnail && existingProject.thumbnail) {
        const oldId = getPublicId(existingProject.thumbnail);
        if (oldId) await deleteFromCloudinary(oldId);
      }

      // Gallery: combine retained existing images + new uploads
      let incomingExistingGallery = [];
      try {
        incomingExistingGallery = req.body.existingGallery
          ? JSON.parse(req.body.existingGallery)
          : (typeof existingProject.gallery === "string" ? JSON.parse(existingProject.gallery) : existingProject.gallery || []);
      } catch (e) { /* keep empty */ }

      const newGalleryPaths = req.files?.gallery ? req.files.gallery.map((f) => f.path) : [];
      const galleryPaths = [...incomingExistingGallery, ...newGalleryPaths];

      db.query(
        "UPDATE projects SET title = ?, description = ?, tags = ?, thumbnail = ?, gallery = ?, htmlContent = ? WHERE id = ?",
        [title, description, JSON.stringify(parsedTags), thumbnailPath, JSON.stringify(galleryPaths), htmlContent, projectId],
        (updateErr) => {
          if (updateErr) return res.status(500).json({ message: "Server error", error: updateErr.message });
          res.json({ message: "Project updated successfully" });
        }
      );
    });
  }
);

// DELETE - Delete project and all its Cloudinary assets
router.delete("/:id", verifyToken, (req, res) => {
  db.query("SELECT * FROM projects WHERE id = ?", [req.params.id], async (err, results) => {
    if (err) return res.status(500).json({ message: "Server error", error: err.message });
    if (results.length === 0) return res.status(404).json({ message: "Project not found" });

    const project = results[0];

    // Delete thumbnail from Cloudinary
    if (project.thumbnail) {
      const pubId = getPublicId(project.thumbnail);
      if (pubId) await deleteFromCloudinary(pubId);
    }

    // Delete all gallery images from Cloudinary
    let gallery = [];
    try { gallery = typeof project.gallery === "string" ? JSON.parse(project.gallery) : project.gallery || []; }
    catch (e) { /* skip */ }

    for (const imgUrl of gallery) {
      const pubId = getPublicId(imgUrl);
      if (pubId) await deleteFromCloudinary(pubId);
    }

    // Delete from DB
    db.query("DELETE FROM projects WHERE id = ?", [req.params.id], (deleteErr) => {
      if (deleteErr) return res.status(500).json({ message: "Server error", error: deleteErr.message });
      res.json({ message: "Project deleted successfully", id: req.params.id });
    });
  });
});

module.exports = router;
