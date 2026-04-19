"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchmakingQueue = void 0;
class MatchmakingQueue {
    queue = [];
    inQueue = new Set();
    add(socketId) {
        if (this.inQueue.has(socketId))
            return false;
        this.queue.push(socketId);
        this.inQueue.add(socketId);
        return true;
    }
    remove(socketId) {
        if (!this.inQueue.has(socketId))
            return false;
        this.inQueue.delete(socketId); // lazy remove
        return true;
    }
    popNextValid() {
        while (this.queue.length) {
            const id = this.queue.shift();
            if (this.inQueue.has(id)) {
                this.inQueue.delete(id);
                return id;
            }
        }
        return undefined;
    }
    size() {
        return this.inQueue.size;
    }
    has(socketId) {
        return this.inQueue.has(socketId);
    }
}
exports.MatchmakingQueue = MatchmakingQueue;
