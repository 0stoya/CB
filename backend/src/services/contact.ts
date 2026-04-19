export type ContactCategory = "sugestia" | "blad" | "szukam" | "inne";
export type ContactMessage = {
  id: string;
  ip: string;
  email: string;
  category: string;
  subject: string;
  message: string;
  createdAt: number;
};


class ContactService {
  private messages: ContactMessage[] = [];

  addMessage(msg: Omit<ContactMessage, 'id' | 'createdAt'>) {
    const newMsg = {
      ...msg,
      id: Math.random().toString(36).substring(2, 10),
      createdAt: Date.now()
    };
    this.messages.unshift(newMsg);
    
    if (this.messages.length > 100) this.messages.pop();
    return newMsg;
  }

  getMessages() {
    return this.messages;
  }

  deleteMessage(id: string) {
    this.messages = this.messages.filter(m => m.id !== id);
  }
}

export const contactService = new ContactService();