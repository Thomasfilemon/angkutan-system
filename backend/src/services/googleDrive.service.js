const { google } = require("googleapis");
const stream = require("stream");
const fs = require("fs");
const path = require("path");

function loadServiceAccountCredentials() {
  // Prefer base64 env, fallback to file path
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64) {
    const json = Buffer.from(
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64,
      "base64"
    ).toString("utf8");
    return JSON.parse(json);
  }

  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  if (!keyPath) {
    throw new Error(
      "Missing GOOGLE_SERVICE_ACCOUNT_KEY_PATH or GOOGLE_SERVICE_ACCOUNT_JSON_BASE64"
    );
  }
  const abs = path.isAbsolute(keyPath)
    ? keyPath
    : path.join(__dirname, "..", keyPath);
  const raw = fs.readFileSync(abs, "utf8");
  return JSON.parse(raw);
}

async function createDriveClient() {
  const creds = loadServiceAccountCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  const authClient = await auth.getClient();
  return google.drive({ version: "v3", auth: authClient });
}

async function uploadBufferToDrive({ buffer, filename, mimeType, folderId }) {
  const drive = await createDriveClient();

  const bufferStream = new stream.PassThrough();
  bufferStream.end(buffer);

  const res = await drive.files.create({
    requestBody: {
      name: filename,
      parents: folderId ? [folderId] : undefined,
      mimeType,
    },
    media: {
      mimeType,
      body: bufferStream,
    },
    fields: "id,webViewLink,webContentLink",
  });

  // Make file readable by link (optional but useful for public access)
  try {
    await drive.permissions.create({
      fileId: res.data.id,
      requestBody: { role: "reader", type: "anyone" },
    });
  } catch (permErr) {
    // Non-fatal
    console.warn("Could not set public permission on Drive file:", permErr.message);
  }

  return {
    id: res.data.id,
    webViewLink: res.data.webViewLink,
    webContentLink: res.data.webContentLink,
  };
}

module.exports = {
  uploadBufferToDrive,
};
