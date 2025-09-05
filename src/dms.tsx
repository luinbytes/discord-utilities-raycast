import { Action, ActionPanel, List, Icon, Form, useNavigation } from "@raycast/api";
import { client } from "./utils/discord";
import { useEffect, useState, useMemo } from "react";
import { DMChannel, Message } from "discord.js-selfbot-v13";
import MessageList from "./components/MessageList";
import { addPinnedDM, getPinnedDMs, removePinnedDM, getDmNicknames, setDmNickname, removeDmNickname, saveLastMessages, getLastMessages } from "./utils/storage";

export default function DmsCommand() {
  const [dms, setDms] = useState<DMChannel[]>([]);
  const [lastMessages, setLastMessages] = useState<Record<string, Message | undefined>>({});
  const [pinnedDMs, setPinnedDMs] = useState<string[]>([]);
  const [dmNicknames, setDmNicknames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [filter, setFilter] = useState("all");

  const loadData = async () => {
    setIsLoading(true);
    const pinned = await getPinnedDMs();
    setPinnedDMs(pinned);
    setDmNicknames(await getDmNicknames());

    const cachedLastMessages = await getLastMessages();
    // Convert CachedMessage to Message-like object for state
    const initialLastMessages: Record<string, Message | undefined> = {};
    for (const dmId in cachedLastMessages) {
      const cachedMsg = cachedLastMessages[dmId];
      initialLastMessages[dmId] = {
        id: cachedMsg.id,
        channelId: cachedMsg.channelId,
        author: { id: cachedMsg.authorId },
        content: cachedMsg.content,
        createdTimestamp: cachedMsg.createdTimestamp,
      } as Message; // Cast to Message as we only need specific properties
    }
    setLastMessages(initialLastMessages);

    const fetchedDms = Array.from(client.channels.cache.values()).filter(
      (channel) => channel.type === "DM"
    ) as DMChannel[];

    setDms(fetchedDms);
    setIsLoading(false);

    // Asynchronously fetch last messages in batches to avoid rate limits
    const batchSize = 10;
    const allFetchedMessages: Record<string, Message | undefined> = { ...initialLastMessages };

    for (let i = 0; i < fetchedDms.length; i += batchSize) {
      const batch = fetchedDms.slice(i, i + batchSize);
      const lastMessagePromises = batch.map(async (dm) => {
        try {
          const messages = await dm.messages.fetch({ limit: 1 });
          const lastMessage = messages.first();
          return { dmId: dm.id, lastMessage };
        } catch (error) {
          console.error(`Could not fetch last message for ${dm.recipient.username}:`, error);
          return { dmId: dm.id, lastMessage: undefined };
        }
      });

      const results = await Promise.all(lastMessagePromises);
      const newLastMessages: Record<string, Message | undefined> = {};
      results.forEach(({ dmId, lastMessage }) => {
        if (lastMessage) {
          newLastMessages[dmId] = lastMessage;
          allFetchedMessages[dmId] = lastMessage; // Accumulate all fetched messages
        }
      });
      setLastMessages((prev) => ({ ...prev, ...newLastMessages }));
    }
    await saveLastMessages(allFetchedMessages); // Save all fetched messages after loop
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

  useEffect(() => {
    const handleMessageCreate = (message: Message) => {
      if (message.channel.type === "DM") {
        setLastMessages((prev) => ({
          ...prev,
          [message.channel.id]: message,
        }));
        // Save updated messages to cache in the background
        saveLastMessages({
          ...lastMessages,
          [message.channel.id]: message,
        });
      }
    };

    client.on("messageCreate", handleMessageCreate);

    return () => {
      client.off("messageCreate", handleMessageCreate);
    };
  }, [lastMessages]);

  const sortedDms = useMemo(() => {
    return [...dms].sort((a, b) => {
      const aPinned = pinnedDMs.includes(a.id);
      const bPinned = pinnedDMs.includes(b.id);

      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;

      const aTimestamp = lastMessages[a.id]?.createdTimestamp || 0;
      const bTimestamp = lastMessages[b.id]?.createdTimestamp || 0;
      return bTimestamp - aTimestamp;
    });
  }, [dms, pinnedDMs, lastMessages]);

  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 10;

  const filteredDms = useMemo(() => {
    const filtered = sortedDms.filter((dm) => {
      const displayName = dmNicknames[dm.id] || dm.recipient?.displayName || "Unknown User";
      const matchesSearch = displayName.toLowerCase().includes(searchText.toLowerCase());
      if (filter === "pinned") {
        return matchesSearch && pinnedDMs.includes(dm.id);
      }
      return matchesSearch;
    });
    const startIndex = currentPage * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filtered.slice(startIndex, endIndex);
  }, [sortedDms, dmNicknames, searchText, filter, pinnedDMs, currentPage]);

  const totalFilteredDms = useMemo(() => {
    return sortedDms.filter((dm) => {
      const displayName = dmNicknames[dm.id] || dm.recipient?.displayName || "Unknown User";
      const matchesSearch = displayName.toLowerCase().includes(searchText.toLowerCase());
      if (filter === "pinned") {
        return matchesSearch && pinnedDMs.includes(dm.id);
      }
      return matchesSearch;
    }).length;
  }, [sortedDms, dmNicknames, searchText, filter, pinnedDMs]);

  

  const togglePin = async (dmId: string) => {
    if (pinnedDMs.includes(dmId)) {
      await removePinnedDM(dmId);
    } else {
      await addPinnedDM(dmId);
    }
    // Refetch pinned DMs to update state
    const pinned = await getPinnedDMs();
    setPinnedDMs(pinned);
  };

  const handleNicknameSet = async () => {
    // Refetch nicknames to update state
    setDmNicknames(await getDmNicknames());
  };

  const movePinnedDMUp = async (dmId: string) => {
    const currentIndex = pinnedDMs.indexOf(dmId);
    if (currentIndex > 0) {
      const newPinnedDMs = [...pinnedDMs];
      const [movedDm] = newPinnedDMs.splice(currentIndex, 1);
      newPinnedDMs.splice(currentIndex - 1, 0, movedDm);
      setPinnedDMs(newPinnedDMs);
      // Save the entire newPinnedDMs array to LocalStorage
      await LocalStorage.setItem("pinnedDMs", JSON.stringify(newPinnedDMs));
    }
  };

  const movePinnedDMDown = async (dmId: string) => {
    const currentIndex = pinnedDMs.indexOf(dmId);
    if (currentIndex < pinnedDMs.length - 1) {
      const newPinnedDMs = [...pinnedDMs];
      const [movedDm] = newPinnedDMs.splice(currentIndex, 1);
      newPinnedDMs.splice(currentIndex + 1, 0, movedDm);
      setPinnedDMs(newPinnedDMs);
      // Save the entire newPinnedDMs array to LocalStorage
      await LocalStorage.setItem("pinnedDMs", JSON.stringify(newPinnedDMs));
    }
  };

  const renderListItem = (dm: DMChannel) => {
    const isPinned = pinnedDMs.includes(dm.id);
    const displayName = dmNicknames[dm.id] || dm.recipient?.displayName || "Unknown User";
    const lastMessage = lastMessages[dm.id];

    let subtitleText = "Loading messages...";
    if (lastMessage) {
      const prefix = lastMessage.author.id === client.user?.id ? "You: " : "";
      subtitleText = prefix + lastMessage.content;
    } else if (dm.lastMessageId === null) {
      subtitleText = "No messages yet";
    }

    const accessories = [{ text: `@${dm.recipient?.username}` }];
    if (isPinned) {
      accessories.push({ icon: Icon.Pin, tooltip: "Pinned" });
    }

    return (
      <List.Item
        key={dm.id}
        title={displayName}
        subtitle={subtitleText}
        icon={dm.recipient?.displayAvatarURL()}
        accessories={accessories}
        actions={
          <ActionPanel>
            <Action.Push title="Show Messages" target={<MessageList channel={dm} />} />
            <Action.Push
              title="Quick Message"
              icon={Icon.Message}
              target={<SendMessageForm dm={dm} />}
            />
            <Action
              icon={isPinned ? Icon.MinusCircle : Icon.Pin}
              title={isPinned ? "Unpin DM" : "Pin DM"}
              onAction={() => togglePin(dm.id)}
              shortcut={{ modifiers: ["cmd", "shift"], key: "u" }}
            />
            {isPinned && (
              <Action
                icon={Icon.ArrowUp}
                title="Move Pinned DM Up"
                onAction={() => movePinnedDMUp(dm.id)}
                shortcut={{ modifiers: ["cmd", "shift"], key: "arrowUp" }}
              />
            )}
            {isPinned && (
              <Action
                icon={Icon.ArrowDown}
                title="Move Pinned DM Down"
                onAction={() => movePinnedDMDown(dm.id)}
                shortcut={{ modifiers: ["cmd", "shift"], key: "arrowDown" }}
              />
            )}
            <Action.Push
              icon={Icon.Pencil}
              title="Set Nickname"
              target={<SetNicknameForm dm={dm} onNicknameSet={handleNicknameSet} />}
              shortcut={{ modifiers: ["cmd"], key: "n" }}
            />
            {dmNicknames[dm.id] && (
              <Action
                icon={Icon.Trash}
                title="Remove Nickname"
                onAction={async () => {
                  await removeDmNickname(dm.id);
                  await handleNicknameSet();
                }}
                shortcut={{ modifiers: ["cmd", "shift"], key: "n" }}
              />
            )}
          </ActionPanel>
        }
      />
    );
  };

  return (
    <List
      isLoading={isLoading}
      navigationTitle="Direct Messages"
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search DMs by name or nickname"
      searchBarAccessory={
        <List.Dropdown tooltip="Filter DMs" storeValue onChange={setFilter}>
          <List.Dropdown.Section>
            <List.Dropdown.Item title="All DMs" value="all" />
            <List.Dropdown.Item title="Pinned DMs" value="pinned" />
          </List.Dropdown.Section>
        </List.Dropdown>
      }
      throttle
    >
      <List.Section title={filter === "pinned" ? "Pinned DMs" : "Direct Messages"} subtitle={`${filteredDms.length} of ${totalFilteredDms}`}>
        {filteredDms.map(renderListItem)}
      </List.Section>
      <List.Section>
        {currentPage > 0 && (
          <List.Item
            title="Previous Page"
            icon={Icon.ArrowLeft}
            actions={
              <ActionPanel>
                <Action title="Previous Page" onAction={() => setCurrentPage((prev) => prev - 1)} />
              </ActionPanel>
            }
          />
        )}
        {currentPage < Math.ceil(totalFilteredDms / itemsPerPage) - 1 && (
          <List.Item
            title="Next Page"
            icon={Icon.ArrowRight}
            actions={
              <ActionPanel>
                <Action title="Next Page" onAction={() => setCurrentPage((prev) => prev + 1)} />
              </ActionPanel>
            }
          />
        )}
      </List.Section>
    </List>
  );
}

function SetNicknameForm({ dm, onNicknameSet }: { dm: DMChannel; onNicknameSet: () => void }) {
  const { pop } = useNavigation();
  const [nickname, setNickname] = useState<string>("");

  useEffect(() => {
    const fetchNickname = async () => {
      const nicknames = await getDmNicknames();
      setNickname(nicknames[dm.id] || "");
    };
    fetchNickname();
  }, [dm.id]);

  const handleSubmit = async (values: { nickname: string }) => {
    await setDmNickname(dm.id, values.nickname);
    onNicknameSet();
    pop();
  };

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Set Nickname" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="nickname"
        title="Nickname"
        placeholder="Enter nickname for this DM"
        value={nickname}
        onChange={setNickname}
      />
    </Form>
  );
}

function SendMessageForm({ dm }: { dm: DMChannel }) {
  const { pop } = useNavigation();
  const [message, setMessage] = useState<string>("");

  const handleSubmit = async (values: { message: string }) => {
    try {
      await dm.send(values.message);
      pop(); // Go back to the previous view after sending
    } catch (error) {
      console.error("Failed to send message:", error);
      // Optionally, show an error toast or message to the user
    }
  };

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Send Message" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="message"
        title="Message"
        placeholder="Type your message here"
        value={message}
        onChange={setMessage}
      />
    </Form>
  );
}
