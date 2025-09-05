import { Detail } from "@raycast/api";
import { client } from "./utils/discord";
import { useEffect, useState } from "react";
import { User } from "discord.js-selfbot-v13";

export default function ProfileCommand() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUser = () => {
      setUser(client.user);
      setIsLoading(false);
    };

    if (client.isReady()) {
      fetchUser();
    } else {
      client.on("ready", fetchUser);
    }

    return () => {
        client.off("ready", fetchUser);
    }
  }, []);

  const markdown = user ? `
# ${user.username}
![Avatar](${user.displayAvatarURL()})
  ` : "";

  return (
    <Detail
      isLoading={isLoading}
      markdown={markdown}
    />
  );
}
