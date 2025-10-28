// Frontend API client for communicating with backend
// This file can be included via script tag in index.html

class GearboxAPIClient {
  constructor(baseURL = '') {
    this.baseURL = baseURL;
    this.conversationId = `conv_${Date.now()}`;
    this.userId = this.getUserId();
  }

  getUserId() {
    // Get or create user ID from localStorage
    let userId = localStorage.getItem('gearbox_user_id');
    if (!userId) {
      userId = `user_${Math.random().toString(36).slice(2, 11)}`;
      localStorage.setItem('gearbox_user_id', userId);
    }
    return userId;
  }

  async sendMessage(message) {
    try {
      const response = await fetch(`${this.baseURL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          userId: this.userId,
          conversationId: this.conversationId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || error.error || 'API request failed');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // Reset conversation (start fresh)
  resetConversation() {
    this.conversationId = `conv_${Date.now()}`;
  }
}

// Export for use in React components
window.GearboxAPIClient = GearboxAPIClient;
