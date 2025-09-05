import { Detail, ActionPanel, Action } from "@raycast/api";
import { Message, Embed } from "discord.js-selfbot-v13";

interface MessageDetailViewProps {
  message: Message;
}

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

export default function MessageDetailView({ message }: MessageDetailViewProps) {
  const markdownContent = formatMessageDetailMarkdown(message);

  return (
    <Detail
      markdown={markdownContent}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard title="Copy Message Content" content={message.content} />
          {message.attachments.size > 0 &&
            Array.from(message.attachments.values()).map((attachment) => (
              <Action.OpenInBrowser
                key={attachment.id}
                title={`Open Attachment: ${attachment.name}`}
                url={attachment.url}
              />
            ))}
        </ActionPanel>
      }
    />
  );
}
