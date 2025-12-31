const cloudinary = require("cloudinary").v2;
const AWS = require("aws-sdk");
const fs = require("fs").promises;
const path = require("path");

// Configure Cloudinary
if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

// Configure AWS S3
let s3;
if (process.env.AWS_S3_BUCKET) {
  AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
  });
  s3 = new AWS.S3();
}

// Upload to Cloudinary
const uploadToCloudinary = async (fileBuffer, fileName) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        public_id: `pdfs/${path.parse(fileName).name}`,
        format: "pdf",
        folder: "pdf-practice-pro",
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );

    uploadStream.end(fileBuffer);
  });
};

// Upload to AWS S3
const uploadToS3 = async (fileBuffer, fileName, folder = "pdfs") => {
  const params = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: `${folder}/${fileName}`,
    Body: fileBuffer,
    ContentType: "application/pdf",
    ACL: "public-read",
  };

  const result = await s3.upload(params).promise();
  return result.Location;
};

// Save locally (for development)
const saveLocally = async (fileBuffer, fileName) => {
  const uploadsDir = path.join(__dirname, "../uploads");

  try {
    await fs.access(uploadsDir);
  } catch {
    await fs.mkdir(uploadsDir, { recursive: true });
  }

  const filePath = path.join(uploadsDir, fileName);
  await fs.writeFile(filePath, fileBuffer);

  return `/uploads/${fileName}`;
};

// Main upload function
const uploadFile = async (fileBuffer, fileName) => {
  try {
    if (process.env.CLOUDINARY_CLOUD_NAME) {
      return await uploadToCloudinary(fileBuffer, fileName);
    } else if (process.env.AWS_S3_BUCKET) {
      const url = await uploadToS3(fileBuffer, fileName);
      return { secure_url: url };
    } else {
      const url = await saveLocally(fileBuffer, fileName);
      return { secure_url: url };
    }
  } catch (error) {
    console.error("File upload error:", error);
    throw new Error("Failed to upload file");
  }
};

module.exports = {
  uploadToCloudinary,
  uploadToS3,
  saveLocally,
  uploadFile,
};
