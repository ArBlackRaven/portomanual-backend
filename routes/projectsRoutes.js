const express = require("express");
const router = express.Router();
const db = require("../db");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

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

// Ensure upload directory exists
const uploadDir = "uploads/projects/";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// MULTER CONFIGURATION
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create a safe folder name from the project title
    // NOTE: The frontend MUST append the 'title' field to FormData BEFORE appending the files!
    const safeTitle = req.body.title 
      ? req.body.title.toLowerCase().replace(/[^a-z0-9]/g, '-') 
      : 'untitled-' + Date.now();
      
    const projectDir = path.join(uploadDir, safeTitle);

    // Create the project-specific folder if it doesn't exist
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }

    cb(null, projectDir);
  },
  filename: (req, file, cb) => {
    if (file.fieldname === "thumbnail") {
      // Save thumbnail as thumbnail.ext
      cb(null, "thumbnail" + path.extname(file.originalname));
    } else {
      // Save gallery images normally
      cb(null, Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(file.originalname));
    }
  },
});

const upload = multer({ storage });

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

    // tags are usually sent as a JSON string from FormData
    let parsedTags = [];
    try {
      parsedTags = JSON.parse(tags);
    } catch (e) {
      // fallback if it's sent as a comma-separated string
      parsedTags = tags ? tags.split(",").map((t) => t.trim()) : [];
    }

    const safeTitle = title 
      ? title.toLowerCase().replace(/[^a-z0-9]/g, '-') 
      : 'untitled';

    const thumbnailPath =
      req.files && req.files.thumbnail
        ? "projects/" + safeTitle + "/" + req.files.thumbnail[0].filename
        : "";

    const galleryPaths =
      req.files && req.files.gallery
        ? req.files.gallery.map((file) => "projects/" + safeTitle + "/" + file.filename)
        : [];

    db.query(
      "INSERT INTO projects (title, description, tags, thumbnail, gallery, htmlContent) VALUES (?, ?, ?, ?, ?, ?)",
      [
        title,
        description,
        JSON.stringify(parsedTags),
        thumbnailPath,
        JSON.stringify(galleryPaths),
        htmlContent,
      ],
      (err, result) => {
        if (err) {
          console.error("Database error:", err);
          return res
            .status(500)
            .json({ message: "Server error", error: err.message });
        }
        res.json({ message: "Project added successfully", id: result.insertId });
      }
    );
  }
);

// GET - Get all projects
router.get("/", (req, res) => {
  db.query("SELECT * FROM projects ORDER BY created_at DESC", (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });
    }

    // Parse JSON fields before sending to frontend
    const formattedResults = results.map((proj) => ({
      ...proj,
      tags: typeof proj.tags === "string" ? JSON.parse(proj.tags) : proj.tags,
      gallery:
        typeof proj.gallery === "string"
          ? JSON.parse(proj.gallery)
          : proj.gallery,
    }));

    res.json(formattedResults);
  });
});

// GET - Get single project
router.get("/:id", (req, res) => {
  db.query(
    "SELECT * FROM projects WHERE id = ?",
    [req.params.id],
    (err, results) => {
      if (err) {
        console.error("Database error:", err);
        return res
          .status(500)
          .json({ message: "Server error", error: err.message });
      }

      if (results.length === 0) {
        return res.status(404).json({ message: "Project not found" });
      }

      const proj = results[0];
      proj.tags = typeof proj.tags === "string" ? JSON.parse(proj.tags) : proj.tags;
      proj.gallery =
        typeof proj.gallery === "string" ? JSON.parse(proj.gallery) : proj.gallery;

      res.json(proj);
    }
  );
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

    db.query("SELECT * FROM projects WHERE id = ?", [projectId], (err, results) => {
      if (err) {
        return res.status(500).json({ message: "Server error", error: err.message });
      }
      if (results.length === 0) {
        return res.status(404).json({ message: "Project not found" });
      }

      const existingProject = results[0];
      const safeTitle = title
        ? title.toLowerCase().replace(/[^a-z0-9]/g, "-")
        : "untitled";

      let parsedTags = [];
      try {
        parsedTags = JSON.parse(tags);
      } catch (e) {
        parsedTags = tags ? tags.split(",").map((t) => t.trim()) : [];
      }

      // Keep existing file paths if no new files are uploaded
      const thumbnailPath =
        req.files && req.files.thumbnail
          ? "projects/" + safeTitle + "/" + req.files.thumbnail[0].filename
          : existingProject.thumbnail;

      // Handle gallery updates: combine retained old images + newly uploaded ones
      let incomingExistingGallery = [];
      try {
        if (req.body.existingGallery) {
          incomingExistingGallery = JSON.parse(req.body.existingGallery);
        } else if (typeof existingProject.gallery === "string") {
          incomingExistingGallery = JSON.parse(existingProject.gallery);
        } else {
          incomingExistingGallery = existingProject.gallery || [];
        }
      } catch (e) {
        console.error("Error parsing existingGallery", e);
      }

      const newGalleryPaths = req.files && req.files.gallery
        ? req.files.gallery.map((file) => "projects/" + safeTitle + "/" + file.filename)
        : [];

      // Combine them
      const galleryPaths = [...incomingExistingGallery, ...newGalleryPaths];

      db.query(
        "UPDATE projects SET title = ?, description = ?, tags = ?, thumbnail = ?, gallery = ?, htmlContent = ? WHERE id = ?",
        [
          title,
          description,
          JSON.stringify(parsedTags),
          thumbnailPath,
          JSON.stringify(galleryPaths),
          htmlContent,
          projectId,
        ],
        (updateErr) => {
          if (updateErr) {
            console.error("Database error:", updateErr);
            return res.status(500).json({ message: "Server error", error: updateErr.message });
          }
          res.json({ message: "Project updated successfully" });
        }
      );
    });
  }
);

// DELETE - Delete project
router.delete("/:id", verifyToken, (req, res) => {
  // First, find the project to get its title and folder name
  db.query("SELECT * FROM projects WHERE id = ?", [req.params.id], (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ message: "Server error", error: err.message });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "Project not found" });
    }

    const project = results[0];

    // Reconstruct the safe folder name from the title
    const safeTitle = project.title
      ? project.title.toLowerCase().replace(/[^a-z0-9]/g, "-")
      : "untitled";

    const projectDir = path.join(__dirname, "..", "uploads", "projects", safeTitle);

    // Delete the directory and its contents
    if (fs.existsSync(projectDir)) {
      try {
        fs.rmSync(projectDir, { recursive: true, force: true });
      } catch (rmErr) {
        console.error("Error deleting directory:", rmErr);
        // We log the error but still proceed to delete the DB record
      }
    }

    // Now delete from database
    db.query("DELETE FROM projects WHERE id = ?", [req.params.id], (deleteErr, result) => {
      if (deleteErr) {
        console.error("Database error:", deleteErr);
        return res.status(500).json({ message: "Server error", error: deleteErr.message });
      }
      res.json({ message: "Project and associated files deleted successfully", id: req.params.id });
    });
  });
});

module.exports = router;
