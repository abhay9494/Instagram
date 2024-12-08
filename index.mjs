import express from "express";
import mysql from "mysql2";
import methodOverride from "method-override";
import path from "path";
import { faker } from "@faker-js/faker";
import ejs from "ejs";
import { fileURLToPath } from "url";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import randomstring from "randomstring";
import fetch from "node-fetch"; // For image upload to Imgur

// Create an express application
const app = express();

// Get the directory name using import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure EJS as the templating engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middleware for method overriding
app.use(methodOverride("_method"));

// Middleware to serve static files
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Create MySQL connection
let connection;

try {
  connection = mysql.createConnection({
    host: "localhost",
    user: "root", // Change this to your MySQL username
    password: "abhay_942", // Change this to your MySQL password
    database: "insta_post", // Change this to your MySQL database name
  });

  connection.connect((err) => {
    if (err) {
      console.log("Error connecting to MySQL:", err);
      process.exit();
    }
    console.log("Connected to MySQL");
  });
} catch (err) {
  console.log("Unexpected error:", err);
  process.exit();
}

// Multer configuration for handling file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "public", "uploads"));
  },
  filename: function (req, file, cb) {
    cb(null, uuidv4() + path.extname(file.originalname));
  },
});
const upload = multer({ storage: storage });

// Routes

// Home route
app.get("/", (req, res) => {
  let q = "SELECT * FROM instauser"; // Change to your table name

  connection.query(q, (err, results) => {
    if (err) {
      console.log("Error in database query:", err);
      res.send("Some Error in database");
      return;
    }

    if (!results || results.length === 0) {
      // Handle empty results
      res.send("No posts found in the database");
      return;
    }

    // Convert results to plain objects (if needed)
    const plainObjects = JSON.parse(JSON.stringify(results));

    // Render the view with data
    res.render("index", { results: plainObjects });
  });
});

// Route to create a new post
app.get("/posts/new", (req, res) => {
  res.render("new");
});

app.post("/posts", upload.single("image"), async (req, res) => {
  let { username, name, comment } = req.body;
  let image = req.file ? `/uploads/${req.file.filename}` : "";
  let id = uuidv4();

  // Upload the image to Imgur
  const IMGUR_UPLOAD_URL = "https://api.imgur.com/3/image";
  const IMGUR_CLIENT_ID = "e1b5901774bce4d"; // Replace with your actual Imgur Client ID

  try {
    const formData = new FormData();
    formData.append("image", req.file.buffer.toString("base64"));

    const response = await fetch(IMGUR_UPLOAD_URL, {
      method: "POST",
      headers: {
        Authorization: `Client-ID ${IMGUR_CLIENT_ID}`,
      },
      body: formData,
    });

    const data = await response.json();

    if (data.success) {
      const imageUrl = data.data.link;

      // Insert the record into the database with the image URL
      const q = `INSERT INTO instauser (id, username, name, image, comment) VALUES (?, ?, ?, ?, ?)`;
      connection.query(q, [id, username, name, imageUrl, comment], (err, result) => {
        if (err) {
          console.error(err);
          res.send("DB Error");
        } else {
          res.redirect("/");
        }
      });
    } else {
      console.error(data);
      res.send("Upload failed");
    }
  } catch (error) {
    console.error(error);
    res.send("Upload failed");
  }
});

// Route to display a post by ID
app.get("/posts/:id", (req, res) => {
  let { id } = req.params;
  let q = `SELECT * FROM instauser WHERE id="${id}"`;

  connection.query(q, (err, result) => {
    if (err) {
      console.error(err);
      res.send("Error in finding the post");
      return;
    }

    const post = JSON.parse(JSON.stringify(result[0]));
    res.render("show", { post });
  });
});

// Route to edit a post by ID
app.get("/posts/:id/edit", (req, res) => {
  let { id } = req.params;
  let q = `SELECT * FROM instauser WHERE id="${id}"`;

  connection.query(q, (err, result) => {
    if (err) {
      console.error(err);
      res.send("Error in finding the post");
      return;
    }

    const post = JSON.parse(JSON.stringify(result[0]));
    res.render("edit", { post });
  });
});

app.patch("/posts/:id", upload.single("image"), async (req, res) => {
  let { id } = req.params;
  let newComment = req.body.comment;
  let newImage = req.file ? `/uploads/${req.file.filename}` : "";
  let imageUrl = newImage;

  try {
    if (newImage) {
      // Upload the new image to Imgur if new image is provided
      const formData = new FormData();
      formData.append("image", req.file.buffer.toString("base64"));

      const response = await fetch("https://api.imgur.com/3/image", {
        method: "POST",
        headers: {
          Authorization: `Client-ID ${IMGUR_CLIENT_ID}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        imageUrl = data.data.link;
      } else {
        console.error(data);
        res.send("Upload failed");
        return;
      }
    }

    let updateQuery = `UPDATE instauser SET `;
    if (newComment) updateQuery += `comment="${newComment}"`;
    if (newImage) updateQuery += `, image="${imageUrl}"`;
    updateQuery += ` WHERE id="${id}"`;

    connection.query(updateQuery, (err, result) => {
      if (err) {
        console.error(err);
        res.send("DB Error");
      } else {
        res.redirect("/");
      }
    });
  } catch (error) {
    console.error(error);
    res.send("Upload failed");
  }
});

// Route to delete a post by ID
app.delete("/posts/:id", (req, res) => {
  let { id } = req.params;
  let deletePost = `DELETE FROM instauser WHERE id="${id}"`;

  connection.query(deletePost, (err, result) => {
    if (err) {
      console.error(err);
      res.send("Error deleting post");
      return;
    }

    res.redirect("/");
  });
});

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});

// Gracefully handle shutdown
process.on("SIGINT", () => {
  if (connection) {
    connection.end((err) => {
      if (err) console.log("Error closing connection:", err);
      else console.log("MySQL connection closed");
      process.exit();
    });
  }
});
