import { Action, ActionPanel, List, Icon, Form, useNavigation } from "@raycast/api";
import { client } from "./utils/discord";
import { useEffect, useState } from "react";
import { DMChannel } from "discord.js-selfbot-v13";
import { MessageList } from "./components/MessageList";
import { addPinnedDM, getPinnedDMs, removePinnedDM, getDmNicknames, setDmNickname, removeDmNickname } from "./utils/storage";

export default function DmsCommand() {
  const [dms, setDms] = useState<DMChannel[]>([]);
  const [pinnedDMs, setPinnedDMs] = useState<string[]>([]);
  const [dmNicknames, setDmNicknames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    const fetchedPinnedDMs = await getPinnedDMs();
    setPinnedDMs(fetchedPinnedDMs);

    const fetchedDmNicknames = await getDmNicknames();
    setDmNicknames(fetchedDmNicknames);

    const fetchedDms = Array.from(client.channels.cache.values()).filter(
      (channel) => channel.type === "DM"
    ) as DMChannel[];

    setDms(fetchedDms);
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
    }
  }, []);

  const togglePin = async (dmId: string) => {
    if (pinnedDMs.includes(dmId)) {
      await removePinnedDM(dmId);
    } else {
      await addPinnedDM(dmId);
    }
    await loadData(); // Reload all data to re-sort and update UI
  };

  const handleNicknameSet = async () => {
    await loadData(); // Reload all data to re-sort and update UI
  };

  const renderListItem = (dm: DMChannel) => {
    const isPinned = pinnedDMs.includes(dm.id);
    const displayName = dmNicknames[dm.id] || dm.recipient?.username || "Unknown User";
    return (
      <List.Item
        key={dm.id}
        title={displayName}
        icon={dm.recipient?.displayAvatarURL()}
        accessories={isPinned ? [{ icon: Icon.Pin, tooltip: "Pinned" }] : []}
        actions={
          <ActionPanel>
            <Action.Push
              title="Show Messages"
              target={<MessageList channel={dm} />}
            />
            <Action
              icon={isPinned ? Icon.MinusCircle : Icon.Pin}
              title={isPinned ? "Unpin DM" : "Pin DM"}
              onAction={() => togglePin(dm.id)}
              shortcut={{ modifiers: ["cmd"], key: "enter" }}
            />
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
                  await loadData();
                }}
                shortcut={{ modifiers: ["cmd", "shift"], key: "n" }}
              />
            )}
          </ActionPanel>
        }
      />
    );
  };

  const pinnedDmsList = dms.filter((dm) => pinnedDMs.includes(dm.id));
  const unpinnedDmsList = dms.filter((dm) => !pinnedDMs.includes(dm.id));

  return (
    <List isLoading={isLoading}>
      {pinnedDmsList.length > 0 && (
        <List.Section title="Pinned">
          {pinnedDmsList.map(renderListItem)}
        </List.Section>
      )}
      {unpinnedDmsList.length > 0 && (
        <List.Section title="All">
          {unpinnedDmsList.map(renderListItem)}
        </List.Section>
      )}
    </List>
  );
}

function SetNicknameForm({ dm, onNicknameSet }: { dm: DMChannel, onNicknameSet: () => void }) {
  const { pop } = useNavigation();
  const [nickname, setNickname] = useState<string>(getDmNicknames()[dm.id] || "");

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
