
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import { google } from "googleapis";
import { JWT } from "google-auth-library";
import fs from "fs";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Configure Multer for file uploads
  const upload = multer({ dest: "uploads/" });

  // Google Drive Auth
  const getDriveClient = () => {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');
    
    if (!email || !key) {
      console.warn("Google Drive credentials missing. Uploads will fail.");
      return null;
    }

    const auth = new JWT({
      email,
      key,
      scopes: ["https://www.googleapis.com/auth/drive.file"],
    });

    return google.drive({ version: "v3", auth });
  };

  // API Routes
  app.post("/api/upload-invoice", upload.single("file"), async (req, res) => {
    try {
      const drive = getDriveClient();
      if (!drive) {
        return res.status(500).json({ error: "Google Drive not configured" });
      }

      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
      const fileName = req.body.fileName || file.originalname;

      const response = await drive.files.create({
        requestBody: {
          name: fileName,
          parents: folderId ? [folderId] : [],
        },
        media: {
          mimeType: file.mimetype,
          body: fs.createReadStream(file.path),
        },
      });

      // Clean up local file
      fs.unlinkSync(file.path);

      res.json({ success: true, fileId: response.data.id });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Failed to upload to Google Drive" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
