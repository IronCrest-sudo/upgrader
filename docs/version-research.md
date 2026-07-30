# Minecraft data-pack version research

Research cutoff: **2026-07-30**. Scope: Minecraft: Java Edition **data packs only**. Resource-pack-only, rendering, protocol, server-management, and world-save storage changes are intentionally outside the upgrader's scope.

## Release format map

| Java Edition version | Data pack format | Upgrader entry |
|---|---:|---|
| 1.20–1.20.1 | 15 | `1.20` |
| 1.20.2 | 18 | `1.20.2` |
| 1.20.3–1.20.4 | 26 | `1.20.4` |
| 1.20.5–1.20.6 | 41 | `1.20.6` |
| 1.21–1.21.1 | 48 | `1.21`, `1.21.1` |
| 1.21.2–1.21.3 | 57 | `1.21.2`, `1.21.3` |
| 1.21.4 | 61 | `1.21.4` |
| 1.21.5 | 71 | `1.21.5` |
| 1.21.6 | 80 | `1.21.6` |
| 1.21.7–1.21.8 | 81 | `1.21.7`, `1.21.8` |
| 1.21.9–1.21.10 | 88.0 | `1.21.9`, `1.21.10` |
| 1.21.11 | 94.1 | `1.21.11` |
| 26.1–26.1.2 | 101.1 | `26.1`, `26.1.1`, `26.1.2` |
| 26.2 | 107.1 | `26.2` |
| 26.3 Snapshot 1 | 108.0 | `26.3-snapshot-1` |
| 26.3 Snapshot 2 | 109.0 | `26.3-snapshot-2` |
| 26.3 Snapshot 3 | 110.0 | `26.3-snapshot-3` |
| 26.3 Snapshot 4 | 111.0 | `26.3-snapshot-4` |
| 26.3 Snapshot 5 | 112.0 | `26.3-snapshot-5` |
| 26.3 Snapshot 6 | 113.0 | `26.3-snapshot-6` |

From 1.21.9 onward, `pack.mcmeta` uses full `[major, minor]` values in `min_format` and `max_format`. The old `supported_formats` field is removed for modern-only packs.

## Main migration boundaries implemented

- **1.20.2:** game event changes.
- **1.20.3/1.20.4:** `grass` to `short_grass` and related ID updates.
- **1.20.5/1.20.6:** item NBT to structured components, item/block/fluid/location predicates, cooking recipe results, loot functions, particles, attributes, and number providers.
- **1.21/1.21.1:** singular data registry folders, data-driven enchantment-related loot changes, attribute modifier IDs, and renamed target entities.
- **1.21.2/1.21.3:** simplified recipe ingredients, prefix-free attribute IDs, biome carvers, consumable components, and renamed enchantment effects.
- **1.21.4:** custom model data, weighted biome music, equippable assets, particles, and furnace/TNT field names.
- **1.21.5:** SNBT text events, tooltip display, simplified components, advancement backgrounds, variants, and selected entity field changes.
- **1.21.6–1.21.10:** particle/tag changes, full pack format metadata, respawn fields, and preliminary surface level.
- **1.21.11:** environment attributes, game-rule registry IDs, filtered loot functions, attack range, world-border timing, and selected timeline/dimension migrations.
- **26.1:** world clocks/test environments, crop-support tags, recipe changes, inventory slot names, and configured feature changes.
- **26.2:** entity predicate component-map format, feature/tag/attribute renames, and selected worldgen validation changes.
- **26.3 snapshots:** pottery data, configured feature/carver registry moves, material rules, worldgen feature changes, data-driven brewing support, Snapshot 4 loot/predicate/item-modifier redesign, and Snapshot 6 noise/density formats.

When a migration requires author intent (for example removed feature types, explicit ore-vein definitions, or converting an inline painting variant into a named registry entry), the tool emits a warning rather than silently inventing behavior.

## Primary sources

- [Minecraft Wiki: Pack format](https://minecraft.wiki/w/Pack_format)
- [Misode technical changes archive](https://github.com/misode/technical-changes)
- [Minecraft Java Edition 1.21.4](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-21-4)
- [Minecraft Java Edition 1.21.5](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-21-5)
- [Minecraft Java Edition 1.21.6](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-21-6)
- [Minecraft Java Edition 1.21.7](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-21-7)
- [Minecraft Java Edition 1.21.9](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-21-9)
- [Minecraft Java Edition 1.21.11](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-21-11)
- [Minecraft 26.1 release/snapshot notes](https://www.minecraft.net/en-us/article/minecraft-26-1-snapshot-1)
- [Minecraft 26.2](https://www.minecraft.net/en-us/article/minecraft-26-2-snapshot-1)
- [26.3 Snapshot 1](https://www.minecraft.net/en-us/article/minecraft-26-3-snapshot-1)
- [26.3 Snapshot 2](https://www.minecraft.net/en-us/article/minecraft-26-3-snapshot-2)
- [26.3 Snapshot 3](https://www.minecraft.net/en-us/article/minecraft-26-3-snapshot-3)
- [26.3 Snapshot 4](https://www.minecraft.net/en-us/article/minecraft-26-3-snapshot-4)
- [26.3 Snapshot 5](https://www.minecraft.net/en-us/article/minecraft-26-3-snapshot-5)
- [26.3 Snapshot 6](https://www.minecraft.net/en-us/article/minecraft-26-3-snapshot-6)

Vanilla JSON definitions from the official server JARs were also inspected to verify current registry paths and representative formats.
