---
title: 'Reverse Engineering a Flash MMO Back to Life in Godot'
description: 'When Flash died, it took a whole era of online games with it. This is how I decompiled the space MMO Astroflux, recovered its assets and physics from the original ActionScript, and rebuilt it as a faithful, server-authoritative game in Godot 4.'
pubDate: 2026-02-15
tags: ['Game Dev', 'Godot', 'Reverse Engineering', 'Networking', 'Open Source']
---

Flash did not die quietly. When browsers dropped the plugin at the end of 2020, they did not just retire a piece of technology. They took an entire generation of online games down with it. Thousands of them, many of them multiplayer, most of them never ported anywhere, simply stopped being playable one afternoon and stayed that way. Astroflux was one of those games: a top-down space MMO where you flew a ship, ground for tech points, and fought other players across a galaxy of solar systems. I loved it, and one day it was gone.

So I decided to bring it back. Not a tribute, not a spiritual successor, but the actual game rebuilt from the inside out. That meant two jobs stacked on top of each other. First, reverse engineer the original Flash client to recover what it was made of. Second, rebuild it faithfully in a modern engine, with a real server, so it could be an MMO again instead of a lonely single-player clone. The result is [astroflux-rewritten](https://github.com/yourusername/astroflux-rewritten), a Godot 4 project, and here is how it came together.

## Decompiling a dead game to see what it was made of

A Flash game ships as a compiled SWF, but under it all Astroflux was ActionScript 3, and AS3 decompiles cleanly enough that you can read the original class structure. That turned out to be the whole key. Almost every script in the Godot project carries a header pointing back at the file it came from: `Converger.as`, `Heading.as`, `Damage.as`, `Weapon.as`, `PlayerShip.as`, `BodyManager.as`, `Spawner.as`, `Game.as`. The remake is not a guess at how Astroflux worked. It is a port of how Astroflux actually worked, line of logic by line of logic.

The recovered assets came out the same way. The original packed its art into TexturePacker atlases: a big PNG plus an XML file describing where every sprite lives inside it. Those atlases survived, so the Godot `TextureManager` reads them directly rather than reimplementing the art:

```gdscript
var atlas_files := [
    "texture_main_NEW",
    "texture_body",
    "texture_gui1_test",
    "texture_gui2"
]
```

That first atlas alone contains 968 named subtextures, every ship, weapon, and effect frame from the original. The manager parses the XML, handles TexturePacker's quirk of rotating trimmed sprites 90 degrees, and hands back a Godot `AtlasTexture` on demand. Alongside the art sit the recovered sounds: 37 effects, 23 weapon sounds, 13 music tracks, 12 explosions. This is the game's real skin, not a redraw.

Then there is the game data. `data/hyperion.json` is a recovered solar-system definition straight out of the original backend, and it is beautiful in its density. Every entity is keyed by an opaque PlayerIO identifier like `HrAjOBivt0SHPYtxKyiB_Q`, references tables named `SolarSystems`, `Weapons`, and `Enemies`, and carries the full designer intent: PvP level caps, safe-zone radii, orbit speeds, shop inventories with prices, 15 enemy types, and 38 spawners. I did not invent Hyperion's economy. I read it back out of the file the live server used to send.

## The scene tree and the singletons

Godot's structure maps onto an MMO client cleanly if you lean on autoloads. The project registers nine of them as global singletons in `project.godot`, and they are the spine of the whole thing: `NetworkManager` and `LocalServer` for the wire, `ProjectileManager`, `BodyManager`, and `LootManager` for the world, `TextureManager`, `EffectManager`, and `SoundManager` for the recovered assets, and `GameConstants` holding the numbers.

That constants file is where the faithfulness becomes obvious. Instead of tuning physics by feel, I copied the original values out of `Game.as`:

```gdscript
## Milliseconds per physics tick (original: 33ms = ~30 FPS physics)
const TICK_LENGTH: int = 33
## Player ship friction coefficient (applied per tick)
const FRICTION: float = 0.009
```

The whole simulation runs on a 33 millisecond tick because that is what Astroflux ran on. Damage types, command types, and AI states are all ports of the original enums, down to oddities like a `PURE` damage type that ignores resistances and a resistance cap of exactly 0.75. Below the autoloads, the scene tree is ordinary Godot: a `game.tscn` root, ship scenes, projectile and enemy and loot scenes, world bodies like planets and suns and warp gates, and HUD scenes for the map and minimap. Data-driven definitions flow in from JSON, behavior lives in scenes, and the singletons wire them together.

## Server-authoritative, which is the whole point of an MMO

Here is the design decision that separates a real remake from a nice-looking clone. In an MMO, the client cannot be trusted. If your ship's position, your health, and your kills all live on the player's machine, then anyone with a memory editor is a god. So the server owns the truth, and the client only ever asks.

You can see the shape of this in how movement works. The client never tells the server "I am now at position X." It sends intent, a `command` message that says a key went down or came up, and the server integrates that into an authoritative course. The `LocalServer` autoload, a mock backend I use for offline development, spells out the contract explicitly:

```gdscript
func _handle_command(msg: Message) -> void:
    var cmd_type: int = msg.get_int(1)
    var active: bool = msg.get_boolean(2)
    player_heading.run_command(cmd_type, active)
    # Echo back updated course
    var response := Message.new("playerCourse")
    response.add(player_id)
    player_heading.populate_message(response)
    _send_response(response)
```

The client sends a keypress; the server decides what it means and echoes back the real state. That `LocalServer` is scaffolding, and its own comments say so: "This will be replaced by the real Go backend." The real backend already has a foothold in the reverse-engineering repo as an `auth-service` with a migrations directory, the beginning of a proper database-backed identity layer, because accounts and progression have to be server-owned too.

The catch with server authority is that waiting for the network makes movement feel like mud. Astroflux solved this the same way every good netcode does, with client-side prediction and reconciliation, and that logic lives in `Converger.gd`, ported straight from `Converger.as`. The client predicts its own motion locally every tick so the ship responds instantly, then, when the authoritative state arrives, it smoothly converges toward it instead of snapping:

```gdscript
# Smooth convergence
course.speed.x = _target.speed.x + converge_factor * dx
course.speed.y = _target.speed.y + converge_factor * dy
course.rotation += angle_diff * 0.05
```

Small errors get eased out over time with cubic interpolation. Large ones, past a `BLIP_OFFSET` of 30 units, snap outright, because pretending you are somewhere you are clearly not is worse than a jump. Enemy ships get their own error-smoothing path so other players' motion looks fluid even though it arrives as discrete server updates. On the wire, everything is the original PlayerIO binary format: positions scaled by 100 and rotations by 1000 to survive integer encoding, a protocol I reimplemented in `NetworkProtocol.gd` from a decompiled `playerio_client.py`.

## Why bother

Because a game is not just its idea. It is these exact numbers, this exact 33 millisecond tick, this specific convergence factor, these 968 sprites and their filenames. A clone gets the vibe. A reverse-engineered remake gets the game. Flash took Astroflux away, but Astroflux left behind everything needed to rebuild it, if you were willing to read it back out one decompiled class at a time. I was. The lights are coming back on.
