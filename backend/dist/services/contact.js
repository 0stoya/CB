"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contactService = void 0;
class ContactService {
    messages = [];
    addMessage(msg) {
        const newMsg = {
            ...msg,
            id: Math.random().toString(36).substring(2, 10),
            createdAt: Date.now()
        };
        this.messages.unshift(newMsg);
        if (this.messages.length > 100)
            this.messages.pop();
        return newMsg;
    }
    getMessages() {
        return this.messages;
    }
    deleteMessage(id) {
        this.messages = this.messages.filter(m => m.id !== id);
    }
}
exports.contactService = new ContactService();
