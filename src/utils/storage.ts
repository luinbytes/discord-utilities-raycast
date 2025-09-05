import { LocalStorage } from "@raycast/api";

const PINNED_SERVERS_KEY = "pinnedServers";
const PINNED_DMS_KEY = "pinnedDMs";
const DM_NICKNAMES_KEY = "dmNicknames";

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
