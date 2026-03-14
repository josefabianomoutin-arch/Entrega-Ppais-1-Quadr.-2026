import express from "express";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import { google } from "googleapis";
import { Readable } from "stream";
import path from "path";

const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/upload-invoice", upload.single("file"), async (req, res) => {
    console.log("Received upload request");
    try {
      if (!req.file) {
        console.log("No file in request");
        return res.status(400).json({ error: "No file uploaded" });
      }
      console.log("File received:", req.file.originalname);

      const { fileName } = req.body;
      console.log("File name:", fileName);
      console.log("Folder ID:", process.env.GOOGLE_DRIVE_FOLDER_ID);
      console.log("Service Account Email:", process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);

      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        },
        scopes: ["https://www.googleapis.com/auth/drive.file"],
      });

      console.log("Auth initialized");
      const drive = google.drive({ version: "v3", auth });

      const fileMetadata = {
        name: fileName || req.file.originalname,
        parents: process.env.GOOGLE_DRIVE_FOLDER_ID ? [process.env.GOOGLE_DRIVE_FOLDER_ID] : undefined,
      };
      console.log("File metadata:", fileMetadata);

      const media = {
        mimeType: req.file.mimetype,
        body: Readable.from(req.file.buffer),
      };

      console.log("Starting drive.files.create...");
      const file = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: "id, webViewLink",
      });
      console.log("File created successfully:", file.data.id);

      res.json({ id: file.data.id, webViewLink: file.data.webViewLink });
    } catch (error: any) {
      console.error("Error uploading to Google Drive:", error);
      const errorMessage = error.errors ? JSON.stringify(error.errors) : error.message;
      res.status(500).json({ error: "Erro no Google Drive", details: errorMessage });
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
