const axios = require('axios');

const FB_GRAPH_URL = `https://graph.facebook.com/v19.0`;
const PAGE_ID = process.env.FACEBOOK_PAGE_ID;
const ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;

class FacebookService {
    static async postImagesWithMessage(imageUrls, message) {
  const attachedMedia = [];

  for (const imageUrl of imageUrls) {
    const url = `${FB_GRAPH_URL}/${PAGE_ID}/photos`;
    const { data } = await axios.post(url, null, {
      params: { url: imageUrl, published: false, access_token: ACCESS_TOKEN }
    });

    attachedMedia.push({ media_fbid: data.id });
  }

  const feedUrl = `${FB_GRAPH_URL}/${PAGE_ID}/feed`;
  const { data: feedData } = await axios.post(feedUrl, null, {
    params: {
      message: message || '',
      attached_media: attachedMedia,
      access_token: ACCESS_TOKEN
    }
  });

  return feedData.id;
}

static async postImageWithMessage(imageUrl, message) {
  const url = `${FB_GRAPH_URL}/${PAGE_ID}/feed`;
  try {
    const { data } = await axios.post(url, null, {
      params: {
        message: message || '',
        link: imageUrl, // hoặc dùng attached_media nếu nhiều ảnh
        access_token: ACCESS_TOKEN
      }
    });

    console.log('Facebook feed response:', data);
    return data.id; // đây là post_id luôn
  } catch (error) {
    console.error('Error posting to Facebook feed:', error.response?.data || error.message);
    throw error;
  }
}


    static async getEngagement(postId) {
    // Fetch likes, comments, shares summary
    const fields = 'shares,comments.summary(true),reactions.summary(true)';
    const url = `${FB_GRAPH_URL}/${encodeURIComponent(postId)}`;

    try {
      const { data } = await axios.get(url, {
        params: {
          fields,
          access_token: ACCESS_TOKEN
        }
      });

      const likes = data.reactions?.summary?.total_count || 0;
      const comments = data.comments?.summary?.total_count || 0;
      const shares = data.shares?.count || 0;
      const engagementScore = likes + comments * 2 + shares * 3;
      return { likes, comments, shares, engagementScore };
    } catch (error) {
      // Log helpful debugging info
      console.error('Facebook getEngagement error for postId:', postId);
      if (error.response) {
        console.error('Facebook response status:', error.response.status);
        console.error('Facebook response data:', JSON.stringify(error.response.data));
      } else {
        console.error('Facebook request error:', error.message);
      }
      // Throw a clearer error for callers
      throw new Error(`Failed to fetch engagement for post ${postId}: ${error.response ? JSON.stringify(error.response.data) : error.message}`);
    }
    }
}

module.exports = FacebookService;


