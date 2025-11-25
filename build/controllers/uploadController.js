"use strict";

const cloudinary = require('cloudinary').v2;
class UploadController {
  constructor() {
    // Configure Cloudinary
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });
  }
  async uploadToCloudinary(req, res) {
    try {
      const {
        base64String,
        existing_image_url
      } = req.body;

      // Trường hợp 1: Có URL ảnh sẵn
      if (existing_image_url) {
        return res.json({
          success: true,
          message: 'Image already exists on Cloudinary',
          secure_url: existing_image_url
        });
      }

      // Trường hợp 2: Có base64String -> upload ảnh mới
      if (!base64String) {
        return res.status(400).json({
          success: false,
          message: 'Either base64String or existing_image_url is required'
        });
      }

      // Xóa prefix nếu có (vd: data:image/png;base64,...)
      const base64Data = base64String.replace(/^data:image\/[a-z]+;base64,/, '');
      const result = await cloudinary.uploader.upload(`data:image/jpeg;base64,${base64Data}`, {
        folder: 'midterm-social-media',
        resource_type: 'image',
        quality: 'auto',
        fetch_format: 'auto'
      });
      return res.json({
        success: true,
        public_id: result.public_id,
        secure_url: result.secure_url,
        url: result.url,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
        created_at: result.created_at
      });
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}
module.exports = new UploadController();