require("dotenv").config();
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Creates a multer uploader that sends files to a specific Cloudinary folder.
 * @param {string} folder - Cloudinary folder name (e.g. "portfolio/projects")
 * @param {string} [publicIdField] - Optional: use a specific field from req.body as the public_id prefix
 */
const createUploader = (folder) => {
  const storage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: `portfolio/${folder}`,
      allowed_formats: ["jpg", "jpeg", "png", "webp", "gif", "svg"],
      transformation: [{ quality: "auto", fetch_format: "auto" }],
    },
  });

  return multer({ storage });
};

/**
 * Delete a file from Cloudinary by its public_id.
 * The public_id is stored in the DB as the full Cloudinary path.
 * @param {string} publicId
 */
const deleteFromCloudinary = async (publicId) => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error("Cloudinary delete error:", err);
  }
};

module.exports = { cloudinary, createUploader, deleteFromCloudinary };
