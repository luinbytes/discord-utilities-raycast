import { Action, ActionPanel, Grid, Icon } from "@raycast/api";
import { useEffect, useState, useMemo } from "react";
import { client } from "./utils/discord";
import { Guild } from "discord.js-selfbot-v13";
import ChannelList from "./components/ChannelList";
import { addPinnedServer, getPinnedServers, removePinnedServer, saveGuilds, getGuilds, savePinnedServersOrder } from "./utils/storage";

export default function Command() {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [pinnedServers, setPinnedServers] = useState<string[]>([]);
  const [loadingState, setLoadingState] = useState<'loading' | 'loaded' | 'error'>('loading'); // New loading state
  const [error, setError] = useState<string | null>(null); // New error state

  const loadData = async () => {
    setError(null); // Clear previous errors

    let loadedFromCache = false;
    const cachedGuilds = await getGuilds();
    if (cachedGuilds.length > 0) {
      // Convert CachedGuild back to Guild-like objects for display
      setGuilds(cachedGuilds as Guild[]); // Cast for now, will refine if needed
      setLoadingState('loaded'); // Display cached data immediately
      console.log(`Index: Loaded ${cachedGuilds.length} guilds from cache.`);
      loadedFromCache = true;
    }

    setLoadingState('loading'); // Always set to loading when starting network fetch

    try {
      const fetchedPinnedServers = await getPinnedServers();
      setPinnedServers(fetchedPinnedServers);

      if (!client.isReady()) {
        console.log("Index: Discord client is not ready. Cannot fetch guilds.");
        setError("Discord client is not connected. Please try again later.");
        setLoadingState('error');
        return;
      }

      const fetchedGuilds = Array.from(client.guilds.cache.values());
      // Set state with standardized CachedGuild objects
      setGuilds(fetchedGuilds.map(guild => ({
        id: guild.id,
        name: guild.name,
        iconURL: guild.iconURL(), // Call iconURL() here to get the string
      })) as Guild[]); // Cast back to Guild[] for type compatibility

      await saveGuilds(fetchedGuilds); // Save original Guild objects to cache (saveGuilds will convert)
      console.log(`Index: Fetched ${fetchedGuilds.length} guilds from network.`);

      setLoadingState('loaded'); // All done, set to loaded
    } catch (err: any) {
      console.error("Index: Failed to fetch guilds:", err);
      setError(`Failed to load guilds: ${err.message || "Unknown error"}`);
      setLoadingState('error');
    }
  };

  useEffect(() => {
    if (client.isReady()) {
      loadData();
    } else {
      client.on("ready", loadData);
    }

    return () => {
      client.off("ready", loadData);
    };
  }, []);

  const togglePin = async (guildId: string) => {
    if (pinnedServers.includes(guildId)) {
      await removePinnedServer(guildId);
    } else {
      await addPinnedServer(guildId);
    }
    await loadData(); // Reload all data to re-sort and update UI
  };

  const movePinnedServerUp = async (serverId: string) => {
    const currentIndex = pinnedServers.indexOf(serverId);
    if (currentIndex > 0) {
      const newPinnedServers = [...pinnedServers];
      const [movedServer] = newPinnedServers.splice(currentIndex, 1);
      newPinnedServers.splice(currentIndex - 1, 0, movedServer);
      setPinnedServers(newPinnedServers);
      // Save the entire newPinnedServers array to LocalStorage
      await savePinnedServersOrder(newPinnedServers);
    }
  };

  const movePinnedServerDown = async (serverId: string) => {
    const currentIndex = pinnedServers.indexOf(serverId);
    if (currentIndex < pinnedServers.length - 1) {
      const newPinnedServers = [...pinnedServers];
      const [movedServer] = newPinnedServers.splice(currentIndex, 1);
      newPinnedServers.splice(currentIndex + 1, 0, movedServer);
      setPinnedServers(newPinnedServers);
      // Save the entire newPinnedServers array to LocalStorage
      await savePinnedServersOrder(newPinnedServers);
    }
  };

  const renderGridItem = (guild: Guild) => {
    const isPinned = pinnedServers.includes(guild.id);
    return (
      <Grid.Item
        key={guild.id}
        title={guild.name}
        content={guild.iconURL}
        actions={
          <ActionPanel>
            <Action.Push
              title="Show Channels"
              target={<ChannelList guild={guild} />}
            />
            <Action
              icon={isPinned ? Icon.MinusCircle : Icon.Pin}
              title={isPinned ? "Unpin Server" : "Pin Server"}
              onAction={() => togglePin(guild.id)}
              shortcut={{ modifiers: ["cmd", "shift"], key: "enter" }}
            />
            {isPinned && (
              <Action
                icon={Icon.ArrowLeft}
                title="Move Pinned Server Left"
                onAction={() => movePinnedServerUp(guild.id)}
                shortcut={{ modifiers: ["cmd", "shift"], key: "arrowLeft" }}
              />
            )}
            {isPinned && (
              <Action
                icon={Icon.ArrowRight}
                title="Move Pinned Server Right"
                onAction={() => movePinnedServerDown(guild.id)}
                shortcut={{ modifiers: ["cmd", "shift"], key: "arrowRight" }}
              />
            )}
          </ActionPanel>
        }
      />
    );
  };

  const sortedGuilds = useMemo(() => {
    const pinned = [];
    const unpinned = [];

    for (const guild of guilds) {
      if (pinnedServers.includes(guild.id)) {
        pinned.push(guild);
      } else {
        unpinned.push(guild);
      }
    }

    // Sort pinned guilds by their order in the pinnedServers array
    pinned.sort((a, b) => pinnedServers.indexOf(a.id) - pinnedServers.indexOf(b.id));

    // No specific sorting for unpinned guilds, keep original order or sort alphabetically if desired
    // For now, let's keep them as is or sort by name for consistency
    unpinned.sort((a, b) => a.name.localeCompare(b.name)); // Example: sort unpinned alphabetically

    return { pinned, unpinned };
  }, [guilds, pinnedServers]);

  return (
    <Grid isLoading={loadingState === 'loading' && guilds.length === 0}> // Only show full loading if no guilds yet
      {error ? (
        <Grid.EmptyView icon={Icon.Warning} title="Error" description={error} />
      ) : guilds.length === 0 && loadingState === 'loaded' ? (
        <Grid.EmptyView icon={Icon.List} title="No Guilds Found" description="You are not a member of any guilds." />
      ) : (
        <>
          {sortedGuilds.pinned.length > 0 && (
            <Grid.Section title="Pinned">
              {sortedGuilds.pinned.map(renderGridItem)}
            </Grid.Section>
          )}
          {sortedGuilds.unpinned.length > 0 && (
            <Grid.Section title="All">
              {sortedGuilds.unpinned.map(renderGridItem)}
            </Grid.Section>
          )}
        </>
      )}
      {loadingState === 'loading' && guilds.length > 0 && ( // Show subtle refresh if guilds are already displayed
        <Grid.Section title="">
          <Grid.Item title="Loading..." icon={Icon.ArrowClockwise} />
        </Grid.Section>
      )}
    </Grid>
  );
}