[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/kiroroai/neon-bayou/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/kiroroai/neon-bayou/reward.svg)](https://make.fun/bounty/gta6-01)

# Neon Bayou — a Cypress Bay crime story

A complete open-world crime game in the spirit of GTA 6, built for the
[make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01). You are Rook, a
getaway driver in Cypress Bay, a neon-drowned city cut by a bayou channel
and a southern lagoon. Steal cars, run six linked story missions for Delia
and Big Marv, outrun the CBPD, and mind the Gator Kings.

## How to play

Open `game/index.html` in a desktop browser (or serve `game/` and visit it).

- **WASD / arrows** — walk and drive (W accelerate, S brake/reverse, A/D steer, Shift sprint)
- **E** — steal the nearest car / step out of your car
- **Space** — shoot (on foot, aim with the mouse) / handbrake while driving
- **P / Esc** — pause, **M** — mute, **Enter** — start / continue

## What is in the game

- **A city that lives**: 3,200 × 2,400 world, six districts (Cypress Heights, Neon Row, The Docks, Old Town, Gator Flats, Cypress Bayou), 9 avenues and 7 streets, a bayou channel with bridges, a lagoon, docks piers, a park, 60+ neon-signed buildings, billboards, lamps and trees — all deterministic from one seed.
- **Driving**: five car types with distinct handling (Comet, Sunset GT, Bayou Hauler, Gator, CBPD Cruiser), traffic AI that follows the road grid, parked cars to steal, skids, smoke and crash damage. A wrecked car throws you out on foot.
- **The heat**: a 0–5 star wanted system. Cruisers pursue and ram; foot cops spawn at 2+ stars and bust you on contact. Stars fade after a quiet stretch — or you can lose them by escaping.
- **Six linked missions**: First Light, The Getaway, Swamp Run, Heat Wave, Gator Bite and The Big Score — with cash payouts, a minimap, an objective arrow and a save that lets you continue the story.
- **Combat**: the Gator Kings gang closes in and shoots back; pedestrians flee gunfire.
- **Presentation**: dusk synthwave look, WebAudio synth soundtrack and sound effects, HUD with wanted stars, health, cash and speed, title / pause / busted screens.

## Screenshots

Staged with `?stage=chase`, `?stage=drive`, `?stage=foot` and `?stage=bayou`
(see `screenshots/`). The cover is the chase: Rook in a stolen Comet with
three CBPD cruisers closing in on Neon Row.

## Tech

Pure browser JavaScript (ES modules, no dependencies, no build step) with a
TypeScript entry program (`main.ts`, Node 22, standard library only) that
copies the game and screenshots into the output directory and writes
`/output/dossier.json` via the kit's `buildDossier`. The game is organised
as one module per system (`config`, `rng`, `input`, `audio`, `world`,
`player`, `vehicles`, `pedestrians`, `police`, `missions`, `combat`,
`effects`, `save`, `hud`, `render`, `main`), sharing a single state object.
