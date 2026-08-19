const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function extractPublicId(cloudinaryUrl) {
  if (!cloudinaryUrl || !cloudinaryUrl.includes('res.cloudinary.com')) return null;
  try {
    const url = new URL(cloudinaryUrl);
    const parts = url.pathname.split('/');
    const uploadIndex = parts.indexOf('upload');
    if (uploadIndex === -1) return null;
    let afterUpload = parts.slice(uploadIndex + 1);
    if (/^v\d+$/.test(afterUpload[0])) afterUpload = afterUpload.slice(1);
    const withExt = afterUpload.join('/');
    return withExt.replace(/\.[^/.]+$/, '');
  } catch {
    return null;
  }
}

async function deleteFromCloudinary(imageUrl) {
  const publicId = extractPublicId(imageUrl);
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.warn(`Cloudinary delete failed (${publicId}):`, err.message);
  }
}

function uploadBufferToCloudinary(buffer, folder = 'idc-valorant') {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder, resource_type: 'image' }, (err, result) => {
      if (err) return reject(err);
      resolve(result.secure_url);
    });
    Readable.from(buffer).pipe(stream);
  });
}

async function uploadMulterFileToCloudinary(file, folder = 'idc-valorant') {
  if (!file) return '';
  try {
    return await uploadBufferToCloudinary(file.buffer, folder);
  } catch (err) {
    console.error('Upload to Cloudinary failed:', err.message);
    return '';
  }
}

/* ============================================================
   GOOGLE DRIVE -> CLOUDINARY
   Pulls a file down from a public Drive share link and re-uploads
   the bytes to Cloudinary server-side, mirroring uploadMulterFileToCloudinary.
============================================================ */

// Pulls the file ID out of any of the common Drive share URL shapes:
//   https://drive.google.com/file/d/FILE_ID/view?usp=sharing
//   https://drive.google.com/open?id=FILE_ID
//   https://drive.google.com/uc?id=FILE_ID&export=download
function extractDriveFileId(driveUrl) {
  if (!driveUrl) return null;
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]{10,})/, // /file/d/ID/...
    /[?&]id=([a-zA-Z0-9_-]{10,})/,     // ?id=ID (open? or uc?)
    /\/d\/([a-zA-Z0-9_-]{10,})/,       // /d/ID
  ];
  for (const re of patterns) {
    const match = driveUrl.match(re);
    if (match) return match[1];
  }
  return null;
}

// Downloads the raw file bytes for a Drive file ID. Small/public files come
// back directly; larger ones first serve an HTML "can't scan this file for
// viruses" interstitial that has to be resolved with a confirm token.
async function downloadDriveFileBuffer(fileId) {
  let res = await fetch(`https://drive.google.com/uc?export=download&id=${fileId}`, { redirect: 'follow' });
  let contentType = res.headers.get('content-type') || '';

  if (contentType.includes('text/html')) {
    const html = await res.text();
    const confirmMatch = html.match(/confirm=([0-9A-Za-z_-]+)/) || html.match(/name="confirm"\s+value="([0-9A-Za-z_-]+)"/);
    const uuidMatch = html.match(/name="uuid"\s+value="([0-9A-Za-z_-]+)"/);

    if (!confirmMatch) {
      throw new Error('Could not download from Drive — make sure sharing is set to "Anyone with the link".');
    }

    const confirmUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=${confirmMatch[1]}${uuidMatch ? `&uuid=${uuidMatch[1]}` : ''}`;
    res = await fetch(confirmUrl, { redirect: 'follow' });
    contentType = res.headers.get('content-type') || '';

    if (contentType.includes('text/html')) {
      throw new Error('Drive returned a page instead of a file — the link may be private or restricted.');
    }
  }

  if (!res.ok) throw new Error(`Drive download failed (HTTP ${res.status}).`);

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (buffer.length === 0) throw new Error('Downloaded file from Drive was empty.');
  return buffer;
}

async function uploadDriveLinkToCloudinary(driveUrl, folder = 'idc-valorant') {
  const fileId = extractDriveFileId(driveUrl);
  if (!fileId) throw new Error('That doesn\'t look like a valid Google Drive share link.');

  const buffer = await downloadDriveFileBuffer(fileId);
  return uploadBufferToCloudinary(buffer, folder);
}

module.exports = {
  uploadMulterFileToCloudinary,
  uploadDriveLinkToCloudinary,
  deleteFromCloudinary,
  extractPublicId,
  extractDriveFileId,
};