import { Detail } from "@raycast/api";
import { Detail, ActionPanel, Action, Icon } from "@raycast/api";
import { client } from "./utils/discord";
import { useEffect, useState } from "react";
import { User } from "discord.js-selfbot-v13";
import { saveUserProfile, getUserProfile } from "./utils/storage";
import { useEffect, useState } from "react";
import { User } from "discord.js-selfbot-v13";

export default function ProfileCommand() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingState, setLoadingState] = useState<'loading' | 'loaded' | 'error'>('loading'); // New loading state
  const [error, setError] = useState<string | null>(null); // New error state

  useEffect(() => {
    const fetchUser = async () => { // Make fetchUser async
      setError(null); // Clear previous errors

      let loadedFromCache = false;
      const cachedUser = await getUserProfile();
      if (cachedUser) {
        // Convert CachedUserProfile back to User-like object
        setUser(cachedUser as User); // Cast for now
        setLoadingState('loaded'); // Display cached data immediately
        console.log(`Profile: Loaded user profile from cache.`);
        loadedFromCache = true;
      }

      setLoadingState('loading'); // Always set to loading when starting network fetch

      try {
        if (!client.isReady()) {
          console.log("Profile: Discord client is not ready. Cannot fetch user profile.");
          setError("Discord client is not connected. Please try again later.");
          setLoadingState('error');
          return;
        }

        const fetchedUser = client.user;
        if (fetchedUser) {
          setUser(fetchedUser);
          await saveUserProfile(fetchedUser); // Save fresh user profile to cache
          console.log(`Profile: Fetched user profile from network.`);
        } else {
          setError("Could not fetch user profile.");
        }

        setLoadingState('loaded'); // All done, set to loaded
      } catch (err: any) {
        console.error("Profile: Failed to fetch user profile:", err);
        setError(`Failed to load user profile: ${err.message || "Unknown error"}`);
        setLoadingState('error');
      }
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
      isLoading={loadingState === 'loading' && !user} // Only show full loading if no user data yet
      markdown={error ? `# Error\n${error}` : markdown} // Display error in markdown
      actions={
        <ActionPanel>
          {loadingState === 'loading' && user && ( // Show subtle refresh if user data is already displayed
            <Action.Title title="Refreshing..." icon={Icon.ArrowClockwise} />
          )}
          {/* Add a refresh action if needed */}
          <Action title="Refresh Profile" onAction={() => { /* Trigger fetchUser again */ }} icon={Icon.ArrowClockwise} />
        </ActionPanel>
      }
    />
  );
}
