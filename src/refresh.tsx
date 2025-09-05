import { List, ActionPanel, Action, Icon, Toast, showToast } from "@raycast/api";
import { useState, useEffect, useRef } from "react";
import { client } from "./utils/discord";
import { saveUserProfile, saveGuilds, saveMessages } from "./utils/storage";

export default function RefreshCommand() {
  const [status, setStatus] = useState("Initializing...");
  const [progress, setProgress] = useState(0);
  const [totalSteps, setTotalSteps] = useState(1); // Start with 1 for client ready check
  const [isLoading, setIsLoading] = useState(true); // New loading state
  const [userProfileUpdated, setUserProfileUpdated] = useState(false);
  const [guildsUpdated, setGuildsUpdated] = useState(false);
  const [totalDMsProcessed, setTotalDMsProcessed] = useState(0);
  const [totalMessagesSaved, setTotalMessagesSaved] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null); // Ref to store AbortController

  useEffect(() => {
    const performRefresh = async (signal: AbortSignal) => {
      setIsLoading(true); // Set loading to true at the start

      // Reset stats
      setUserProfileUpdated(false);
      setGuildsUpdated(false);
      setTotalDMsProcessed(0);
      setTotalMessagesSaved(0);

      const toast = await showToast({
        style: Toast.Style.Animated,
        title: "Refreshing data...",
        message: "Populating cache for faster loading...",
      });

      try {
        // 1. Ensure client is ready
        setStatus("Connecting to Discord and populating cache...");
        if (!client.isReady()) {
          await Promise.race([
            new Promise<void>((resolve) => {
              client.once("ready", () => resolve());
            }),
            new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('Refresh cancelled'))))
          ]);
        }
        if (signal.aborted) return; // Check after await, return silently if aborted
        setStatus("Discord client ready.");
        setProgress(1);

        // 2. Fetch and save user profile
        if (signal.aborted) throw new Error('Refresh cancelled'); // Check before operation
        setTotalSteps(2);
        setStatus("Fetching user profile...");
        const user = client.user;
        if (user) {
          const updated = await saveUserProfile(user); // Get return value
          if (updated) {
            console.log("Refresh: User profile saved.");
            setUserProfileUpdated(true);
          } else {
            console.log("Refresh: User profile is up-to-date.");
            setUserProfileUpdated(false);
          }
        }
        if (signal.aborted) throw new Error('Refresh cancelled'); // Check after saveUserProfile
        setProgress(2);

        // 3. Fetch and save guilds
        if (signal.aborted) throw new Error('Refresh cancelled'); // Check before operation
        setTotalSteps(3);
        setStatus("Fetching guilds...");
        const guilds = Array.from(client.guilds.cache.values());

        const GUILD_CONCURRENCY_LIMIT = 2;
        let guildProgress = 0;
        let anyGuildUpdated = false;

        for (let i = 0; i < guilds.length; i += GUILD_CONCURRENCY_LIMIT) {
          if (signal.aborted) throw new Error('Refresh cancelled'); // Check inside loop
          const batch = guilds.slice(i, i + GUILD_CONCURRENCY_LIMIT);
          const guildPromises = batch.map(async (guild) => {
            const updated = await saveGuilds([guild]); // Save individual guild
            if (updated) {
              anyGuildUpdated = true;
            }
          });
          await Promise.all(guildPromises);
          guildProgress += batch.length;
          setProgress(3 + guildProgress);
        }

        if (anyGuildUpdated) {
          console.log(`Refresh: ${guilds.length} guilds processed, some updated.`);
          setGuildsUpdated(true);
        } else {
          console.log(`Refresh: Guilds are up-to-date.`);
          setGuildsUpdated(false);
        }
        if (signal.aborted) throw new Error('Refresh cancelled'); // Check after saveGuilds
        setProgress(3);

        // 4. Fetch and save DMs and their messages
        setStatus("Fetching DMs and messages...");
        const dms = Array.from(client.channels.cache.values()).filter(
          (channel) => channel.type === "DM"
        ) as DMChannel[];
        setTotalSteps(3 + dms.length);

        const CONCURRENCY_LIMIT = 5;
        let dmProgress = 0;
        const dmPromises: Promise<void>[] = [];

        for (let i = 0; i < dms.length; i++) {
          if (signal.aborted) throw new Error('Refresh cancelled'); // Check inside loop
          const dm = dms[i];
          const promise = (async (currentDm: DMChannel, index: number) => {
            setStatus(`Fetching messages for DM: ${currentDm.recipient?.username || currentDm.id} (${index + 1}/${dms.length})`);
            setTotalDMsProcessed((prev) => prev + 1); // Increment processed DMs
            try {
              // Pass signal to fetch operation if it supports it
              // discord.js-selfbot-v13's fetch might not directly support AbortSignal
              // So we'll rely on checking signal.aborted before and after await
              const messages = await Promise.race([
                currentDm.messages.fetch({ limit: 50 }),
                new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('Refresh cancelled'))))
              ]);
              if (signal.aborted) throw new Error('Refresh cancelled'); // Check after fetch
              const updatedMessages = await saveMessages(currentDm.id, Array.from(messages.values()));
              if (updatedMessages) {
                console.log(`Refresh: Saved ${messages.size} messages for DM ${currentDm.id}`);
                setTotalMessagesSaved((prev) => prev + messages.size);
              } else {
                console.log(`Refresh: Messages for DM ${currentDm.id} are up-to-date.`);
              }
              if (signal.aborted) throw new Error('Refresh cancelled'); // Check after saveMessages
            } catch (msgErr: any) {
              if (msgErr.name === 'Error' && msgErr.message === 'Refresh cancelled') {
                throw msgErr; // Re-throw if it's our cancellation error
              }
              console.error(`Refresh: Failed to fetch messages for DM ${currentDm.id}:`, msgErr);
              setStatus(`Failed to fetch messages for DM: ${currentDm.recipient?.username || currentDm.id}`);
            } finally {
              dmProgress++;
              setProgress(3 + dmProgress);
            }
          })(dm, i);

          dmPromises.push(promise);

          if (dmPromises.length >= CONCURRENCY_LIMIT) {
            await Promise.all(dmPromises.splice(0, CONCURRENCY_LIMIT));
          }
        }

        await Promise.all(dmPromises); // Wait for all promises, short-circuits on rejection
        if (signal.aborted) throw new Error('Refresh cancelled'); // Final check

        toast.style = Toast.Style.Success;
        toast.title = "Refresh Complete!";
        toast.message = "Cache has been populated for faster loading.";
      } catch (err: any) {
        if (err.name === 'Error' && err.message === 'Refresh cancelled') {
          toast.style = Toast.Style.Failure;
          toast.title = "Refresh Cancelled";
          toast.message = "The data refresh was cancelled.";
          console.log("Refresh: User cancelled the refresh.");
          return; // Exit the function after cancellation
        } else {
          console.error("Refresh failed:", err);
          toast.style = Toast.Style.Failure;
          toast.title = "Refresh Failed";
          toast.message = err.message || "An unknown error occurred during refresh.";
        }
      } finally {
        abortControllerRef.current = null; // Clear controller after refresh attempt
        setIsLoading(false); // Set loading to false when refresh is complete or cancelled
      }
    };

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const performRefreshWrapper = async () => {
      await performRefresh(abortController.signal);
    };

    performRefreshWrapper();

    return () => { // Cleanup on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort(); // Abort if component unmounts
      }
    };
  }, []);

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  return (
    <List isLoading={isLoading}>
      <List.Item
        title={isLoading ? status : "Refresh Complete!"}
        subtitle={isLoading ? `Progress: ${Math.round((progress / totalSteps) * 100)}%` : `User: ${userProfileUpdated ? 'Updated' : 'Up-to-date'} | Guilds: ${guildsUpdated ? 'Updated' : 'Up-to-date'} | DMs: ${totalDMsProcessed} | Messages: ${totalMessagesSaved}`}
        icon={isLoading ? Icon.ArrowClockwise : Icon.CheckCircle}
      />
      <List.Item
        title="To cancel, press Esc or Backspace"
        icon={Icon.Info}
      />
    </List>
  );
}
