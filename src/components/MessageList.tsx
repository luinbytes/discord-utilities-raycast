import { Action, ActionPanel, Form, List, useNavigation, Icon } from "@raycast/api";
import MessageDetailView from "./MessageDetailView";
import { saveMessages, getMessages } from "../utils/storage";
import { DMChannel, GuildChannel, Message, ThreadChannel, ForumChannel, Embed } from "discord.js-selfbot-v13";
import { useEffect, useState, useCallback, useRef } from "react";
import { client } from "../utils/discord";

const MESSAGES_PER_PAGE = 20;

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

export function MessageList({ channel, dmNicknames }: { channel: GuildChannel | DMChannel | ThreadChannel, dmNicknames: Record<string, string> }) {
  const [items, setItems] = useState<Array<Message | ThreadChannel>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const fetchedItemIds = useRef(new Set<string>());
  const lastItemId = useRef<string | undefined>();

  // Use a ref to track hasMore without causing useCallback to be unstable
  const hasMoreRef = useRef(hasMore);
  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  const fetchItems = useCallback(async (loadMore = false) => {
    if (loadMore && !hasMoreRef.current) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null); // Clear previous errors

    // Add client ready check
    if (!client.isReady()) {
      console.log("MessageList: Discord client is not ready. Cannot fetch messages.");
      setError("Discord client is not connected. Please try again later.");
      setIsLoading(false);
      return;
    }

    const before = loadMore ? lastItemId.current : undefined;
    let newFetchedItems: Array<Message | ThreadChannel> = [];

    try {
      // Try to load from cache first
      if (!loadMore) { // Only load from cache on initial fetch
        const cachedMsgs = await getMessages(channel.id);
        if (cachedMsgs.length > 0) {
          setItems(cachedMsgs);
          setIsLoading(true); // Keep loading true while fetching fresh
          console.log(`MessageList: Loaded ${cachedMsgs.length} messages from cache.`);
        }
      }

      // Fetch fresh messages from Discord
      if (channel.type === "DM" || channel.type === "GUILD_TEXT" || channel.type === "GUILD_PUBLIC_THREAD" || channel.type === "GUILD_PRIVATE_THREAD") {
        console.log(`MessageList: Fetching messages for channel ${channel.id} (before: ${before || 'none'})`); // Log fetch attempt
        const messages = await channel.messages.fetch({ limit: MESSAGES_PER_PAGE, before });
        console.log(`MessageList: Fetched ${messages.size} messages.`); // Log fetched size
        newFetchedItems = Array.from(messages.values());
        setHasMore(messages.size === MESSAGES_PER_PAGE);
        if (messages.size > 0) {
          lastItemId.current = messages.lastKey();
        }

        // Save fresh messages to cache
        if (!loadMore) { // Only save initial fetch to cache
          await saveMessages(channel.id, newFetchedItems);
          console.log(`MessageList: Saved ${newFetchedItems.length} messages to cache.`);
        }
      } else if (channel.type === "GUILD_FORUM") {
        if (!loadMore) {
          const forumChannel = channel as ForumChannel;
          const threads = await forumChannel.threads.fetchActive(true);
          newFetchedItems = Array.from(threads.threads.values());
        }
        setHasMore(false);
      }

      const uniqueNewItems = newFetchedItems.filter(item => !fetchedItemIds.current.has(item.id));
      uniqueNewItems.forEach(item => fetchedItemIds.current.add(item.id));

      setItems(prev => loadMore ? [...prev, ...uniqueNewItems] : uniqueNewItems);
    } catch (err: any) {
      console.error("MessageList: Failed to fetch messages:", err);
      setError(`Failed to load messages: ${err.message || "Unknown error"}`);
      setHasMore(false); // Stop trying to load more if there's an error
    } finally {
      setIsLoading(false);
    }
  }, [channel]);

  useEffect(() => {
    console.log(`MessageList: Channel changed. ID: ${channel.id}`);
    lastItemId.current = undefined;
    fetchedItemIds.current.clear();
    setItems([]);
    fetchItems(false);
  }, [channel, fetchItems]);

  useEffect(() => {
    const messageCreateListener = (newMessage: Message) => {
      if (newMessage.channel.id === channel.id && !fetchedItemIds.current.has(newMessage.id)) {
        setItems((prevItems) => [newMessage, ...prevItems]);
        fetchedItemIds.current.add(newMessage.id);
      }
    };

    client.on("messageCreate", messageCreateListener);

    return () => {
      client.off("messageCreate", messageCreateListener);
    };
  }, [channel]);

  const handleLoadMore = () => {
    if (!isLoading) {
      fetchItems(true);
    }
  };

  const refresh = () => {
    lastItemId.current = undefined;
    fetchedItemIds.current.clear();
    setItems([]);
    fetchItems(false);
  };

  const renderItem = (item: Message | ThreadChannel) => {
    if (item instanceof Message) {
      return (
        <List.Item
          key={item.id}
          title={`${dmNicknames[item.author.id] || item.author.displayName}: ${item.content.substring(0, 100)}${item.content.length > 100 ? "..." : ""}`}
          subtitle={item.createdAt.toLocaleString()}
          icon={item.author.displayAvatarURL()}
          accessories={[
            { text: item.createdAt.toLocaleString() },
            ...(item.embeds.length > 0 && item.embeds[0].image
              ? [{ icon: item.embeds[0].image.url, tooltip: "Embedded Image" }]
              : []),
          ]}
          actions={
            <ActionPanel>
              <Action.Push title="View Full Message" target={<MessageDetailView message={item} />} />
              <Action.CopyToClipboard title="Copy Message" content={item.content} />
            </ActionPanel>
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
      isLoading={isLoading}
      navigationTitle={channel.type === "DM" ? channel.recipient?.displayName || channel.name : `#${channel.name}`}
      actions={
        <ActionPanel>
          {(channel.type === "DM" || channel.type === "GUILD_TEXT" || channel.type === "GUILD_PUBLIC_THREAD" || channel.type === "GUILD_PRIVATE_THREAD") && (
            <Action.Push
              title="Send Message"
              target={<SendMessageForm channel={channel} onMessageSent={refresh} />}
            />
          )}
          {hasMore && (
            <Action title="Load More Old Messages" onAction={handleLoadMore} icon={Icon.ArrowUp} />
          )}
        </ActionPanel>
      }
    >
      {error ? (
        <List.Item title="Error" subtitle={error} icon={Icon.Warning} />
      ) : items.length === 0 && !isLoading ? (
        <List.Item title="No messages found." />
      ) : (
        items.map(renderItem)
      )}
    </List>
  );
}

function SendMessageForm({ channel, onMessageSent }: { channel: GuildChannel | DMChannel | ThreadChannel, onMessageSent: () => void }) {
  const { pop } = useNavigation();

  const handleSubmit = async (values: { message: string }) => {
    if (values.message.trim().length === 0) return;
    if (channel.type === "DM" || channel.type === "GUILD_TEXT" || channel.type === "GUILD_PUBLIC_THREAD" || channel.type === "GUILD_PRIVATE_THREAD") {
      await channel.send(values.message);
      onMessageSent();
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
      <Form.TextArea id="message" title="Message" placeholder="Type your message..." />
    </Form>
  );
}