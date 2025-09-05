import { LocalStorage } from "@raycast/api";
import { Message } from "discord.js-selfbot-v13";
import { Guild, User } from "discord.js-selfbot-v13";

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

interface CachedGuild {
  id: string;
  name: string;
  iconURL: string | null;
}

interface CachedUserProfile {
  id: string;
  username: string;
  displayAvatarURL: string | null;
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

export async function savePinnedServersOrder(orderedServerIds: string[]): Promise<void> {
  await LocalStorage.setItem(PINNED_SERVERS_KEY, JSON.stringify(orderedServerIds));
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

export async function saveMessages(dmId: string, messages: Message[]): Promise<boolean> {
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

  const existingCached = await LocalStorage.getItem<string>(`messages_${dmId}`);
  const existingSerializableMessages: CachedMessage[] = existingCached ? JSON.parse(existingCached) : [];

  if (JSON.stringify(serializableMessages) !== JSON.stringify(existingSerializableMessages)) {
    await LocalStorage.setItem(`messages_${dmId}`, JSON.stringify(serializableMessages));
    console.log(`Storage: Messages for DM ${dmId} cache updated.`);
    return true; // Indicate that cache was updated
  } else {
    console.log(`Storage: Messages for DM ${dmId} cache is up-to-date, no write needed.`);
    return false; // Indicate that cache was not updated
  }
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

export async function saveGuilds(guilds: Guild[]): Promise<boolean> {
  const serializableGuilds: CachedGuild[] = guilds.map(guild => ({
    id: guild.id,
    name: guild.name,
    iconURL: guild.iconURL(),
  }));

  const existingCached = await LocalStorage.getItem<string>("cachedGuilds");
  const existingSerializableGuilds: CachedGuild[] = existingCached ? JSON.parse(existingCached) : [];

  // Simple comparison: check if lengths are different or if content is different
  // A more robust comparison would involve deep equality check or checking specific properties
  if (JSON.stringify(serializableGuilds) !== JSON.stringify(existingSerializableGuilds)) {
    await LocalStorage.setItem("cachedGuilds", JSON.stringify(serializableGuilds));
    console.log("Storage: Guilds cache updated.");
    return true; // Indicate that cache was updated
  } else {
    console.log("Storage: Guilds cache is up-to-date, no write needed.");
    return false; // Indicate that cache was not updated
  }
}

export async function getGuilds(): Promise<CachedGuild[]> {
  const cached = await LocalStorage.getItem<string>("cachedGuilds");
  return cached ? JSON.parse(cached) : [];
}

export async function saveUserProfile(user: User): Promise<boolean> {
  const serializableUser: CachedUserProfile = {
    id: user.id,
    username: user.username,
    displayAvatarURL: user.displayAvatarURL(),
  };

  const existingCached = await LocalStorage.getItem<string>("cachedUserProfile");
  const existingSerializableUser: CachedUserProfile | null = existingCached ? JSON.parse(existingCached) : null;

  if (JSON.stringify(serializableUser) !== JSON.stringify(existingSerializableUser)) {
    await LocalStorage.setItem("cachedUserProfile", JSON.stringify(serializableUser));
    console.log("Storage: User profile cache updated.");
    return true; // Indicate that cache was updated
  } else {
    console.log("Storage: User profile cache is up-to-date, no write needed.");
    return false; // Indicate that cache was not updated
  }
}

export async function getUserProfile(): Promise<CachedUserProfile | null> {
  const cached = await LocalStorage.getItem<string>("cachedUserProfile");
  return cached ? JSON.parse(cached) : null;
}
