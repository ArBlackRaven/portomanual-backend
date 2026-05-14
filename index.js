const express = require("express");
const cors = require("cors");
const db = require("./db");
const jwt = require("jsonwebtoken");
const jlogRoutes = require("./routes/jlogRoutes");
const techRoutes = require("./routes/techRoutes");
const contactsRoutes = require("./routes/contactsRoutes");
const messagesRoutes = require("./routes/messagesRoutes");
const projectsRoutes = require("./routes/projectsRoutes");
const announcementsRoutes = require("./routes/announcementsRoutes");
const sanitizeHtml = require("sanitize-html");

const app = express();
const SECRET_KEY = process.env.SECRET_KEY || "your_secret_key_here";

app.use(cors()); // for cross-origin requests
app.use(express.json()); // for parsing application/json

// Mount jlog routes
app.use("/jlogs", jlogRoutes);

// Mount tech routes
app.use("/techs", techRoutes);

// Mount contacts routes
app.use("/contacts", contactsRoutes);


// Mount messages routes
app.use("/messages", messagesRoutes);

// Mount projects routes
app.use("/projects", projectsRoutes);

// Mount announcements routes
app.use("/announcements", announcementsRoutes);

// the middleware to verify the token
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

// the root route
app.get("/", (req, res) => {
  res.send("Server is running!");
});

// start the server
if (process.env.NODE_ENV !== "production") {
  app.listen(5000, () => console.log("Server started on port 5000"));
}

// the login route
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  // Sanitize inputs to prevent XSS
  const cleanUsername = typeof username === "string" ? sanitizeHtml(username, { allowedTags: [], allowedAttributes: {} }) : "";
  const cleanPassword = typeof password === "string" ? sanitizeHtml(password, { allowedTags: [], allowedAttributes: {} }) : "";

  db.query(
    "SELECT * FROM users WHERE username = ?",
    [cleanUsername],
    (err, results) => {
      if (err) {
        console.error("Database error:", err);
        return res
          .status(500)
          .json({ message: "Server error", error: err.message });
      }

      if (results.length === 0) {
        return res
          .status(401)
          .json({ message: "Invalid username or password" });
      }

      const user = results[0];

      if (cleanPassword !== user.password) {
        return res
          .status(401)
          .json({ message: "Invalid username or password" });
      }

      delete user.password;

      const token = jwt.sign(
        { id: user.id, username: user.username },
        SECRET_KEY,
        {
          expiresIn: "7d",
        },
      );

      res.json({ message: "Login successful", user, token });
    },
  );
});

// the dashboard route
app.get("/dashboard", verifyToken, (req, res) => {
  res.json({ message: "Welcome to dashboard", user: req.user });
});

module.exports = app;