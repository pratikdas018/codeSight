# CodeSight Desktop Auto-Update Workflow

CodeSight now uses `electron-updater` with the GitHub Releases provider configured for:

- owner: `pratikdas018`
- repo: `codeSight`

When a packaged desktop app starts, it checks GitHub Releases for a newer version. If a newer release exists, the renderer shows an update modal, downloads the update in the background after user confirmation, and installs it after the user clicks `Restart & Install`.

## How new releases become available to existing users

`electron-builder` generates update metadata files such as `latest.yml` for Windows, plus platform-specific metadata for macOS and Linux builds. `electron-updater` reads those metadata files from GitHub Releases and compares the installed app version to the latest published version.

Once a new release is published with the installer and metadata assets attached, existing CodeSight desktop users automatically see the update notification on next startup, or when they click `Check For Updates` in Settings.

## Release workflow

### Step 1: update version

```bash
npm version patch
```

### Step 2: build release

```bash
npm run electron:build
```

This creates release assets inside `release/`.

### Step 3: upload generated files to GitHub Release

Create a GitHub Release for the same version tag and upload the generated assets.

For Windows, upload:

- `CodeSight-<version>-win-x64.exe`
- `CodeSight-<version>-win-x64.exe.blockmap`
- `latest.yml`

For future macOS builds, also upload:

- `CodeSight-<version>.dmg`
- `CodeSight-<version>-mac.zip`
- related `.blockmap` files
- `latest-mac.yml`

For future Linux AppImage builds, also upload:

- `CodeSight-<version>.AppImage`
- related `.blockmap` files when generated
- `latest-linux.yml`

Important:

- The GitHub Release must not remain a draft.
- The tag version must match the app version.
- macOS auto-update requires a signed app when mac builds are introduced.

### Step 4: existing users receive update notification automatically

On the next startup, or after a manual `Check For Updates`, installed desktop users compare their local app version against the release metadata in GitHub Releases and receive the in-app update flow automatically.
