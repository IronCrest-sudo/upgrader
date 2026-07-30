import { Fix } from '../../Fix'
import { functionFix, idPath, isObject, jsonFix, replaceJsonStrings, walkJson } from '../Helpers'

const GameRuleRenames: Record<string, string> = {
	announceAdvancements: 'show_advancement_messages',
	commandBlocksEnabled: 'command_blocks_work',
	command_modification_block_limit: 'max_block_modifications',
	disableElytraMovementCheck: 'elytra_movement_check',
	disablePlayerMovementCheck: 'player_movement_check',
	disableRaids: 'raids',
	doDaylightCycle: 'advance_time',
	doEntityDrops: 'entity_drops',
	doImmediateRespawn: 'immediate_respawn',
	doInsomnia: 'spawn_phantoms',
	doLimitedCrafting: 'limited_crafting',
	doMobLoot: 'mob_drops',
	doMobSpawning: 'spawn_mobs',
	doPatrolSpawning: 'spawn_patrols',
	doTileDrops: 'block_drops',
	doTraderSpawning: 'spawn_wandering_traders',
	doVinesSpread: 'spread_vines',
	doWardenSpawning: 'spawn_wardens',
	doWeatherCycle: 'advance_weather',
	maxCommandChainLength: 'max_command_sequence_length',
	maxCommandForkCount: 'max_command_forks',
	naturalRegeneration: 'natural_health_regeneration',
	snowAccumulationHeight: 'max_snow_accumulation_height',
	spawnRadius: 'respawn_radius',
	spawnerBlocksEnabled: 'spawner_blocks_work',
}
const InvertedRules = new Set(['disableElytraMovementCheck', 'disablePlayerMovementCheck', 'disableRaids'])

function snakeCase(value: string) {
	return value.replace(/^minecraft:/, '').replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
}

function color(value: any) {
	if (typeof value !== 'number') return value
	return `#${Math.max(0, value).toString(16).padStart(6, '0').slice(-6)}`
}

function migrateBiome(data: any) {
	if (!isObject(data)) return
	const effects = isObject(data.effects) ? data.effects : undefined
	const attributes = data.attributes ??= {}
	if (effects) {
		const simple: Record<string, string> = {
			fog_color: 'minecraft:visual/fog_color',
			water_fog_color: 'minecraft:visual/water_fog_color',
			sky_color: 'minecraft:visual/sky_color',
			music_volume: 'minecraft:audio/music_volume',
		}
		for (const [field, attribute] of Object.entries(simple)) {
			if (effects[field] !== undefined) {
				attributes[attribute] = field.endsWith('_color') ? color(effects[field]) : effects[field]
				delete effects[field]
			}
		}
		if (effects.particle !== undefined) {
			attributes['minecraft:visual/ambient_particles'] = [effects.particle]
			delete effects.particle
		}
		if (effects.music !== undefined) {
			attributes['minecraft:audio/background_music'] = { default: effects.music }
			delete effects.music
		}
		const sounds: any = {}
		if (effects.ambient_sound !== undefined) sounds.loop = effects.ambient_sound
		if (effects.mood_sound !== undefined) sounds.mood = effects.mood_sound
		if (effects.additions_sound !== undefined) sounds.additions = effects.additions_sound
		if (Object.keys(sounds).length > 0) attributes['minecraft:audio/ambient_sounds'] = sounds
		delete effects.ambient_sound
		delete effects.mood_sound
		delete effects.additions_sound
		for (const key of ['water_color', 'foliage_color', 'dry_foliage_color', 'grass_color']) {
			if (effects[key] !== undefined) effects[key] = color(effects[key])
		}
	}
}

function migrateDimension(data: any, warn: (message: string) => unknown) {
	if (!isObject(data)) return
	const attributes = data.attributes ??= {}
	if (data.ultrawarm !== undefined) {
		attributes['minecraft:gameplay/water_evaporates'] = data.ultrawarm
		attributes['minecraft:gameplay/fast_lava'] = data.ultrawarm
		if (data.ultrawarm) attributes['minecraft:visual/default_dripstone_particle'] = { type: 'minecraft:dripping_dripstone_lava' }
		delete data.ultrawarm
	}
	if (data.bed_works !== undefined) {
		attributes['minecraft:gameplay/bed_rule'] = data.bed_works
			? { can_sleep: 'when_dark', can_set_spawn: 'always', error_message: { translate: 'block.minecraft.bed.no_sleep' } }
			: { can_sleep: 'never', can_set_spawn: 'never', explodes: true }
		delete data.bed_works
	}
	if (data.respawn_anchor_works !== undefined) {
		attributes['minecraft:gameplay/respawn_anchor_works'] = data.respawn_anchor_works
		delete data.respawn_anchor_works
	}
	if (data.cloud_height !== undefined) {
		attributes['minecraft:visual/cloud_height'] = data.cloud_height
		delete data.cloud_height
	}
	if (data.piglin_safe !== undefined) {
		attributes['minecraft:gameplay/piglins_zombify'] = !data.piglin_safe
		delete data.piglin_safe
	}
	if (data.has_raids !== undefined) {
		attributes['minecraft:gameplay/can_start_raid'] = data.has_raids
		delete data.has_raids
	}
	if (data.natural !== undefined) {
		attributes['minecraft:gameplay/nether_portal_spawns_piglin'] = data.natural
		delete data.natural
	}
	if (typeof data.effects === 'string') {
		const effect = idPath(data.effects)
		if (effect === 'the_nether') {
			data.skybox = 'none'
			data.cardinal_light = 'nether'
		} else if (effect === 'the_end') {
			data.skybox = 'end'
			data.cardinal_light = 'default'
		} else {
			data.skybox = 'overworld'
			data.cardinal_light = 'default'
		}
		delete data.effects
	}
	if (data.fixed_time !== undefined) {
		data.has_fixed_time = true
		delete data.fixed_time
		warn('fixed_time moved to timelines/environment attributes. has_fixed_time was set, but the exact celestial time needs manual migration.')
	}
}

function migrateGameTest(data: any) {
	if (!isObject(data) || (data.bool_rule === undefined && data.int_rule === undefined)) return
	const rules: Record<string, unknown> = data.rules ??= {}
	for (const source of [data.bool_rule, data.int_rule]) {
		if (!isObject(source)) continue
		for (const [key, value] of Object.entries(source)) rules[`minecraft:${GameRuleRenames[key] ?? snakeCase(key)}`] = value
	}
	delete data.bool_rule
	delete data.int_rule
}

const Json = jsonFix(({ data }, category, ctx) => {
	if (category === 'worldgen/biome') migrateBiome(data)
	if (category === 'dimension_type') migrateDimension(data, ctx.warn)
	if (category === 'test_environment') migrateGameTest(data)

	replaceJsonStrings(data, value => value === '#minecraft:enchantable/sword' ? '#minecraft:enchantable/sweeping' : value)
	walkJson(data, value => {
		if (!isObject(value)) return
		for (const [key, component] of Object.entries(value)) {
			const path = key.replace(/^minecraft:/, '')
			if ((path === 'piercing_weapon' || path === 'kinetic_weapon') && isObject(component)) {
				const attackRange: any = value['minecraft:attack_range'] ?? value.attack_range ?? {}
				for (const field of ['min_reach', 'max_reach', 'hitbox_margin']) {
					if (component[field] !== undefined) {
						attackRange[field] = component[field]
						delete component[field]
					}
				}
				if (Object.keys(attackRange).length > 0) value[key.startsWith('minecraft:') ? 'minecraft:attack_range' : 'attack_range'] = attackRange
			}
			if (path === 'consumable' && isObject(component) && component.animation === 'spear') component.animation = 'trident'
		}
		if (idPath(value.function) === 'filtered' && value.modifier !== undefined) {
			value.on_pass = value.modifier
			delete value.modifier
		}
		if (idPath(value.type) === 'dynamic' && value.name === 'contents') {
			value.type = 'minecraft:slots'
			value.slot_source = { type: 'minecraft:slot_range', slots: 'container.*' }
			delete value.name
		}
	})
})

function convertGameRule(line: string, warn: (message: string) => unknown) {
	return line.replace(/(\bgamerule\s+)([A-Za-z0-9_.:-]+)(?:\s+(true|false|-?\d+))?/g, (_match, prefix, rawRule, rawValue) => {
		const rule = rawRule.replace(/^minecraft:/, '')
		if (rule === 'doFireTick' || rule === 'allowFireTicksAwayFromPlayer') {
			warn(`${rule} was merged into minecraft:fire_spread_radius_around_player; verify the chosen value.`)
			const value = rawValue === 'false' ? '0' : '-1'
			return `${prefix}minecraft:fire_spread_radius_around_player ${value}`
		}
		const renamed = GameRuleRenames[rule] ?? snakeCase(rule)
		let value = rawValue
		if (value !== undefined && InvertedRules.has(rule) && (value === 'true' || value === 'false')) value = value === 'true' ? 'false' : 'true'
		return `${prefix}minecraft:${renamed}${value === undefined ? '' : ` ${value}`}`
	})
}

const Functions = functionFix((line, _file, ctx) => {
	let result = convertGameRule(line, ctx.warn)
	result = result
		.replace(/#minecraft:enchantable\/sword\b/g, '#minecraft:enchantable/sweeping')
		.replace(/\bAngryAt\s*:/g, 'angry_at:')
	result = result.replace(/(\bworldborder\s+(?:set|add)\s+\S+\s+)(\d+(?:\.\d+)?)(?![a-z])/g, '$1$2s')
	return result
})

export const Fixes2111 = Fix.version('1.21.10', '1.21.11', Fix.groupProblems(
	Fix.packFormat([94, 1]),
	Json,
	Fix.when('functions', Functions),
))
