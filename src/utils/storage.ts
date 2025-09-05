import { LocalStorage } from "@raycast/api";
import { Message } from "discord.js-selfbot-v13";

const PINNED_SERVERS_KEY = "pinnedServers";
const PINNED_DMS_KEY = "pinnedDMs";
const DM_NICKNAMES_KEY = "dmNicknames";
const LAST_MESSAGES_KEY = "lastMessages";

interface CachedMessage {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  createdTimestamp: number;
  embeds?: {
    title?: string;
    description?: string;
    url?: string;
    image?: { url: string };
    fields?: { name: string; value: string }[];
  }[];
  attachments?: { id: string; name: string; url: string }[];
}

export async function getPinnedServers(): Promise<string[]> {
  const pinnedServers = await LocalStorage.getItem<string>(PINNED_SERVERS_KEY);
  return pinnedServers ? JSON.parse(pinnedServers) : [];
}

export async function addPinnedServer(serverId: string): Promise<void> {
  const pinnedServers = await getPinnedServers();
  if (!pinnedServers.includes(serverId)) {
    pinnedServers.push(serverId);
    await LocalStorage.setItem(PINNED_SERVERS_KEY, JSON.stringify(pinnedServers));
  }
}

export async function removePinnedServer(serverId: string): Promise<void> {
  let pinnedServers = await getPinnedServers();
  pinnedServers = pinnedServers.filter((id) => id !== serverId);
  await LocalStorage.setItem(PINNED_SERVERS_KEY, JSON.stringify(pinnedServers));
}

export async function getPinnedDMs(): Promise<string[]> {
  const pinnedDMs = await LocalStorage.getItem<string>(PINNED_DMS_KEY);
  return pinnedDMs ? JSON.parse(pinnedDMs) : [];
}

export async function addPinnedDM(dmId: string): Promise<void> {
  const pinnedDMs = await getPinnedDMs();
  if (!pinnedDMs.includes(dmId)) {
    pinnedDMs.push(dmId);
    await LocalStorage.setItem(PINNED_DMS_KEY, JSON.stringify(pinnedDMs));
  }
}

export async function removePinnedDM(dmId: string): Promise<void> {
  let pinnedDMs = await getPinnedDMs();
  pinnedDMs = pinnedDMs.filter((id) => id !== dmId);
  await LocalStorage.setItem(PINNED_DMS_KEY, JSON.stringify(pinnedDMs));
}

export async function getDmNicknames(): Promise<Record<string, string>> {
  const dmNicknames = await LocalStorage.getItem<string>(DM_NICKNAMES_KEY);
  return dmNicknames ? JSON.parse(dmNicknames) : {};
}

export async function setDmNickname(dmId: string, nickname: string): Promise<void> {
  const dmNicknames = await getDmNicknames();
  dmNicknames[dmId] = nickname;
  await LocalStorage.setItem(DM_NICKNAMES_KEY, JSON.stringify(dmNicknames));
}

export async function removeDmNickname(dmId: string): Promise<void> {
  const dmNicknames = await getDmNicknames();
  delete dmNicknames[dmId];
  await LocalStorage.setItem(DM_NICKNAMES_KEY, JSON.stringify(dmNicknames));
}

export async function saveLastMessages(messages: Record<string, Message | undefined>): Promise<void> {
  const serializableMessages: Record<string, CachedMessage> = {};
  for (const dmId in messages) {
    const message = messages[dmId];
    if (message) {
      serializableMessages[dmId] = {
        id: message.id,
        channelId: message.channelId,
        authorId: message.author.id,
        content: message.content,
        createdTimestamp: message.createdTimestamp,
      };
    }
  }
  await LocalStorage.setItem(LAST_MESSAGES_KEY, JSON.stringify(serializableMessages));
}

export async function getLastMessages(): Promise<Record<string, CachedMessage>> {
  const cachedMessages = await LocalStorage.getItem<string>(LAST_MESSAGES_KEY);
  return cachedMessages ? JSON.parse(cachedMessages) : {};
}

export async function saveMessages(dmId: string, messages: Message[]): Promise<void> {
  const serializableMessages: CachedMessage[] = messages.map(message => ({
    id: message.id,
    channelId: message.channelId,
    authorId: message.author.id,
    content: message.content,
    createdTimestamp: message.createdTimestamp,
    embeds: message.embeds.map(embed => ({
      title: embed.title || undefined,
      description: embed.description || undefined,
      url: embed.url || undefined,
      image: embed.image ? { url: embed.image.url } : undefined,
      fields: embed.fields.map(field => ({ name: field.name, value: field.value })),
    })),
    attachments: Array.from(message.attachments.values()).map(attachment => ({
      id: attachment.id,
      name: attachment.name,
      url: attachment.url,
    })),
  }));
  await LocalStorage.setItem(`messages_${dmId}`, JSON.stringify(serializableMessages));
}

export async function getMessages(dmId: string): Promise<Message[]> {
  const cached = await LocalStorage.getItem<string>(`messages_${dmId}`);
  if (!cached) return [];
  const parsed: CachedMessage[] = JSON.parse(cached);
  // Convert CachedMessage back to Message-like objects for consistency with discord.js-selfbot-v13
  return parsed.map(cachedMsg => ({
    id: cachedMsg.id,
    channelId: cachedMsg.channelId,
    author: { id: cachedMsg.authorId }, // Simplified author for caching
    content: cachedMsg.content,
    createdTimestamp: cachedMsg.createdTimestamp,
    embeds: cachedMsg.embeds || [],
    attachments: new Map(cachedMsg.attachments?.map(att => [att.id, att as any])), // Convert back to Map for attachments
  }) as Message); // Cast to Message as we only need specific properties for display
}
