/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Discord Token - Your Discord user token. This is required for the extension to work. Be aware of the risks of using a user token. */
  "discordToken": string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `index` command */
  export type Index = ExtensionPreferences & {}
  /** Preferences accessible in the `dms` command */
  export type Dms = ExtensionPreferences & {}
  /** Preferences accessible in the `refresh` command */
  export type Refresh = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `index` command */
  export type Index = {}
  /** Arguments passed to the `dms` command */
  export type Dms = {}
  /** Arguments passed to the `refresh` command */
  export type Refresh = {}
}

