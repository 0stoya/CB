"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomService = void 0;
class RoomService {
    socketToRoom = new Map();
    socketToPartner = new Map();
    isInRoom(socketId) {
        return this.socketToRoom.has(socketId);
    }
    getRoom(socketId) {
        return this.socketToRoom.get(socketId);
    }
    getPartner(socketId) {
        return this.socketToPartner.get(socketId);
    }
    createRoom(a, b) {
        const roomId = `room_${a.id}_${b.id}_${Date.now()}`;
        this.socketToRoom.set(a.id, roomId);
        this.socketToRoom.set(b.id, roomId);
        this.socketToPartner.set(a.id, b.id);
        this.socketToPartner.set(b.id, a.id);
        a.join(roomId);
        b.join(roomId);
        return roomId;
    }
    clear(socketId) {
        const roomId = this.socketToRoom.get(socketId);
        const partnerId = this.socketToPartner.get(socketId);
        this.socketToRoom.delete(socketId);
        this.socketToPartner.delete(socketId);
        return { roomId, partnerId };
    }
    activeRoomsCount() {
        // each room has 2 sockets mapped
        return Math.floor(this.socketToRoom.size / 2);
    }
}
exports.RoomService = RoomService;
