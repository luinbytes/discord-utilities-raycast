/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Preferred Flavor - Which Discord flavor to use when invoking the global Open Discord action. */
  "preferredFlavor": "stable" | "ptb" | "canary",
  /** Stable Path Override - Optional full path to Update.exe or Discord.exe for Stable. */
  "stablePath"?: string,
  /** PTB Path Override - Optional full path to Update.exe or DiscordPTB.exe for PTB. */
  "ptbPath"?: string,
  /** Canary Path Override - Optional full path to Update.exe or DiscordCanary.exe for Canary. */
  "canaryPath"?: string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `discord` command */
  export type Discord = ExtensionPreferences & {}
  /** Preferences accessible in the `discord-add-pin` command */
  export type DiscordAddPin = ExtensionPreferences & {}
  /** Preferences accessible in the `discord-open-by-ids` command */
  export type DiscordOpenByIds = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `discord` command */
  export type Discord = {}
  /** Arguments passed to the `discord-add-pin` command */
  export type DiscordAddPin = {}
  /** Arguments passed to the `discord-open-by-ids` command */
  export type DiscordOpenByIds = {}
}

