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

module.exports = { uploadMulterFileToCloudinary, deleteFromCloudinary, extractPublicId };
