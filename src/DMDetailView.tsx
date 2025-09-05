import { List, ActionPanel, Action, useNavigation } from "@raycast/api";
import { useEffect, useState } from "react";
import { getMessages } from "./utils/discord"; // Assuming getMessages is in discord.ts or will be moved there
import { DM, Message } from "./types"; // Assuming DM and Message types are defined or will be defined

interface DMDetailViewProps {
  dm: DM;
}

export default function DMDetailView({ dm }: DMDetailViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMessages() {
      setIsLoadingMessages(true);
      setError(null);
      try {
        const fetchedMessages = await getMessages(dm.id);
        setMessages(fetchedMessages);
      } catch (err) {
        setError("Failed to fetch messages.");
        console.error(err);
      } finally {
        setIsLoadingMessages(false);
      }
    }
    fetchMessages();
  }, [dm.id]);

  return (
    <List isLoading={isLoadingMessages} searchBarPlaceholder={`Search messages in ${dm.name}...`}>
      {error ? (
        <List.Item title="Error" subtitle={error} />
      ) : messages.length > 0 ? (
        messages.map((message) => (
          <List.Item
            key={message.id}
            title={message.content}
            subtitle={message.author.username}
            actions={
              <ActionPanel>
                <Action.CopyToClipboard title="Copy Message" content={message.content} />
              </ActionPanel>
            }
          />
        ))
      ) : (
        <List.Item title="No messages found." />
      )}
    </List>
  );
}
