const { ChatAIResponse } = require('../models');

const chatAIResponses = [
  // Greeting responses
  { keyword: 'xin chào', response_text: 'Xin chào! Tôi có thể giúp gì cho bạn hôm nay?', category: 'greeting' },
  { keyword: 'chào', response_text: 'Chào bạn! Rất vui được gặp bạn. 😊', category: 'greeting' },
  { keyword: 'hello', response_text: 'Hello! How can I help you today?', category: 'greeting' },
  { keyword: 'hi', response_text: 'Hi there! Welcome to Chuyên Đề 3! 🌟', category: 'greeting' },
   // General information
   { keyword: 'thông tin', response_text: 'Bạn muốn tìm hiểu về lĩnh vực nào ạ? Chúng tôi có bài viết về du lịch, công nghệ, giáo dục, làm đẹp và nhiều hơn nữa. 💬', category: 'info' },
   { keyword: 'tin tức', response_text: 'Tin tức mới nhất luôn được cập nhật mỗi ngày! Bạn quan tâm đến chủ đề nào ạ? 📰', category: 'info' },
  // Services & Support
  { keyword: 'dịch vụ', response_text: 'Chúng tôi cung cấp nhiều dịch vụ đa dạng. Bạn có thể cho biết cụ thể bạn cần hỗ trợ về lĩnh vực nào không? 🛠️', category: 'service' },
  { keyword: 'hỗ trợ', response_text: 'Tôi luôn sẵn sàng hỗ trợ bạn! Vui lòng mô tả vấn đề hoặc yêu cầu của bạn nhé. 💬', category: 'service' },
  { keyword: 'tư vấn', response_text: 'Bạn cần tư vấn về sản phẩm, khóa học hay tour du lịch nào không? Inbox để được hỗ trợ chi tiết nha 💌', category: 'service' },

  // Contact information
  { keyword: 'liên hệ', response_text: 'Bạn có thể liên hệ với chúng tôi qua inbox, số điện thoại hoặc email bên dưới bài viết nhé. 📞', category: 'contact' },
  { keyword: 'địa chỉ', response_text: 'Chúng tôi có văn phòng tại nhiều khu vực khác nhau. Bạn ở đâu để tôi gửi thông tin chi nhánh gần nhất nhé? 🗺️', category: 'contact' },
  { keyword: 'hotline', response_text: 'Hotline hỗ trợ 24/7 của chúng tôi là: 0123-456-789 📞', category: 'contact' },
  { keyword: 'email', response_text: 'Bạn có thể gửi mail cho chúng tôi qua địa chỉ: contact@fanpage.com 📧', category: 'contact' },

  
   // Services & Support
  // Travel information
  { keyword: 'địa điểm', response_text: 'Chúng tôi có nhiều điểm đến hấp dẫn như Đà Nẵng, Hội An, Nha Trang, Phú Quốc. Bạn quan tâm đến địa điểm nào? ✈️', category: 'travel' },
  { keyword: 'tour', response_text: 'Chúng tôi cung cấp nhiều tour du lịch đa dạng. Bạn muốn tìm hiểu tour nào? 🎒', category: 'travel' },
  { keyword: 'du lịch', response_text: 'Chuyên Đề 3 chuyên tổ chức các tour du lịch chất lượng cao. Bạn có kế hoạch đi đâu không? 🌍', category: 'travel' },

  // Contact information
  { keyword: 'giờ mở cửa', response_text: 'Chúng tôi hoạt động từ 8:00 AM đến 10:00 PM từ thứ 2 đến chủ nhật.', category: 'contact' },
  { keyword: 'địa chỉ', response_text: 'Địa chỉ của chúng tôi là: 123 Đường ABC, Quận XYZ, TP.HCM 📍', category: 'contact' },
  { keyword: 'điện thoại', response_text: 'Số điện thoại liên hệ: 0123-456-789 📞', category: 'contact' },
  { keyword: 'email', response_text: 'Email liên hệ: contact@goldentrip.com 📧', category: 'contact' },

  // Pricing
  { keyword: 'giá', response_text: 'Bảng giá chi tiết của chúng tôi rất cạnh tranh. Inbox để được tư vấn giá tốt nhất nhé! 💰', category: 'pricing' },
  { keyword: 'giá cả', response_text: 'Chúng tôi có nhiều gói tour với giá hợp lý. Bạn quan tâm tour nào? 💵', category: 'pricing' },
  { keyword: 'khuyến mãi', response_text: 'Hiện tại chúng tôi có nhiều ưu đãi hấp dẫn! Inbox để biết thêm chi tiết nhé! 🎉', category: 'pricing' },

  // Services
  { keyword: 'dịch vụ', response_text: 'Chúng tôi cung cấp các dịch vụ du lịch chất lượng cao: tour trong nước, quốc tế, đặt vé máy bay, khách sạn. Bạn cần dịch vụ nào? 🛎️', category: 'service' },
  { keyword: 'sản phẩm', response_text: 'Chúng tôi có nhiều sản phẩm du lịch đa dạng. Bạn quan tâm đến loại tour nào? 🎯', category: 'service' },
  { keyword: 'hỗ trợ', response_text: 'Tôi luôn sẵn sàng hỗ trợ bạn. Vui lòng cho tôi biết bạn cần giúp đỡ gì? 🤝', category: 'service' },

  // Specific destinations
  { keyword: 'đà nẵng', response_text: 'Đà Nẵng là điểm đến tuyệt vời với bãi biển đẹp, cầu Vàng nổi tiếng. Bạn muốn biết thêm thông tin tour Đà Nẵng không? 🏖️', category: 'destination' },
  { keyword: 'hội an', response_text: 'Hội An - phố cổ quyến rũ với kiến trúc độc đáo. Chúng tôi có tour Hội An 1 ngày và 2 ngày. Bạn quan tâm không? 🏮', category: 'destination' },
  { keyword: 'nha trang', response_text: 'Nha Trang với bãi biển tuyệt đẹp và các hoạt động vui chơi thú vị. Tour Nha Trang của chúng tôi rất được yêu thích! 🏝️', category: 'destination' },
  { keyword: 'phú quốc', response_text: 'Phú Quốc - thiên đường nghỉ dưỡng với biển xanh, cát trắng. Tour Phú Quốc 3N2Đ của chúng tôi rất hấp dẫn! 🏖️', category: 'destination' },

  // Booking
  { keyword: 'đặt tour', response_text: 'Để đặt tour, bạn có thể: 1) Inbox cho chúng tôi 2) Gọi hotline 3) Đến văn phòng. Chúng tôi sẽ tư vấn chi tiết! 📝', category: 'booking' },
  { keyword: 'đặt', response_text: 'Bạn muốn đặt tour nào? Inbox cho chúng tôi để được tư vấn và hỗ trợ đặt tour nhé! 🎫', category: 'booking' },
  { keyword: 'booking', response_text: 'We can help you book tours, hotels, and flights. Please inbox us for detailed booking assistance! 🎯', category: 'booking' },

  // General responses
  { keyword: 'cảm ơn', response_text: 'Không có gì! Tôi luôn sẵn sàng giúp đỡ bạn. Có gì cần hỗ trợ thêm không? 😊', category: 'general' },
  { keyword: 'tạm biệt', response_text: 'Tạm biệt! Hẹn gặp lại bạn sau nhé! Chúc bạn có một ngày tốt lành! 👋', category: 'general' },
  { keyword: 'tốt', response_text: 'Tuyệt vời! Chúng tôi luôn cố gắng mang đến dịch vụ tốt nhất cho khách hàng. 😊', category: 'general' },
  { keyword: 'đẹp', response_text: 'Cảm ơn bạn! Chúng tôi rất vui khi nhận được phản hồi tích cực từ khách hàng. 💕', category: 'general' }
];

async function seedChatAIResponses() {
  try {
    console.log('🌱 Seeding ChatAI Responses...');
    
    for (const response of chatAIResponses) {
      await ChatAIResponse.upsert({
        keyword: response.keyword,
        response_text: response.response_text,
        category: response.category,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      });
    }
    
    console.log(`✅ Seeded ${chatAIResponses.length} ChatAI responses.`);
  } catch (error) {
    console.error('❌ Error seeding ChatAI responses:', error);
    throw error;
  }
}

module.exports = seedChatAIResponses;
