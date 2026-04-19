export class MatchmakingQueue {
  private queue: string[] = [];
  private inQueue = new Set<string>();

  add(socketId: string) {
    if (this.inQueue.has(socketId)) return false;
    this.queue.push(socketId);
    this.inQueue.add(socketId);
    return true;
  }

  remove(socketId: string) {
    if (!this.inQueue.has(socketId)) return false;
    this.inQueue.delete(socketId); // lazy remove
    return true;
  }

  popNextValid(): string | undefined {
    while (this.queue.length) {
      const id = this.queue.shift()!;
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

  has(socketId: string) {
    return this.inQueue.has(socketId);
  }
}