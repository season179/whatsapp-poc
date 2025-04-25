import prisma from './prisma';

// Session CRUD
export async function createSession(sessionId: string) {
  return prisma.session.create({ data: { sessionId } });
}

export async function getSession(sessionId: string) {
  return prisma.session.findUnique({ where: { sessionId } });
}

// Chat CRUD
export async function createChat(chatId: string, name?: string) {
  return prisma.chat.create({ data: { chatId, name } });
}

export async function getChats() {
  return prisma.chat.findMany();
}

// Message CRUD
export interface MessageInput {
  messageId: string;
  chatId: number;
  fromMe: boolean;
  content?: string;
  timestamp: Date;
  type: string;
}

export async function createMessage(input: MessageInput) {
  return prisma.message.create({ data: input });
}

export async function getMessagesByChat(chatId: number) {
  return prisma.message.findMany({
    where: { chatId },
    orderBy: { timestamp: 'asc' },
  });
}
