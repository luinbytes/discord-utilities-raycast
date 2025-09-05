import { Action, ActionPanel, Grid, Icon } from "@raycast/api";
import { useEffect, useState } from "react";
import { client } from "./utils/discord";
import { Guild } from "discord.js-selfbot-v13";
import ChannelList from "./components/ChannelList";
import { addPinnedServer, getPinnedServers, removePinnedServer } from "./utils/storage";

export default function Command() {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [pinnedServers, setPinnedServers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    const fetchedPinnedServers = await getPinnedServers();
    setPinnedServers(fetchedPinnedServers);

    const fetchedGuilds = Array.from(client.guilds.cache.values());
    setGuilds(fetchedGuilds);
    setIsLoading(false);
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

  const renderGridItem = (guild: Guild) => {
    const isPinned = pinnedServers.includes(guild.id);
    return (
      <Grid.Item
        key={guild.id}
        title={guild.name}
        content={guild.iconURL() || ""}
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
              shortcut={{ modifiers: ["cmd"], key: "enter" }}
            />
          </ActionPanel>
        }
      />
    );
  };

  const pinnedGuilds = guilds.filter((guild) => pinnedServers.includes(guild.id));
  const unpinnedGuilds = guilds.filter((guild) => !pinnedServers.includes(guild.id));

  return (
    <Grid isLoading={isLoading}>
      {pinnedGuilds.length > 0 && (
        <Grid.Section title="Pinned">
          {pinnedGuilds.map(renderGridItem)}
        </Grid.Section>
      )}
      {unpinnedGuilds.length > 0 && (
        <Grid.Section title="All">
          {unpinnedGuilds.map(renderGridItem)}
        </Grid.Section>
      )}
    </Grid>
  );
}