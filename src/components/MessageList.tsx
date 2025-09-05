import { Action, ActionPanel, Form, List, useNavigation, Icon, Image } from "@raycast/api";
import { DMChannel, GuildChannel, Message, ThreadChannel, ForumChannel, Embed } from "discord.js-selfbot-v13";
import { useEffect, useState, useCallback } from "react";
import { client } from "../utils/discord";

const MESSAGES_PER_PAGE = 20;
const THREADS_PER_PAGE = 20;

function formatMessageDetailMarkdown(message: Message): string {
  let markdown = `![Avatar](${message.author.displayAvatarURL()}) **${message.author.username}** - ${message.createdAt.toLocaleString()}\n\n${message.content}`;

  if (message.embeds.length > 0) {
    message.embeds.forEach((embed: Embed) => {
      markdown += `\n\n--- Embed ---\n`;
      if (embed.title) markdown += `**${embed.title}**\n`;
      if (embed.description) markdown += `${embed.description}\n`;
      if (embed.url) markdown += `[Link](${embed.url})\n`;
      if (embed.image) markdown += `![Image](${embed.image.url})\n`;
      if (embed.fields.length > 0) {
        embed.fields.forEach((field) => {
          markdown += `**${field.name}**: ${field.value}\n`;
        });
      }
    });
  }

  if (message.attachments.size > 0) {
    message.attachments.forEach((attachment) => {
      markdown += `\n\n[Attachment: ${attachment.name}](${attachment.url})`;
    });
  }

  return markdown;
}

export function MessageList({ channel }: { channel: GuildChannel | DMChannel | ThreadChannel }) {
  const [items, setItems] = useState<Array<Message | ThreadChannel>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    let fetchedItems: Array<Message | ThreadChannel> = [];

    if (channel.type === "DM" || channel.type === "GUILD_TEXT" || channel.type === "GUILD_PUBLIC_THREAD" || channel.type === "GUILD_PRIVATE_THREAD") {
      const messages = await channel.messages.fetch({ limit: MESSAGES_PER_PAGE, before: items.length > 0 ? items[items.length - 1].id : undefined });
      fetchedItems = Array.from(messages.values());
      setItems((prevItems) => [...prevItems, ...fetchedItems]);
      setHasMore(messages.size === MESSAGES_PER_PAGE);
    } else if (channel.type === "GUILD_FORUM") {
      const forumChannel = channel as ForumChannel;
      const threads = await forumChannel.threads.fetchActive(true);
      const newThreads = Array.from(threads.threads.values()).slice(page * THREADS_PER_PAGE, (page + 1) * THREADS_PER_PAGE);
      fetchedItems = newThreads;
      setItems((prevItems) => [...prevItems, ...fetchedItems]);
      setHasMore(newThreads.length === THREADS_PER_PAGE);
    }

    setIsLoading(false);
  }, [channel, page, items]);

  useEffect(() => {
    setItems([]); // Clear items when channel changes
    setPage(0);
    setHasMore(true);
  }, [channel]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    const messageCreateListener = (newMessage: Message) => {
      if (newMessage.channel.id === channel.id) {
        setItems((prevItems) => [newMessage, ...prevItems]); // Add new messages to the top
      }
    };

    client.on("messageCreate", messageCreateListener);

    return () => {
      client.off("messageCreate", messageCreateListener);
    };
  }, [channel]);

  const handleLoadMore = () => {
    setPage((prevPage) => prevPage + 1);
  };

  const renderItem = (item: Message | ThreadChannel) => {
    if (item instanceof Message) {
      return (
        <List.Item
          key={item.id}
          title={item.content.substring(0, 100) + (item.content.length > 100 ? "..." : "")}
          subtitle={item.author.username}
          icon={item.author.displayAvatarURL()}
          accessories={[{ text: item.createdAt.toLocaleString() }]}
          detail={
            <List.Item.Detail
              markdown={formatMessageDetailMarkdown(item)}
            />
          }
        />
      );
    } else if (item instanceof ThreadChannel) {
      return (
        <List.Item
          key={item.id}
          title={item.name}
          subtitle={`Started by ${item.owner?.username || "Unknown User"}`}
          icon={Icon.SpeechBubble}
          accessories={[{ text: item.createdAt.toLocaleString() }]}
          actions={
            <ActionPanel>
              <Action.Push
                title="Show Messages in Thread"
                target={<MessageList channel={item} />}
              />
            </ActionPanel>
          }
          detail={
            <List.Item.Detail
              markdown={`**${item.name}**\nStarted by ${item.owner?.username || "Unknown User"} at ${item.createdAt.toLocaleString()}`}
            />
          }
        />
      );
    }
    return null;
  };

  return (
    <List
      isShowingDetail
      isLoading={isLoading}
      navigationTitle={`#${channel.name}`}
      actions={
        <ActionPanel>
          {(channel.type === "DM" || channel.type === "GUILD_TEXT" || channel.type === "GUILD_PUBLIC_THREAD" || channel.type === "GUILD_PRIVATE_THREAD") && (
            <Action.Push
              title="Send Message"
              target={<SendMessageForm channel={channel} onMessageSent={fetchItems} />}
            />
          )}
          {hasMore && (
            <Action title="Load More Old Messages" onAction={handleLoadMore} icon={Icon.ArrowUp} />
          )}
        </ActionPanel>
      }
    >
      {items.map(renderItem)}
    </List>
  );
}

function SendMessageForm({ channel, onMessageSent }: { channel: GuildChannel | DMChannel | ThreadChannel, onMessageSent: () => void }) {
  const { pop } = useNavigation();

  const handleSubmit = async (values: { message: string }) => {
    if (channel.type === "DM" || channel.type === "GUILD_TEXT" || channel.type === "GUILD_PUBLIC_THREAD" || channel.type === "GUILD_PRIVATE_THREAD") {
      await channel.send(values.message);
      onMessageSent(); // Trigger a re-fetch to get the latest messages including the sent one
    }
    pop();
  };

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Send" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField id="message" title="Message" />
    </Form>
  );
}