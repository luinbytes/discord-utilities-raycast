import { Action, ActionPanel, List, Icon, showToast, Toast, open } from "@raycast/api";
import { Guild, GuildChannel, TextChannel, ForumChannel } from "discord.js-selfbot-v13";
import { useEffect, useState } from "react";
import { MessageList } from "./MessageList";
import { client } from "../utils/discord";

export default function ChannelList({ guildId }: { guildId: string }) {
  const [channels, setChannels] = useState<GuildChannel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [guild, setGuild] = useState<Guild | undefined>(undefined);

  useEffect(() => {
    const fetchGuildAndChannels = () => {
      const fetchedGuild = client.guilds.cache.get(guildId);
      if (!fetchedGuild) {
        setIsLoading(false);
        // Handle error: guild not found
        return;
      }
      setGuild(fetchedGuild);

      const fetchedChannels = Array.from(fetchedGuild.channels.cache.values()).filter(
        (channel) => channel.type !== "GUILD_VOICE" && channel.type !== "GUILD_CATEGORY"
      ) as GuildChannel[];
      const sortedChannels = fetchedChannels.sort((a, b) => a.position - b.position);
      setChannels(sortedChannels);
      setIsLoading(false);
    };

    if (client.isReady()) {
      fetchGuildAndChannels();
    } else {
      client.once("ready", fetchGuildAndChannels);
    }

    return () => {
      client.off("ready", fetchGuildAndChannels);
    };
  }, [guildId]);

  const channelCategories = channels.reduce((acc, channel) => {
    const category = channel.parent?.name ?? "Uncategorized";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(channel);
    return acc;
  }, {} as Record<string, GuildChannel[]>);

  return (
    <List isLoading={isLoading} navigationTitle={guild ? `Channels in ${guild.name}` : "Channels"} isShowingDetail>
      {!guild && !isLoading ? (
        <List.Item title="Guild not found" icon={Icon.Warning} />
      ) : guild ? (
        <>
          {Object.entries(channelCategories).map(([category, channels]) => (
        <List.Section key={category} title={category}>
          {channels.map((channel) => {
            let subtitle = "";
            let icon = Icon.Text;

            if (channel.type === "GUILD_TEXT") {
              const textChannel = channel as TextChannel;
              subtitle = textChannel.lastMessage?.content || "No recent messages";
              icon = Icon.Text;
            } else if (channel.type === "GUILD_FORUM") {
              const forumChannel = channel as ForumChannel;
              subtitle = `${forumChannel.availableTags.size} tags, ${forumChannel.threads.cache.size} active posts`;
              icon = Icon.List;
            }

            return (
              <List.Item
                key={channel.id}
                title={channel.name}
                subtitle={subtitle}
                icon={icon}
                actions={
                  <ActionPanel>
                    <Action.Push
                      title="Show Messages"
                      target={<MessageList channel={channel} />}
                    />
                  </ActionPanel>
                }
                detail={
                  <List.Item.Detail
                    markdown={`**#${channel.name}**\n\n${subtitle}`}
                  />
                }
              />
            );
          })}
        </List.Section>
      ))}
        </>
      ) : null}
    </List>
  );
}