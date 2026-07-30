# Data Pack Upgrader

A browser-based **Minecraft: Java Edition data pack upgrader**. Drop a zipped data pack into the page, choose its source and target versions, review the warnings, and download the upgraded pack.

This project upgrades data packs only. It does not turn packs into mods, plugins, resource packs, or another project type.

Originally created by [Misode](https://github.com/misode/upgrader). This fork resumes maintenance of the original MIT-licensed project.

## Supported versions

The upgrader can read packs beginning with Java Edition 1.16.5 and upgrade forward through:

- 1.20.2, 1.20.3–1.20.4, and 1.20.5–1.20.6
- 1.21 through 1.21.11, including all release pack-format boundaries
- 26.1, 26.1.1, and 26.1.2
- 26.2
- 26.3 Snapshot 1 through 26.3 Snapshot 6

The current stable default target is **26.2**. Snapshot output is deliberately marked experimental.

## What is upgraded

Depending on the selected options, the tool updates:

- `pack.mcmeta`, including the `min_format`/`max_format` format used by 1.21.9 and newer
- legacy plural registry folders to the singular 1.21 paths
- functions and selected command syntax
- item NBT to item components for the 1.20.5 boundary
- predicates, advancements, loot tables, item modifiers, recipes, and tags
- world-generation registries and selected breaking worldgen formats
- the entity predicate redesign in 26.2
- configured feature/carver registry moves and the 26.3 Snapshot 4 loot/predicate redesign

Minecraft changes are not always one-to-one. When intent cannot be inferred safely, the upgrader preserves the data when possible and emits a warning instead of inventing behavior. Always test the result with `/reload`, inspect the game log, and keep a backup of the original pack.

## Development

Requirements:

- Node.js 20 or newer
- npm

```bash
npm install
npm run dev
```

Quality checks:

```bash
npm test -- --run
npm run build
npm run lint
```

The production build uses the `/upgrader/` base path for GitHub Pages:

```bash
npm run build
```

## Maintaining a fork

After creating your GitHub fork, set `VITE_REPOSITORY_URL` to the fork URL when building so the source and issue links point to your repository. If it is omitted, the original Misode repository is used. Keep the original attribution and the MIT license.

```bash
VITE_REPOSITORY_URL=https://github.com/YOUR_NAME/upgrader npm run build
```

For each new Minecraft version:

1. Add its format tuple and display entry to `src/Version.ts`.
2. Add a version-scoped migration under `src/fixes/`.
3. Register the migration in `src/fixes/index.ts`.
4. Add tests for every automatic conversion and every ambiguous-change warning.
5. Verify the pack format and breaking changes against Mojang's Java Edition changelog.

## Research references

The 1.21–26.3 work was checked against:

- [Official Minecraft Java Edition release notes](https://www.minecraft.net/en-us/articles)
- [Misode's technical changes archive](https://github.com/misode/technical-changes)
- [Minecraft Wiki pack-format history](https://minecraft.wiki/w/Pack_format)
- Vanilla data files from the corresponding official server JARs

The latest researched development version in this update is **26.3 Snapshot 6**, released July 28, 2026, with data pack format **113.0**. See [`docs/version-research.md`](docs/version-research.md) for the format table, migration boundaries, and primary sources.

## License

[MIT](LICENSE)
