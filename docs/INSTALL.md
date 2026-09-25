# Installing Balance Insights

> **Unofficial app, not affiliated with Monobank.**

Download the file for your system from the [latest release](https://github.com/MortyQ/muza-balance-insights/releases/latest):

| System | File |
|---|---|
| macOS, Apple Silicon (M1 and newer) | `Balance-Insights-<version>-mac-arm64.dmg` |
| macOS, Intel | `Balance-Insights-<version>-mac-x64.dmg` |
| Windows 10 / 11 (64-bit) | `Balance-Insights-<version>-win-x64.exe` |
| Linux (64-bit) | `Balance-Insights-<version>-linux-x64.AppImage` |

Not sure which Mac you have: Apple menu → About This Mac → «Chip» (Apple M…) or «Processor» (Intel).

The installers are **not signed** with an Apple or Microsoft certificate (that costs money every year). Your system will warn you the first time — the steps below get past it. To make sure the file is the one built from this repository, check it first (optional, but recommended).

## Check the file (optional)

Every release has `SHA256SUMS.txt` next to the installers.

- **macOS**: in Terminal, `cd ~/Downloads`, then `shasum -a 256 Balance-Insights-*.dmg`
- **Windows**: in PowerShell, `cd ~\Downloads`, then `Get-FileHash .\Balance-Insights-*.exe`
- **Linux**: `cd ~/Downloads`, then `sha256sum Balance-Insights-*.AppImage`

The long code must be exactly the one in `SHA256SUMS.txt` for that file.

With the [GitHub CLI](https://cli.github.com/) you can also check that the file was built by this repository's release workflow:

```
gh attestation verify Balance-Insights-<version>-mac-arm64.dmg --repo MortyQ/muza-balance-insights
```

## macOS

1. Open the `.dmg` and drag **Balance Insights** onto **Applications**.
2. Open Applications and double-click **Balance Insights**. macOS refuses to open it because it cannot check the developer — close that message (do not move the app to the Bin).
3. Open **System Settings → Privacy & Security**, scroll down to the message about Balance Insights → **Open Anyway**, confirm with your password.
4. The app opens. Next time it opens normally.

**After an update** macOS asks once for your password to let the new version use the saved token in the Keychain. Choose **Always Allow** — the token and your data stay.

## Windows

1. Run `Balance-Insights-<version>-win-x64.exe`.
2. Windows may show «Windows protected your PC» (SmartScreen): click **More info → Run anyway**.
3. The app installs for your user only (no administrator rights needed) and starts. It is in the Start menu as **Balance Insights**.

## Linux

1. Make the file executable: `chmod +x Balance-Insights-*.AppImage`
2. Run it: `./Balance-Insights-<version>-linux-x64.AppImage`
3. If it says FUSE is missing, install it: Ubuntu 22.04 — `sudo apt install libfuse2`, Ubuntu 24.04 and newer — `sudo apt install libfuse2t64`.

Without GNOME Keyring or KWallet the token is kept in memory only: you will enter it again after each restart. The app tells you when that is the case.

## First start

1. Create a personal token at [api.monobank.ua](https://api.monobank.ua/) (sign in with the Monobank app).
2. Paste it into the app. «Remember on this computer» keeps it in the system keychain.
3. Choose how many months to import. The first import of a long history takes a while: Monobank allows one statement request per minute. You can close the app — the import continues next time.

## Updates

- **Windows** and **Linux (AppImage)**: the app checks GitHub every few hours, downloads a new version in the background and
  shows «Перезапустить и обновить». It also installs on the next quit.
- **macOS**: the app shows the new version, downloads the `.dmg` into Downloads when you click «Скачать». Open it and drag
  Balance Insights onto Applications, replacing the old one. macOS asks once for your password to let the new version use
  the saved token — choose **Always Allow**.
- Every update is checked against a signature of the author before it is installed or saved; a file that does not match is deleted.
- Settings → Updates: your version, «Проверить сейчас», and a switch to turn automatic checks off.
- Automatic updates start with 0.1.2: from 0.1.0 or 0.1.1, install 0.1.2 by hand once.

## Where your data is, and removing it

Everything stays on your computer:

| System | Folder |
|---|---|
| macOS | `~/Library/Application Support/Balance Insights/` |
| Windows | `%APPDATA%\Balance Insights\` |
| Linux | `~/.config/Balance Insights/` |

- **Delete all data** in the app removes the database, the saved token and any unfinished import.
- Uninstalling the app does **not** remove that folder: delete it yourself if you want everything gone. On macOS you can also remove the app’s «Safe Storage» entry in Keychain Access.
- **macOS** uninstall: move Balance Insights from Applications to the Bin. **Windows**: Settings → Apps → Balance Insights → Uninstall. **Linux**: delete the `.AppImage`.

If your token may have leaked, revoke it at [api.monobank.ua](https://api.monobank.ua/).

## Problems

[Open an issue](https://github.com/MortyQ/muza-balance-insights/issues/new/choose) with the app version, your system and what happened. **Never include your token, statements, amounts, names or screenshots with your data.**
