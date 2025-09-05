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
  const [loadingState, setLoadingState] = useState<'loading' | 'loaded' | 'error'>('loading'); // Simplified states
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const fetchedItemIds = useRef(new Set<string>());
  const lastItemId = useRef<string | undefined>();

  // Use a ref to track hasMore without causing useCallback to be unstable
  const hasMoreRef = useRef(hasMore);
  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  const currentChannelIdRef = useRef<string | null>(null); // To track the channel ID for which fetch was initiated

  const fetchItems = useCallback(async (loadMore = false) => {
    if (loadMore && !hasMoreRef.current) {
      setLoadingState('loaded'); // If no more to load, consider it loaded
      return;
    }

    setError(null);

    if (!client.isReady()) {
      console.log("MessageList: Discord client is not ready. Cannot fetch messages.");
      setError("Discord client is not connected. Please try again later.");
      setLoadingState('error');
      return;
    }

    const before = loadMore ? lastItemId.current : undefined;
    let newFetchedItems: Array<Message | ThreadChannel> = [];

    try {
      let loadedFromCache = false;
      if (!loadMore) {
        const cachedMsgs = await getMessages(channel.id);
        if (cachedMsgs.length > 0) {
          setItems(cachedMsgs);
          setLoadingState('loaded'); // Display cached data immediately
          console.log(`MessageList: Loaded ${cachedMsgs.length} messages from cache.`);
          loadedFromCache = true;
        }
      }

      // Always set to loading when starting network fetch, even if cached data is displayed
      setLoadingState('loading');

      if (channel.type === "DM" || channel.type === "GUILD_TEXT" || channel.type === "GUILD_PUBLIC_THREAD" || channel.type === "GUILD_PRIVATE_THREAD") {
        console.log(`MessageList: Fetching messages for channel ${channel.id} (before: ${before || 'none'})`); // Log fetch attempt
        const messages = await channel.messages.fetch({ limit: MESSAGES_PER_PAGE, before });
        console.log(`MessageList: Fetched ${messages.size} messages.`); // Log fetched size
        newFetchedItems = Array.from(messages.values());
        setHasMore(messages.size === MESSAGES_PER_PAGE);
        if (messages.size > 0) {
          lastItemId.current = messages.lastKey();
        }

        if (!loadMore) {
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
      setLoadingState('loaded'); // All done, set to loaded
    } catch (err: any) {
      console.error("MessageList: Failed to fetch messages:", err);
      setError(`Failed to load messages: ${err.message || "Unknown error"}`);
      setLoadingState('error');
      setHasMore(false);
    }
  }, [channel]);

  useEffect(() => {
    // Only initiate fetch if channel.id has truly changed
    if (currentChannelIdRef.current !== channel.id) {
      console.log(`MessageList: Initiating fetch for channel ID: ${channel.id}`);
      currentChannelIdRef.current = channel.id; // Mark this channel as being fetched

      lastItemId.current = undefined;
      fetchedItemIds.current.clear();
      fetchItems(false);
    } else {
      console.log(`MessageList: Channel ID ${channel.id} already initiated fetch. Skipping.`);
    }
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
                    title={`${(dmNicknames && dmNicknames[item.author.id]) || item.author.displayName}: ${item.content.substring(0, 100)}${item.content.length > 100 ? "..." : ""}`}
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
              <Action.Push
                title="Reply to Message"
                target={<ReplyMessageForm channel={channel} message={item} onMessageSent={refresh} />}
                icon={Icon.Reply}
              />
              <Action.CopyToClipboard title="Copy Message" content={item.content} />
              <Action.Push title="View Full Message" target={<MessageDetailView message={item} />} />
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
      isLoading={loadingState === 'loading' && items.length === 0} // Only show full loading if no items yet
      navigationTitle={channel.type === "DM" ? channel.recipient?.displayName || channel.name : `#${channel.name}`}
      actions={
        <ActionPanel>
          {(channel.type === "DM" || channel.type === "GUILD_TEXT" || channel.type === "GUILD_PUBLIC_THREAD" || channel.type === "GUILD_PRIVATE_THREAD") && (
            <Action.Push
              title="Reply"
              target={<SendMessageForm channel={channel} onMessageSent={refresh} />}
              shortcut={{ modifiers: ["cmd"], key: "enter" }}
            />
          )}
          {hasMore && (
            <Action title="Load More Old Messages" onAction={handleLoadMore} icon={Icon.ArrowUp} />
          )}
          <Action title="Refresh Messages" onAction={refresh} icon={Icon.ArrowClockwise} />
        </ActionPanel>
      }
    >
      {error ? (
        <List.Item title="Error" subtitle={error} icon={Icon.Warning} />
      ) : items.length === 0 && loadingState === 'loading' ? (
        <List.Item title="Loading messages..." /> // Show loading indicator if no items and loading
      ) : items.length === 0 && loadingState === 'loaded' ? (
        <List.Item title="No messages found." /> // Show no messages if loaded but empty
      ) : (
        items.map(renderItem)
      )}
      {loadingState === 'loading' && items.length > 0 && (
        <List.Item title="Refreshing messages..." icon={Icon.ArrowClockwise} accessories={[{ text: "Loading..." }]} />
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

function ReplyMessageForm({ channel, message, onMessageSent }: { channel: GuildChannel | DMChannel | ThreadChannel, message: Message, onMessageSent: () => void }) {
  const { pop } = useNavigation();
  const [replyContent, setReplyContent] = useState<string>("");

  const handleSubmit = async (values: { replyContent: string }) => {
    if (values.replyContent.trim().length === 0) return;
    if (channel.type === "DM" || channel.type === "GUILD_TEXT" || channel.type === "GUILD_PUBLIC_THREAD" || channel.type === "GUILD_PRIVATE_THREAD") {
      await channel.send({ content: values.replyContent, reply: { messageReference: message.id } });
      onMessageSent();
    }
    pop();
  };

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Reply" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Description title="Replying to" text={`${message.author.username}: ${message.content.substring(0, 50)}...`} />
      <Form.TextArea id="replyContent" title="Your Reply" placeholder="Type your reply..." value={replyContent} onChange={setReplyContent} />
    </Form>
  );
}