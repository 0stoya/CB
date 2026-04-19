import type { Socket } from "socket.io";

type RoomId = string;

export class RoomService {
  private socketToRoom = new Map<string, RoomId>();
  private socketToPartner = new Map<string, string>();

  isInRoom(socketId: string) {
    return this.socketToRoom.has(socketId);
  }

  getRoom(socketId: string) {
    return this.socketToRoom.get(socketId);
  }

  getPartner(socketId: string) {
    return this.socketToPartner.get(socketId);
  }

  createRoom(a: Socket, b: Socket): RoomId {
    const roomId = `room_${a.id}_${b.id}_${Date.now()}`;
    this.socketToRoom.set(a.id, roomId);
    this.socketToRoom.set(b.id, roomId);
    this.socketToPartner.set(a.id, b.id);
    this.socketToPartner.set(b.id, a.id);

    a.join(roomId);
    b.join(roomId);

    return roomId;
  }

  clear(socketId: string) {
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