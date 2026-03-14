import { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { Readable } from 'stream';
import multer from 'multer';

// Configure multer to use memory storage
const upload = multer({ storage: multer.memoryStorage() });

// Helper function to run middleware in Vercel serverless function
function runMiddleware(req: any, res: any, fn: any) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result: any) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Run multer middleware
    await runMiddleware(req, res, upload.single('file'));

    const fileReq = req as any;
    if (!fileReq.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { fileName } = fileReq.body;

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const drive = google.drive({ version: 'v3', auth });

    const fileMetadata = {
      name: fileName || fileReq.file.originalname,
      parents: process.env.GOOGLE_DRIVE_FOLDER_ID ? [process.env.GOOGLE_DRIVE_FOLDER_ID] : undefined,
    };

    const media = {
      mimeType: fileReq.file.mimetype,
      body: Readable.from(fileReq.file.buffer),
    };

    const file = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink',
    });

    res.status(200).json({ id: file.data.id, webViewLink: file.data.webViewLink });
  } catch (error: any) {
    console.error('Error uploading to Google Drive:', error);
    // Log the full error object to help diagnose
    if (error.errors) {
      console.error("Google Drive API errors:", JSON.stringify(error.errors, null, 2));
    }
    res.status(500).json({ error: 'Failed to upload file', details: error.message });
  }
}
