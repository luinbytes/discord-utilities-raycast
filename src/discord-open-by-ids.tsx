import React from "react";
import { Action, ActionPanel, Form, Icon, Toast, showToast } from "@raycast/api";
import { useState } from "react";
import { makeServerLink, makeChannelLink, makeDmLink, makeGuildMessageLink, makeDmMessageLink, isDiscordDeepLink, openDeepLink } from "./utils/discord";

/**
 * Quick Open by IDs (no persistence)
 * - Server: guildId
 * - Channel: guildId + channelId
 * - DM: dmChannelId
 * - Message:
 *   - Guild message: guildId + channelId + messageId
 *   - DM message: channelId + messageId (leave guildId empty)
 */
export default function OpenByIds() {
  type Target = "server" | "channel" | "dm" | "message";
  const [target, setTarget] = useState<Target>("channel");
  const [guildId, setGuildId] = useState("");
  const [channelId, setChannelId] = useState("");
  const [messageId, setMessageId] = useState("");
  const [link, setLink] = useState("");

  const handleSubmit = async () => {
    let url = link.trim();

    if (!url) {
      switch (target) {
        case "server":
          if (!guildId.trim()) break;
          url = makeServerLink(guildId.trim());
          break;
        case "channel":
          if (!guildId.trim() || !channelId.trim()) break;
          url = makeChannelLink(guildId.trim(), channelId.trim());
          break;
        case "dm":
          if (!channelId.trim()) break;
          url = makeDmLink(channelId.trim());
          break;
        case "message":
          if (guildId.trim()) {
            if (!channelId.trim() || !messageId.trim()) break;
            url = makeGuildMessageLink(guildId.trim(), channelId.trim(), messageId.trim());
          } else {
            if (!channelId.trim() || !messageId.trim()) break;
            url = makeDmMessageLink(channelId.trim(), messageId.trim());
          }
          break;
      }
    }

    if (!isDiscordDeepLink(url)) {
      await showToast(Toast.Style.Failure, "Invalid or incomplete input", "Provide a discord:// link or valid IDs for the chosen target.");
      return;
    }

    await openDeepLink(url);
    await showToast(Toast.Style.Success, "Opened Discord link");
  };

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Open" onSubmit={handleSubmit} icon={Icon.ArrowRight} />
        </ActionPanel>
      }
    >
      <Form.Dropdown id="target" title="Target" value={target} onChange={(v) => setTarget(v as Target)}>
        <Form.Dropdown.Item value="server" title="Server (Guild)" />
        <Form.Dropdown.Item value="channel" title="Channel (Guild + Channel)" />
        <Form.Dropdown.Item value="dm" title="Direct Message (DM Channel)" />
        <Form.Dropdown.Item value="message" title="Message (Guild or DM)" />
      </Form.Dropdown>

      <Form.Separator />
      <Form.Description title="Compose by IDs" text="For DM messages, leave Guild ID empty. For guild messages, provide all three IDs." />
      <Form.TextField id="guildId" title="Guild ID (server)" placeholder="e.g., 123... (leave empty for DM)" value={guildId} onChange={setGuildId} />
      <Form.TextField id="channelId" title="Channel ID / DM Channel ID" placeholder="e.g., 456..." value={channelId} onChange={setChannelId} />
      <Form.TextField id="messageId" title="Message ID (for Message target)" placeholder="e.g., 789..." value={messageId} onChange={setMessageId} />

      <Form.Separator />
      <Form.TextField id="link" title="Link (optional)" placeholder="Paste full discord:// link instead of IDs" value={link} onChange={setLink} />
    </Form>
  );
}
