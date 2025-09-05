import { getPreferenceValues } from "@raycast/api";
import { Client } from "discord.js-selfbot-v13";

const preferences = getPreferenceValues();
const token = preferences.discordToken;

if (!token) {
  throw new Error("Discord token is not set in preferences.");
}

export const client = new Client({
    checkUpdate: false,
    ws: {
        properties: {
            $os: "windows",
            $browser: "raycast",
            $device: "raycast",
        }
    }
});

client.login(token).catch((error) => {
  console.error("Failed to log in to Discord:", error);
});

client.on("ready", () => {
  console.log(`Logged in as ${client.user?.tag}!`);
});