import express from "express";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import { google } from "googleapis";
import { JWT } from "google-auth-library";
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
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
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

      let credentials;
      let credentialsSource = "none";
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
        try {
          credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
          credentialsSource = "JSON_ENV";
          console.log("Loaded credentials from GOOGLE_APPLICATION_CREDENTIALS_JSON");
        } catch (e) {
          console.error("Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON", e);
        }
      }

      if (!credentials) {
        credentials = {
          type: "service_account",
          project_id: process.env.GOOGLE_PROJECT_ID,
          private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
          private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          client_id: process.env.GOOGLE_CLIENT_ID,
          auth_uri: "https://accounts.google.com/o/oauth2/auth",
          token_uri: "https://oauth2.googleapis.com/token",
          auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
          client_x509_cert_url: process.env.GOOGLE_CLIENT_X509_CERT_URL,
        };
        // Ensure client_email is set if it was missing from the env var
        credentials.client_email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || credentials.client_email;
        
        credentialsSource = "MANUAL_ENV";
        console.log("Constructed credentials manually:", JSON.stringify({
          ...credentials,
          private_key: credentials.private_key ? '***' : 'MISSING'
        }));
      }

      console.log("Credentials keys:", Object.keys(credentials));
      console.log("Client Email:", credentials.client_email);
      console.log("Full Credentials Object (sanitized):", JSON.stringify({
        ...credentials,
        private_key: credentials.private_key ? '***' : 'MISSING'
      }));

      if (!credentials.client_email || !credentials.private_key) {
        const missing = [];
        if (!credentials.client_email) missing.push("GOOGLE_SERVICE_ACCOUNT_EMAIL");
        if (!credentials.private_key) missing.push("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
        
        const sanitized = {
          ...credentials,
          private_key: credentials.private_key ? '***' : 'MISSING'
        };
        
        throw new Error(`Missing environment variables: ${missing.join(", ")}. 
          Source: ${credentialsSource},
          Credentials: ${JSON.stringify(sanitized)}. 
          Please check your app settings.`);
      }

      // Use GoogleAuth to automatically load credentials from the environment
      const auth = new GoogleAuth({
        scopes: ["https://www.googleapis.com/auth/drive.file"],
      });

      console.log("Auth initialized using GoogleAuth");
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
      // Ensure we get the full error details
      const errorMessage = error.errors ? JSON.stringify(error.errors) : (error.message || String(error));
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
