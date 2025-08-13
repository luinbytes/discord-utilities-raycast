function BookmarksSection(props: {
  bookmarks: Bookmark[];
  onSave: (next: Bookmark[]) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const { bookmarks, onSave, onRemove } = props;
  const { push } = useNavigation();

  const onCreate = () => push(<BookmarkForm onSubmit={async (bm) => onSave([...(bookmarks || []), bm])} />);
  const onEdit = (bm: Bookmark) =>
    push(
      <BookmarkForm
        initial={bm}
        onSubmit={async (updated) => {
          const next = bookmarks.map((b) => (b.id === updated.id ? updated : b));
          await onSave(next);
        }}
      />
    );

  return (
    <List.Section title="Bookmarks" subtitle={bookmarks.length ? `${bookmarks.length}` : undefined}>
      <List.Item
        title="Add Bookmark"
        icon={Icon.Bookmark}
        accessories={[{ text: "Save a message link" }]}
        actions={
          <ActionPanel>
            <Action title="Add Bookmark" icon={Icon.Bookmark} onAction={onCreate} />
          </ActionPanel>
        }
      />
      {bookmarks.map((bm) => (
        <List.Item
          key={bm.id}
          title={bm.name}
          icon={Icon.Bookmark}
          accessories={(bm.tags || []).map((t) => ({ tag: t }))}
          keywords={bm.tags}
          actions={
            <ActionPanel>
              <Action
                title="Open"
                icon={Icon.ArrowRight}
                onAction={async () => {
                  await openDeepLink(bm.link);
                  await showToast(Toast.Style.Success, `Opened ${bm.name}`);
                }}
              />
              <Action.CopyToClipboard title="Copy Link" content={bm.link} />
              <Action title="Edit" icon={Icon.Pencil} onAction={() => onEdit(bm)} />
              <Action title="Remove" icon={Icon.Trash} style={Action.Style.Destructive} onAction={() => onRemove(bm.id)} />
            </ActionPanel>
          }
        />
      ))}
    </List.Section>
  );
}

function FlavorChooser(props: { options: InstallFlavor[]; onChoose: (f: InstallFlavor) => void | Promise<void> }) {
  const { options, onChoose } = props;
  const titles: Record<InstallFlavor, string> = { stable: "Discord (Stable)", ptb: "Discord PTB", canary: "Discord Canary" };
  const icons: Record<InstallFlavor, Icon> = { stable: Icon.AppWindow, ptb: Icon.AppWindowGrid2x2, canary: Icon.AppWindowList } as any;
  return (
    <List searchBarPlaceholder="Choose your Discord installation">
      <List.Section title="Multiple Installations Found" subtitle={`${options.length}`}>
        {options.map((f) => (
          <List.Item
            key={f}
            title={titles[f]}
            icon={icons[f]}
            actions={
              <ActionPanel>
                <Action
                  title={`Use ${titles[f]}`}
                  onAction={async () => {
                    await onChoose(f);
                  }}
                />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
    </List>
  );
}

function BookmarkForm(props: { initial?: Bookmark; onSubmit: (bm: Bookmark) => Promise<void> }) {
  const { initial, onSubmit } = props;
  const { pop } = useNavigation();

  const [name, setName] = useState(initial?.name ?? "");
  const [link, setLink] = useState(initial?.link ?? "");
  const [identifier, setIdentifier] = useState("");
  const [guildId, setGuildId] = useState("");
  const [channelId, setChannelId] = useState("");
  const [messageId, setMessageId] = useState("");
  const [tags, setTags] = useState<string>((initial?.tags || []).join(", "));

  const handleSubmit = async () => {
    let final = link.trim();
    // Priority 1: single identifier or link field
    if (!final && identifier.trim()) {
      const parsed = parseDiscordInput(identifier.trim());
      if (parsed) final = parsed;
    }
    if (!final) {
      if (guildId.trim() && channelId.trim() && messageId.trim()) {
        final = require("./utils/discord").makeGuildMessageLink(guildId.trim(), channelId.trim(), messageId.trim());
      } else if (!guildId.trim() && channelId.trim() && messageId.trim()) {
        final = require("./utils/discord").makeDmMessageLink(channelId.trim(), messageId.trim());
      }
    }
    if (!isDiscordDeepLink(final)) {
      await showToast(Toast.Style.Failure, "Invalid Link", "Provide a discord:// link or IDs for guild/channel/message or DM channel/message.");
      return;
    }
    const bm: Bookmark = {
      id: initial?.id ?? genId(),
      name: name.trim() || "Untitled",
      link: final,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };
    await onSubmit(bm);
    await showToast(Toast.Style.Success, initial ? "Bookmark Updated" : "Bookmark Added");
    pop();
  };

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title={initial ? "Save Changes" : "Add Bookmark"} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField id="identifier" title="Identifier or Link" placeholder="discord link, https link, IDs (e.g. 123/456[/789]), @me/456, dm:456" value={identifier} onChange={setIdentifier} />
      <Form.Description title="Tip" text="Enter any channel/DM/server identifier; we'll resolve it automatically. Fields below are optional fallbacks." />
      <Form.TextField id="name" title="Name" placeholder="e.g., Important message" value={name} onChange={setName} />
      <Form.Separator />
      <Form.Description title="Compose by IDs (optional)" text="Guild+Channel+Message for servers, Channel+Message for DMs. Leave Guild empty for DMs." />
      <Form.TextField id="guildId" title="Guild ID (server)" placeholder="e.g., 123... (leave empty for DM)" value={guildId} onChange={setGuildId} />
      <Form.TextField id="channelId" title="Channel ID / DM Channel ID" placeholder="e.g., 456..." value={channelId} onChange={setChannelId} />
      <Form.TextField id="messageId" title="Message ID" placeholder="e.g., 789..." value={messageId} onChange={setMessageId} />
      <Form.Separator />
      <Form.TextField id="link" title="Link (optional)" placeholder="discord://-/channels/<g>/<c>/<m> or @me/<c>/<m>" value={link} onChange={setLink} />
      <Form.TextField id="tags" title="Tags" placeholder="comma, separated, tags" value={tags} onChange={setTags} />
    </Form>
  );
}
/*
  Discord Utilities (Windows) — unified command
  Sections:
  - Pinned Links: user-managed discord:// deep links
  - Profiles: open Stable / PTB / Canary
  - Actions: open Discord (preferred), Settings, Keybinds

  Notes / Future Enhancements:
  - Consider mute/deafen via user-configured global hotkeys (launched via a helper exe).
  - Potential bot-based discovery of servers/channels — out of scope for MVP.
*/

import {
  Action,
  ActionPanel,
  Form,
  Icon,
  List,
  LocalStorage,
  Toast,
  confirmAlert,
  getPreferenceValues,
  showToast,
  useNavigation,
} from "@raycast/api";
import { useEffect, useMemo, useState } from "react";
import {
  getKeybindsLink,
  getSettingsLink,
  getSettingsSubLink,
  openDeepLink,
  openDiscord,
  resolveDiscordPaths,
  parseDiscordInput,
  makeServerLink,
  makeChannelLink,
  makeDmLink,
  isDiscordDeepLink,
} from "./utils/discord";
import type { InstallFlavor, PinnedLink, Preferences, PinType, Bookmark } from "./types";
// Simple ID generator to avoid extra dependencies
function genId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const PINS_KEY = "pinnedLinks";
const BOOKMARKS_KEY = "discordBookmarks";
const CHOSEN_FLAVOR_KEY = "chosenFlavor";
const SAVED_GUILDS_KEY = "savedGuildIds"; // stores [{ id, name }]

export default function Command() {
  const preferences = getPreferenceValues<Preferences>();

  const [pins, setPins] = useState<PinnedLink[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [paths, setPaths] = useState<{ stable?: string; ptb?: string; canary?: string }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [chosenFlavor, setChosenFlavor] = useState<InstallFlavor | undefined>(undefined);
  const [needChooseFlavor, setNeedChooseFlavor] = useState(false);
  const [availableFlavors, setAvailableFlavors] = useState<InstallFlavor[]>([]);

  // Load pins and resolve paths at start
  useEffect(() => {
    (async () => {
      try {
        const raw = await LocalStorage.getItem<string>(PINS_KEY);
        setPins(raw ? (JSON.parse(raw) as PinnedLink[]) : []);
      } catch {
        setPins([]);
      }
      try {
        const rawBm = await LocalStorage.getItem<string>(BOOKMARKS_KEY);
        setBookmarks(rawBm ? (JSON.parse(rawBm) as Bookmark[]) : []);
      } catch {
        setBookmarks([]);
      }
      try {
        const storedChosen = await LocalStorage.getItem<string>(CHOSEN_FLAVOR_KEY);
        if (storedChosen === "stable" || storedChosen === "ptb" || storedChosen === "canary") {
          setChosenFlavor(storedChosen);
        }
      } catch {
        // ignore
      }
      try {
        const resolved = await resolveDiscordPaths(preferences);
        setPaths(resolved);
        // Determine available installations
        const found: InstallFlavor[] = (Object.entries(resolved) as [InstallFlavor, string | undefined][]) // typed cast
          .filter(([, p]) => !!p)
          .map(([k]) => k);
        setAvailableFlavors(found);
        // If no chosen flavor yet, auto-pick when exactly one is found; otherwise ask user
        const hasChosen = !!(await LocalStorage.getItem<string>(CHOSEN_FLAVOR_KEY));
        if (!hasChosen) {
          if (found.length === 1) {
            const only = found[0];
            setChosenFlavor(only);
            await LocalStorage.setItem(CHOSEN_FLAVOR_KEY, only);
            await showToast(Toast.Style.Success, `Using ${only} Discord`);
          } else if (found.length > 1) {
            setNeedChooseFlavor(true);
          }
        }
      } catch (e: unknown) {
        // Best-effort: paths may remain undefined; actions will show toasts if missing
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const onSavePins = async (next: PinnedLink[]) => {
    setPins(next);
    await LocalStorage.setItem(PINS_KEY, JSON.stringify(next));
  };

  const onRemovePin = async (id: string) => {
    const ok = await confirmAlert({ title: "Remove Pin?", message: "This will delete the pinned link." });
    if (!ok) return;
    const next = pins.filter((p) => p.id !== id);
    await onSavePins(next);
  };

  // Bookmarks persistence
  const onSaveBookmarks = async (next: Bookmark[]) => {
    setBookmarks(next);
    await LocalStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next));
  };

  const onRemoveBookmark = async (id: string) => {
    const ok = await confirmAlert({ title: "Remove Bookmark?", message: "This will delete the bookmark." });
    if (!ok) return;
    const next = bookmarks.filter((b) => b.id !== id);
    await onSaveBookmarks(next);
  };

  const effectiveFlavor: InstallFlavor = (chosenFlavor || preferences.preferredFlavor || "stable") as InstallFlavor;
  const openPreferred = async () => {
    await openDiscord(effectiveFlavor, paths[effectiveFlavor]);
  };

  const settingsUrl = useMemo(() => getSettingsLink(), []);
  const keybindsUrl = useMemo(() => getKeybindsLink(), []);
  const showProfiles = !(preferences?.preferredFlavor || chosenFlavor); // hide profiles once a flavor is chosen

  if (needChooseFlavor) {
    return (
      <FlavorChooser
        options={availableFlavors}
        onChoose={async (f) => {
          setChosenFlavor(f);
          await LocalStorage.setItem(CHOSEN_FLAVOR_KEY, f);
          setNeedChooseFlavor(false);
          await showToast(Toast.Style.Success, `Using ${f} Discord`);
        }}
      />
    );
  }

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search pins by name or tag">
      <BookmarksSection bookmarks={bookmarks} onSave={onSaveBookmarks} onRemove={onRemoveBookmark} />
      <PinnedSection pins={pins} onSave={onSavePins} onRemove={onRemovePin} />
      {showProfiles ? <ProfilesSection paths={paths} /> : null}
      <ActionsSection onOpenPreferred={openPreferred} settingsUrl={settingsUrl} keybindsUrl={keybindsUrl} />
    </List>
  );
}

function PinnedSection(props: {
  pins: PinnedLink[];
  onSave: (next: PinnedLink[]) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const { pins, onSave, onRemove } = props;
  const { push } = useNavigation();

  const onCreate = () => push(<PinForm onSubmit={async (pin) => onSave([...pins, pin])} />);

  const onEdit = (pin: PinnedLink) =>
    push(
      <PinForm
        initial={pin}
        onSubmit={async (updated) => {
          const next = pins.map((p) => (p.id === updated.id ? updated : p));
          await onSave(next);
        }}
      />
    );

  const dmPins = pins.filter((p) => p.type === "dm");
  const serverPins = pins.filter((p) => p.type === "server");
  const channelPins = pins.filter((p) => p.type === "channel");

  // Helper to extract guild id from a discord deep link
  const extractGuildId = (link: string): string | undefined => {
    const m = link.match(/discord:\/\/-\/channels\/(\d+)/i);
    return m?.[1];
  };
  const extractGuildIdFromChannel = (link: string): string | undefined => {
    const m = link.match(/discord:\/\/-\/channels\/(\d+)\/(\d+)/i);
    return m?.[1];
  };

  // Build server map for grouping and display names
  const serverByGuild: Record<string, { pin: PinnedLink; name: string }> = {};
  for (const sp of serverPins) {
    const gid = extractGuildId(sp.link);
    if (gid) serverByGuild[gid] = { pin: sp, name: sp.name };
  }
  const channelsByGuild: Record<string, PinnedLink[]> = {};
  for (const cp of channelPins) {
    const gid = extractGuildIdFromChannel(cp.link);
    if (!gid) continue;
    if (!channelsByGuild[gid]) channelsByGuild[gid] = [];
    channelsByGuild[gid].push(cp);
  }

  return (
    <>
      <List.Item
        title="Add Pin"
        icon={Icon.Plus}
        accessories={[{ text: "Create a new pin" }]}
        actions={
          <ActionPanel>
            <Action title="Add Pin" icon={Icon.Plus} onAction={onCreate} />
          </ActionPanel>
        }
      />

      {dmPins.length > 0 && (
        <List.Section title="Direct Messages" subtitle={`${dmPins.length}`}>
          {dmPins.map((pin) => (
            <List.Item
              key={pin.id}
              title={pin.name}
              accessories={(pin.tags || []).map((t) => ({ tag: t }))}
              keywords={pin.tags}
              icon={Icon.Link}
              actions={
                <ActionPanel>
                  <Action
                    title="Open"
                    icon={Icon.ArrowRight}
                    onAction={async () => {
                      if (!pin.link.toLowerCase().startsWith("discord://")) {
                        await showToast(Toast.Style.Failure, "Invalid Link", "Must start with discord://");
                        return;
                      }
                      await openDeepLink(pin.link);
                      await showToast(Toast.Style.Success, `Opened ${pin.name}`);
                    }}
                  />
                  <Action.CopyToClipboard title="Copy Link" content={pin.link} />
                  <Action title="Edit" icon={Icon.Pencil} onAction={() => onEdit(pin)} />
                  <Action
                    title="Remove"
                    icon={Icon.Trash}
                    style={Action.Style.Destructive}
                    onAction={() => onRemove(pin.id)}
                  />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      )}

      {/* Servers and their Channels */}
      {(serverPins.length > 0 || channelPins.length > 0) && (
        <List.Section title="Servers">
          {/* Render each server */}
          {serverPins.map((sp) => (
            <List.Item
              key={sp.id}
              title={sp.name}
              icon={Icon.AppWindow}
              accessories={(sp.tags || []).map((t) => ({ tag: t }))}
              keywords={sp.tags}
              actions={
                <ActionPanel>
                  <Action
                    title="Open Server"
                    icon={Icon.ArrowRight}
                    onAction={async () => {
                      await openDeepLink(sp.link);
                      await showToast(Toast.Style.Success, `Opened ${sp.name}`);
                    }}
                  />
                  <Action.CopyToClipboard title="Copy Link" content={sp.link} />
                  <Action title="Edit" icon={Icon.Pencil} onAction={() => onEdit(sp)} />
                  <Action title="Remove" icon={Icon.Trash} style={Action.Style.Destructive} onAction={() => onRemove(sp.id)} />
                </ActionPanel>
              }
            />
          ))}

          {/* Render channels grouped under their server */}
          {Object.entries(channelsByGuild).map(([gid, cps]) => {
            const serverName = serverByGuild[gid]?.name || `Server ${gid}`;
            return cps.map((cp) => (
              <List.Item
                key={cp.id}
                title={cp.name}
                icon={Icon.Hashtag}
                accessories={[{ tag: `in ${serverName}` }, ...(cp.tags || []).map((t) => ({ tag: t }))]}
                keywords={[serverName, ...(cp.tags || [])]}
                actions={
                  <ActionPanel>
                    <Action
                      title={`Open ${cp.name}`}
                      icon={Icon.ArrowRight}
                      onAction={async () => {
                        await openDeepLink(cp.link);
                        await showToast(Toast.Style.Success, `Opened ${cp.name}`);
                      }}
                    />
                    <Action.CopyToClipboard title="Copy Link" content={cp.link} />
                    <Action title="Edit" icon={Icon.Pencil} onAction={() => onEdit(cp)} />
                    <Action title="Remove" icon={Icon.Trash} style={Action.Style.Destructive} onAction={() => onRemove(cp.id)} />
                  </ActionPanel>
                }
              />
            ));
          })}
        </List.Section>
      )}
    </>
  );
}

function ProfilesSection(props: { paths: { stable?: string; ptb?: string; canary?: string } }) {
  const { paths } = props;

  const Item = ({ flavor, path, title }: { flavor: InstallFlavor; path?: string; title: string }) => (
    <List.Item
      title={title}
      subtitle={flavor.toUpperCase()}
      icon={Icon.AppWindow}
      accessories={[{ text: path ? "Resolved" : "Not Found" }]}
      actions={
        <ActionPanel>
          <Action
            title="Open"
            icon={Icon.ArrowRight}
            onAction={async () => {
              await openDiscord(flavor, path);
            }}
          />
          {path ? <Action.CopyToClipboard title="Copy Path" content={path} /> : null}
        </ActionPanel>
      }
    />
  );

  return (
    <List.Section title="Profiles">
      <Item flavor="stable" path={paths.stable} title="Discord Stable" />
      <Item flavor="ptb" path={paths.ptb} title="Discord PTB" />
      <Item flavor="canary" path={paths.canary} title="Discord Canary" />
    </List.Section>
  );
}

function ActionsSection(props: { onOpenPreferred: () => Promise<void>; settingsUrl: string; keybindsUrl: string }) {
  const { onOpenPreferred, settingsUrl, keybindsUrl } = props;
  const { getSettingsSubLink } = require("./utils/discord");

  return (
    <List.Section title="Actions">
      <List.Item
        title="Open Discord (Preferred)"
        icon={Icon.Play}
        actions={
          <ActionPanel>
            <Action title="Open" icon={Icon.ArrowRight} onAction={onOpenPreferred} />
          </ActionPanel>
        }
      />
      <List.Item
        title="Open Settings"
        icon={Icon.Gear}
        actions={
          <ActionPanel>
            <Action
              title="Open Settings"
              icon={Icon.Gear}
              onAction={async () => {
                await openDeepLink(settingsUrl);
                await showToast(Toast.Style.Success, "Opened Discord Settings");
              }}
            />
            <Action.CopyToClipboard title="Copy Settings Link" content={settingsUrl} />
          </ActionPanel>
        }
      />
      <List.Item
        title="Open Keybinds"
        icon={Icon.CommandSymbol}
        actions={
          <ActionPanel>
            <Action
              title="Open Keybinds"
              icon={Icon.CommandSymbol}
              onAction={async () => {
                await openDeepLink(keybindsUrl);
                await showToast(Toast.Style.Success, "Opened Discord Keybinds");
              }}
            />
            <Action.CopyToClipboard title="Copy Keybinds Link" content={keybindsUrl} />
          </ActionPanel>
        }
      />
      {/* Settings subsections */}
      {[
        { key: "voice", title: "Settings: Voice & Video", icon: Icon.Microphone },
        { key: "notifications", title: "Settings: Notifications", icon: Icon.Bell },
        { key: "appearance", title: "Settings: Appearance", icon: Icon.Eye },
        { key: "accessibility", title: "Settings: Accessibility", icon: Icon.Person },
        { key: "privacy", title: "Settings: Privacy & Safety", icon: Icon.Lock },
        { key: "advanced", title: "Settings: Advanced / Developer", icon: Icon.Terminal },
      ].map((s) => (
        <List.Item
          key={s.key}
          title={s.title}
          icon={s.icon}
          actions={
            <ActionPanel>
              <Action
                title={`Open ${s.title}`}
                icon={s.icon}
                onAction={async () => {
                  const url = getSettingsSubLink(s.key as any);
                  await openDeepLink(url);
                  await showToast(Toast.Style.Success, `Opened ${s.title}`);
                }}
              />
              <Action.CopyToClipboard title="Copy Link" content={getSettingsSubLink(s.key as any)} />
            </ActionPanel>
          }
        />
      ))}
    </List.Section>
  );
}

function PinForm(props: { initial?: PinnedLink; onSubmit: (pin: PinnedLink) => Promise<void> }) {
  const { initial, onSubmit } = props;
  const { pop } = useNavigation();

  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<PinType>(initial?.type ?? "channel");
  const [link, setLink] = useState(initial?.link ?? "");
  const [tags, setTags] = useState<string>((initial?.tags || []).join(", "));
  const [guildId, setGuildId] = useState<string>("");
  const [channelId, setChannelId] = useState<string>("");
  type SavedGuild = { id: string; name: string };
  const [savedGuilds, setSavedGuilds] = useState<SavedGuild[]>([]);
  const [guildChoice, setGuildChoice] = useState<string>("custom"); // value is either a guildId from savedGuilds or "custom"

  useEffect(() => {
    (async () => {
      try {
        const raw = await LocalStorage.getItem<string>(SAVED_GUILDS_KEY);
        if (!raw) {
          setSavedGuilds([]);
          return;
        }
        const parsed = JSON.parse(raw);
        // Backward compatibility: if it was ["gid", ...], convert to objects
        if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
          const converted: SavedGuild[] = parsed.map((id: string) => ({ id, name: id }));
          setSavedGuilds(converted);
          await LocalStorage.setItem(SAVED_GUILDS_KEY, JSON.stringify(converted));
        } else if (Array.isArray(parsed)) {
          const objs: SavedGuild[] = parsed
            .map((x) => (x && typeof x.id === "string" ? { id: x.id, name: typeof x.name === "string" && x.name ? x.name : x.id } : null))
            .filter(Boolean) as SavedGuild[];
          // Enrich names from existing server pins if name === id
          try {
            const pinsRaw = await LocalStorage.getItem<string>(PINS_KEY);
            const pinsArr = pinsRaw ? (JSON.parse(pinsRaw) as PinnedLink[]) : [];
            const serverPins = pinsArr.filter((p) => p.type === "server");
            const extractGuildId = (link: string): string | undefined => {
              const m = link.match(/discord:\/\/-\/channels\/(\d+)/i);
              return m?.[1];
            };
            const nameByGid = new Map<string, string>();
            for (const sp of serverPins) {
              const gid = extractGuildId(sp.link);
              if (gid) nameByGid.set(gid, sp.name || gid);
            }
            const enriched = objs.map((g) => (g.name === g.id && nameByGid.get(g.id) ? { ...g, name: nameByGid.get(g.id)! } : g));
            setSavedGuilds(enriched);
            if (JSON.stringify(enriched) !== JSON.stringify(objs)) {
              await LocalStorage.setItem(SAVED_GUILDS_KEY, JSON.stringify(enriched));
            }
          } catch {
            setSavedGuilds(objs);
          }
        } else {
          setSavedGuilds([]);
        }
      } catch {
        setSavedGuilds([]);
      }
    })();
  }, []);

  const handleSubmit = async () => {
    let finalLink = link.trim();

    // Accept either a full discord:// link, or compose from IDs based on type
    if (!finalLink) {
      if (type === "server" && guildId.trim()) {
        finalLink = makeServerLink(guildId.trim());
      } else if (type === "channel" && guildId.trim() && channelId.trim()) {
        finalLink = makeChannelLink(guildId.trim(), channelId.trim());
      } else if (type === "dm" && channelId.trim()) {
        finalLink = makeDmLink(channelId.trim());
      }
    }

    if (!isDiscordDeepLink(finalLink)) {
      await showToast(Toast.Style.Failure, "Invalid Link", "Provide a discord:// link or valid IDs for the selected type.");
      return;
    }
    const pin: PinnedLink = {
      id: initial?.id ?? genId(),
      name: name.trim() || "Untitled",
      type,
      link: finalLink,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };
    await onSubmit(pin);
    // Persist server (guild) IDs when the user pins a server
    if (!initial && type === "server" && guildId.trim()) {
      const id = guildId.trim();
      const displayName = pin.name || id;
      const mapById = new Map<string, SavedGuild>((savedGuilds || []).map((g) => [g.id, g]));
      mapById.set(id, { id, name: displayName });
      const next = Array.from(mapById.values());
      setSavedGuilds(next);
      await LocalStorage.setItem(SAVED_GUILDS_KEY, JSON.stringify(next));
    }
    await showToast(Toast.Style.Success, initial ? "Pin Updated" : "Pin Added");
    pop();
  };

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title={initial ? "Save Changes" : "Add Pin"} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField id="name" title="Name" placeholder="e.g., #general — MyServer" value={name} onChange={setName} />
      <Form.Dropdown id="type" title="Type" value={type} onChange={(v) => setType(v as PinType)}>
        <Form.Dropdown.Item value="server" title="Server" />
        <Form.Dropdown.Item value="channel" title="Channel" />
        <Form.Dropdown.Item value="dm" title="Direct Message" />
      </Form.Dropdown>
      <Form.Separator />
      <Form.Description title="Compose by IDs (optional)" text="Provide IDs to auto-build the link if you don't paste a full discord:// URL." />
      {type === "channel" && savedGuilds.length > 0 ? (
        <>
          <Form.Dropdown id="guildChoice" title="Guild" value={guildChoice} onChange={(v) => {
            setGuildChoice(v);
            if (v !== "custom") setGuildId(v);
          }}>
            {savedGuilds.map((g) => (
              <Form.Dropdown.Item key={g.id} value={g.id} title={g.name} />
            ))}
            <Form.Dropdown.Item value="custom" title="Enter Manually" />
          </Form.Dropdown>
          {guildChoice === "custom" ? (
            <Form.TextField id="guildId" title="Guild ID" placeholder="e.g., 123456789012345678" value={guildId} onChange={setGuildId} />
          ) : null}
        </>
      ) : (
        <Form.TextField id="guildId" title="Guild ID" placeholder="e.g., 123456789012345678" value={guildId} onChange={setGuildId} />
      )}
      <Form.TextField id="channelId" title="Channel ID / DM Channel ID" placeholder="e.g., 123456789012345678" value={channelId} onChange={setChannelId} />
      <Form.Separator />
      <Form.TextField id="link" title="Link (optional)" placeholder="discord://-/channels/<guild>/<channel>" value={link} onChange={setLink} />
      <Form.TextField id="tags" title="Tags" placeholder="comma, separated, tags" value={tags} onChange={setTags} />
    </Form>
  );
}
