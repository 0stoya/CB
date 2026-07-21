import { prisma } from "../db";

const socialUserSelect = {
  id: true,
  nickname: true,
  showOnline: true,
  showLastSeen: true,
  lastSeenAt: true,
  allowDirectMessages: true,
  friendRequestPolicy: true
} as const;

export type SocialErrorCode =
  | "USER_NOT_FOUND"
  | "CANNOT_ADD_SELF"
  | "FRIEND_REQUESTS_DISABLED"
  | "SHARED_CHANNEL_REQUIRED"
  | "REQUEST_ALREADY_PENDING"
  | "ALREADY_FRIENDS"
  | "RELATIONSHIP_BLOCKED"
  | "REQUEST_NOT_FOUND"
  | "FRIENDSHIP_NOT_FOUND"
  | "DIRECT_MESSAGES_DISABLED";

export class SocialError extends Error {
  constructor(public readonly code: SocialErrorCode) {
    super(code);
    this.name = "SocialError";
  }
}

export function socialPairKey(a: string, b: string) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function otherUser<T extends { requesterId: string; recipientId: string; requester: unknown; recipient: unknown }>(
  relationship: T,
  userId: string
) {
  return relationship.requesterId === userId ? relationship.recipient : relationship.requester;
}

export async function getSocialOverview(userId: string, onlineUserIds: Set<string>) {
  const [relationships, conversations, unreadMessages, settings] = await Promise.all([
    prisma.friendship.findMany({
      where: { OR: [{ requesterId: userId }, { recipientId: userId }] },
      include: {
        requester: { select: socialUserSelect },
        recipient: { select: socialUserSelect }
      },
      orderBy: { updatedAt: "desc" }
    }),
    prisma.directConversation.findMany({
      where: { OR: [{ memberAId: userId }, { memberBId: userId }] },
      include: {
        memberA: { select: socialUserSelect },
        memberB: { select: socialUserSelect },
        messages: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 1
        }
      },
      orderBy: { updatedAt: "desc" }
    }),
    prisma.directMessage.findMany({
      where: { recipientId: userId, readAt: null, deletedAt: null },
      select: { senderId: true }
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        friendRequestPolicy: true,
        allowDirectMessages: true,
        showOnline: true,
        showLastSeen: true
      }
    })
  ]);

  const unreadByUser = new Map<string, number>();
  for (const message of unreadMessages) {
    unreadByUser.set(message.senderId, (unreadByUser.get(message.senderId) ?? 0) + 1);
  }

  const conversationByFriend = new Map(
    conversations.map((conversation) => {
      const friend = conversation.memberAId === userId ? conversation.memberB : conversation.memberA;
      const lastMessage = conversation.messages[0] ?? null;
      return [
        friend.id,
        {
          id: conversation.id,
          updatedAt: conversation.updatedAt,
          unread: unreadByUser.get(friend.id) ?? 0,
          lastMessage: lastMessage
            ? {
                id: lastMessage.id,
                senderId: lastMessage.senderId,
                text: lastMessage.text,
                createdAt: lastMessage.createdAt,
                deliveredAt: lastMessage.deliveredAt,
                readAt: lastMessage.readAt
              }
            : null
        }
      ] as const;
    })
  );

  const friends = relationships
    .filter((relationship) => relationship.status === "ACCEPTED")
    .map((relationship) => {
      const friend = otherUser(relationship, userId) as (typeof relationship)["requester"];
      const online = friend.showOnline && onlineUserIds.has(friend.id);
      return {
        relationshipId: relationship.id,
        user: {
          id: friend.id,
          nickname: friend.nickname,
          online,
          lastSeenAt: friend.showLastSeen && !online ? friend.lastSeenAt : null,
          allowDirectMessages: friend.allowDirectMessages
        },
        conversation: conversationByFriend.get(friend.id) ?? null
      };
    })
    .sort((a, b) => {
      const aTime = a.conversation?.updatedAt?.getTime() ?? 0;
      const bTime = b.conversation?.updatedAt?.getTime() ?? 0;
      return bTime - aTime || a.user.nickname.localeCompare(b.user.nickname, "pl");
    });

  const incoming = relationships
    .filter((relationship) => relationship.status === "PENDING" && relationship.recipientId === userId)
    .map((relationship) => ({
      id: relationship.id,
      createdAt: relationship.createdAt,
      user: {
        id: relationship.requester.id,
        nickname: relationship.requester.nickname,
        online: relationship.requester.showOnline && onlineUserIds.has(relationship.requester.id)
      }
    }));

  const outgoing = relationships
    .filter((relationship) => relationship.status === "PENDING" && relationship.requesterId === userId)
    .map((relationship) => ({
      id: relationship.id,
      createdAt: relationship.createdAt,
      user: { id: relationship.recipient.id, nickname: relationship.recipient.nickname }
    }));

  const blocked = relationships
    .filter((relationship) => relationship.status === "BLOCKED" && relationship.requesterId === userId)
    .map((relationship) => ({
      id: relationship.id,
      user: { id: relationship.recipient.id, nickname: relationship.recipient.nickname }
    }));

  return { friends, incoming, outgoing, blocked, settings };
}

export async function searchPeople(userId: string, query: string, onlineUserIds: Set<string>) {
  const normalized = query.trim();
  if (normalized.length < 2) return [];

  const users = await prisma.user.findMany({
    where: {
      id: { not: userId },
      status: "ACTIVE",
      emailVerifiedAt: { not: null },
      nickname: { contains: normalized, mode: "insensitive" }
    },
    select: socialUserSelect,
    take: 20,
    orderBy: { nickname: "asc" }
  });

  const pairKeys = users.map((user) => socialPairKey(userId, user.id));
  const relationships = pairKeys.length
    ? await prisma.friendship.findMany({ where: { pairKey: { in: pairKeys } } })
    : [];
  const relationshipByPair = new Map(relationships.map((relationship) => [relationship.pairKey, relationship]));

  return users.map((user) => {
    const relationship = relationshipByPair.get(socialPairKey(userId, user.id));
    let relationshipStatus: "NONE" | "PENDING_INCOMING" | "PENDING_OUTGOING" | "FRIENDS" | "BLOCKED" = "NONE";
    if (relationship?.status === "ACCEPTED") relationshipStatus = "FRIENDS";
    else if (relationship?.status === "BLOCKED") relationshipStatus = "BLOCKED";
    else if (relationship?.status === "PENDING") {
      relationshipStatus = relationship.requesterId === userId ? "PENDING_OUTGOING" : "PENDING_INCOMING";
    }

    return {
      id: user.id,
      nickname: user.nickname,
      online: user.showOnline && onlineUserIds.has(user.id),
      relationshipStatus
    };
  });
}

async function requireTargetByNickname(nickname: string) {
  const target = await prisma.user.findFirst({
    where: {
      nickname: { equals: nickname.trim(), mode: "insensitive" },
      status: "ACTIVE",
      emailVerifiedAt: { not: null }
    },
    select: socialUserSelect
  });
  if (!target) throw new SocialError("USER_NOT_FOUND");
  return target;
}

async function hasSharedChannel(userId: string, targetId: string) {
  const membership = await prisma.channelMembership.findFirst({
    where: {
      userId,
      channel: { memberships: { some: { userId: targetId } } }
    },
    select: { id: true }
  });
  return Boolean(membership);
}

export async function sendFriendRequest(userId: string, nickname: string) {
  const target = await requireTargetByNickname(nickname);
  if (target.id === userId) throw new SocialError("CANNOT_ADD_SELF");
  if (target.friendRequestPolicy === "NOBODY") throw new SocialError("FRIEND_REQUESTS_DISABLED");
  if (target.friendRequestPolicy === "SHARED_CHANNELS" && !(await hasSharedChannel(userId, target.id))) {
    throw new SocialError("SHARED_CHANNEL_REQUIRED");
  }

  const pairKey = socialPairKey(userId, target.id);
  const existing = await prisma.friendship.findUnique({ where: { pairKey } });
  if (existing?.status === "BLOCKED") throw new SocialError("RELATIONSHIP_BLOCKED");
  if (existing?.status === "ACCEPTED") throw new SocialError("ALREADY_FRIENDS");
  if (existing?.status === "PENDING") throw new SocialError("REQUEST_ALREADY_PENDING");

  const relationship = existing
    ? await prisma.friendship.update({
        where: { id: existing.id },
        data: {
          requesterId: userId,
          recipientId: target.id,
          status: "PENDING",
          respondedAt: null
        }
      })
    : await prisma.friendship.create({
        data: { pairKey, requesterId: userId, recipientId: target.id, status: "PENDING" }
      });

  return { relationship, target };
}

export async function acceptFriendRequest(userId: string, requestId: string) {
  const request = await prisma.friendship.findFirst({
    where: { id: requestId, recipientId: userId, status: "PENDING" }
  });
  if (!request) throw new SocialError("REQUEST_NOT_FOUND");
  const relationship = await prisma.friendship.update({
    where: { id: request.id },
    data: { status: "ACCEPTED", respondedAt: new Date() }
  });
  return relationship;
}

export async function declineFriendRequest(userId: string, requestId: string) {
  const request = await prisma.friendship.findFirst({
    where: { id: requestId, recipientId: userId, status: "PENDING" }
  });
  if (!request) throw new SocialError("REQUEST_NOT_FOUND");
  return prisma.friendship.update({
    where: { id: request.id },
    data: { status: "DECLINED", respondedAt: new Date() }
  });
}

export async function cancelFriendRequest(userId: string, requestId: string) {
  const request = await prisma.friendship.findFirst({
    where: { id: requestId, requesterId: userId, status: "PENDING" }
  });
  if (!request) throw new SocialError("REQUEST_NOT_FOUND");
  await prisma.friendship.delete({ where: { id: request.id } });
  return request;
}

export async function removeFriend(userId: string, friendId: string) {
  const pairKey = socialPairKey(userId, friendId);
  const relationship = await prisma.friendship.findFirst({ where: { pairKey, status: "ACCEPTED" } });
  if (!relationship) throw new SocialError("FRIENDSHIP_NOT_FOUND");
  await prisma.friendship.delete({ where: { id: relationship.id } });
  return relationship;
}

export async function blockUser(userId: string, targetId: string) {
  if (targetId === userId) throw new SocialError("CANNOT_ADD_SELF");
  const target = await prisma.user.findFirst({
    where: { id: targetId, status: "ACTIVE", emailVerifiedAt: { not: null } },
    select: { id: true }
  });
  if (!target) throw new SocialError("USER_NOT_FOUND");

  const pairKey = socialPairKey(userId, targetId);
  return prisma.friendship.upsert({
    where: { pairKey },
    create: {
      pairKey,
      requesterId: userId,
      recipientId: targetId,
      status: "BLOCKED",
      respondedAt: new Date()
    },
    update: {
      requesterId: userId,
      recipientId: targetId,
      status: "BLOCKED",
      respondedAt: new Date()
    }
  });
}

export async function unblockUser(userId: string, targetId: string) {
  const relationship = await prisma.friendship.findFirst({
    where: {
      pairKey: socialPairKey(userId, targetId),
      requesterId: userId,
      recipientId: targetId,
      status: "BLOCKED"
    }
  });
  if (!relationship) throw new SocialError("FRIENDSHIP_NOT_FOUND");
  await prisma.friendship.delete({ where: { id: relationship.id } });
  return relationship;
}

export async function updateSocialSettings(
  userId: string,
  input: {
    friendRequestPolicy: "EVERYONE" | "SHARED_CHANNELS" | "NOBODY";
    allowDirectMessages: boolean;
    showOnline: boolean;
    showLastSeen: boolean;
  }
) {
  return prisma.user.update({
    where: { id: userId },
    data: input,
    select: {
      friendRequestPolicy: true,
      allowDirectMessages: true,
      showOnline: true,
      showLastSeen: true
    }
  });
}

export async function requireAcceptedFriendship(userId: string, friendId: string) {
  const relationship = await prisma.friendship.findFirst({
    where: { pairKey: socialPairKey(userId, friendId), status: "ACCEPTED" }
  });
  if (!relationship) throw new SocialError("FRIENDSHIP_NOT_FOUND");
  return relationship;
}

export async function getAcceptedFriendIds(userId: string) {
  const relationships = await prisma.friendship.findMany({
    where: {
      status: "ACCEPTED",
      OR: [{ requesterId: userId }, { recipientId: userId }]
    },
    select: { requesterId: true, recipientId: true }
  });
  return relationships.map((relationship) =>
    relationship.requesterId === userId ? relationship.recipientId : relationship.requesterId
  );
}

export async function getConversationMessages(userId: string, friendId: string, before?: Date) {
  await requireAcceptedFriendship(userId, friendId);
  const conversation = await prisma.directConversation.findUnique({
    where: { pairKey: socialPairKey(userId, friendId) }
  });
  if (!conversation) return { conversationId: null, messages: [] };

  const messages = await prisma.directMessage.findMany({
    where: {
      conversationId: conversation.id,
      deletedAt: null,
      ...(before ? { createdAt: { lt: before } } : {})
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return { conversationId: conversation.id, messages: messages.reverse() };
}

export async function createDirectMessage(senderId: string, recipientId: string, text: string) {
  await requireAcceptedFriendship(senderId, recipientId);
  const recipient = await prisma.user.findFirst({
    where: { id: recipientId, status: "ACTIVE", emailVerifiedAt: { not: null } },
    select: { id: true, allowDirectMessages: true }
  });
  if (!recipient) throw new SocialError("USER_NOT_FOUND");
  if (!recipient.allowDirectMessages) throw new SocialError("DIRECT_MESSAGES_DISABLED");

  const pairKey = socialPairKey(senderId, recipientId);
  const [memberAId, memberBId] = senderId < recipientId ? [senderId, recipientId] : [recipientId, senderId];
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const conversation = await tx.directConversation.upsert({
      where: { pairKey },
      create: { pairKey, memberAId, memberBId },
      update: { updatedAt: now }
    });
    const message = await tx.directMessage.create({
      data: { conversationId: conversation.id, senderId, recipientId, text }
    });
    await tx.directConversation.update({ where: { id: conversation.id }, data: { updatedAt: now } });
    return message;
  });
}

export async function markMessageDelivered(messageId: string, recipientId: string) {
  return prisma.directMessage.updateMany({
    where: { id: messageId, recipientId, deliveredAt: null },
    data: { deliveredAt: new Date() }
  });
}

export async function syncUndeliveredMessages(userId: string) {
  const messages = await prisma.directMessage.findMany({
    where: { recipientId: userId, deliveredAt: null, deletedAt: null },
    orderBy: { createdAt: "asc" },
    take: 500
  });
  if (!messages.length) return [];
  const now = new Date();
  await prisma.directMessage.updateMany({
    where: { id: { in: messages.map((message) => message.id) } },
    data: { deliveredAt: now }
  });
  return messages.map((message) => ({ ...message, deliveredAt: now }));
}

export async function markConversationRead(userId: string, friendId: string) {
  await requireAcceptedFriendship(userId, friendId);
  const now = new Date();
  await prisma.directMessage.updateMany({
    where: { senderId: friendId, recipientId: userId, readAt: null, deletedAt: null },
    data: { deliveredAt: now, readAt: now }
  });
  return now;
}

export async function touchLastSeen(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } });
}
