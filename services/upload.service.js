const cloudinary = require('cloudinary').v2;
const { promisify } = require('util');

class UploadService {
  constructor() {
    // Configure Cloudinary
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });

    this.uploadAsync = promisify(cloudinary.uploader.upload);
    this.destroyAsync = promisify(cloudinary.uploader.destroy);
  }

  async uploadToCloudinary(base64String) {
    try {
      if (!base64String) {
        throw new Error('Base64 string is required');
      }

      // Remove data URL prefix if present
      const base64Data = base64String.replace(/^data:image\/[a-z]+;base64,/, '');

      const result = await this.uploadAsync(`data:image/jpeg;base64,${base64Data}`, {
        folder: 'midterm-social-media',
        resource_type: 'image',
        quality: 'auto',
        fetch_format: 'auto'
      });

      return {
        public_id: result.public_id,
        secure_url: result.secure_url,
        url: result.url,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
        created_at: result.created_at
      };
    } catch (error) {
      throw new Error(`Error uploading to Cloudinary: ${error.message}`);
    }
  }

  async uploadImage(file) {
    try {
      if (!file) {
        throw new Error('File is required');
      }

      const result = await this.uploadAsync(file.buffer, {
        folder: 'midterm-social-media',
        resource_type: 'image',
        quality: 'auto',
        fetch_format: 'auto',
        public_id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      });

      return {
        public_id: result.public_id,
        secure_url: result.secure_url,
        url: result.url,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
        created_at: result.created_at,
        original_name: file.originalname
      };
    } catch (error) {
      throw new Error(`Error uploading image: ${error.message}`);
    }
  }

  async uploadMultipleImages(files) {
    try {
      if (!files || files.length === 0) {
        throw new Error('Files are required');
      }

      const uploadPromises = files.map(file => this.uploadImage(file));
      const results = await Promise.all(uploadPromises);

      return results;
    } catch (error) {
      throw new Error(`Error uploading multiple images: ${error.message}`);
    }
  }

  async deleteImage(publicId) {
    try {
      if (!publicId) {
        throw new Error('Public ID is required');
      }

      const result = await this.destroyAsync(publicId);

      return {
        result: result.result,
        public_id: publicId,
        deleted_at: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Error deleting image: ${error.message}`);
    }
  }

  async getImageInfo(publicId) {
    try {
      const result = await cloudinary.api.resource(publicId);

      return {
        public_id: result.public_id,
        secure_url: result.secure_url,
        url: result.url,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
        created_at: result.created_at,
        tags: result.tags,
        context: result.context
      };
    } catch (error) {
      throw new Error(`Error getting image info: ${error.message}`);
    }
  }

  async transformImage(publicId, transformations = {}) {
    try {
      const defaultTransformations = {
        quality: 'auto',
        fetch_format: 'auto',
        ...transformations
      };

      const url = cloudinary.url(publicId, defaultTransformations);

      return {
        transformed_url: url,
        public_id: publicId,
        transformations: defaultTransformations
      };
    } catch (error) {
      throw new Error(`Error transforming image: ${error.message}`);
    }
  }

  async generateSocialMediaImages(publicId, platforms = ['facebook', 'instagram', 'twitter']) {
    try {
      const platformSizes = {
        facebook: { width: 1200, height: 630, crop: 'fill' },
        instagram: { width: 1080, height: 1080, crop: 'fill' },
        twitter: { width: 1200, height: 675, crop: 'fill' },
        linkedin: { width: 1200, height: 627, crop: 'fill' }
      };

      const results = {};

      for (const platform of platforms) {
        if (platformSizes[platform]) {
          const transformation = platformSizes[platform];
          const url = cloudinary.url(publicId, transformation);
          
          results[platform] = {
            url: url,
            width: transformation.width,
            height: transformation.height,
            crop: transformation.crop
          };
        }
      }

      return results;
    } catch (error) {
      throw new Error(`Error generating social media images: ${error.message}`);
    }
  }

  async uploadFromUrl(imageUrl) {
    try {
      if (!imageUrl) {
        throw new Error('Image URL is required');
      }

      const result = await this.uploadAsync(imageUrl, {
        folder: 'midterm-social-media',
        resource_type: 'image',
        quality: 'auto',
        fetch_format: 'auto'
      });

      return {
        public_id: result.public_id,
        secure_url: result.secure_url,
        url: result.url,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
        created_at: result.created_at,
        source_url: imageUrl
      };
    } catch (error) {
      throw new Error(`Error uploading from URL: ${error.message}`);
    }
  }
}

module.exports = new UploadService();