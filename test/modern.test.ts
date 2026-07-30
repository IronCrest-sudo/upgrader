import JSZip from 'jszip'
import { describe, expect, test } from 'vitest'
import { Pack } from '../src/Pack'
import { Version } from '../src/Version'
import { createUpgrader } from './util'

describe('modern version metadata', () => {
	test('reads and writes minor pack formats', () => {
		expect(Version.readPackFormat({ max_format: [94, 1] })).toEqual([94, 1])
		const pack: Record<string, unknown> = { pack_format: 81, supported_formats: [80, 81] }
		Version.writePackFormat(pack, [113, 0])
		expect(pack).toEqual({ min_format: [113, 0], max_format: [113, 0] })
		expect(Version.autoDetect([101, 1])).toBe('26.1.2')
		expect(Version.autoDetect([10, 0])).toBe('1.19')
	})

	test('loads functions using paths relative to the data directory', async () => {
		const zip = new JSZip()
		zip.file('pack.mcmeta', JSON.stringify({ pack: { pack_format: 41, description: 'test' } }))
		zip.file('data/test/functions/load.mcfunction', 'say loaded')
		const buffer = await zip.generateAsync({ type: 'arraybuffer' })
		;(globalThis as any).window ??= { crypto: globalThis.crypto }
		const file = { name: 'test.zip', arrayBuffer: async () => buffer } as File
		const [pack] = await Pack.fromZip(file)
		expect(pack.data.functions).toMatchObject([{
			name: 'test:load',
			path: 'data/test/functions/load.mcfunction',
			data: ['say loaded'],
		}])
	})

	test('moves legacy registry directories without changing the pack type', async () => {
		const root = new JSZip()
		root.file('data/test/functions/load.mcfunction', 'say loaded')
		root.file('data/test/structures/example.nbt', new Uint8Array([1, 2, 3]))
		const pack: any = {
			root,
			data: {
				functions: [{ name: 'test:load', path: 'data/test/functions/load.mcfunction', data: ['say loaded'] }],
			},
		}
		await Pack.useModernDirectories(pack, { warn: () => {} } as any)
		expect(root.file('data/test/function/load.mcfunction')).not.toBeNull()
		expect(root.file('data/test/structure/example.nbt')).not.toBeNull()
		expect(root.file('data/test/functions/load.mcfunction')).toBeNull()
		expect(pack.data.functions[0].path).toBe('data/test/function/load.mcfunction')
	})
})

describe('1.20.5 and 1.21 migrations', () => {
	test('converts legacy item NBT in functions', async () => {
		const result = await createUpgrader('1.20.4', '1.20.6')({
			functions: {
				'test:items': ['give @s minecraft:diamond_sword{Damage:5,Enchantments:[{id:"minecraft:sharpness",lvl:2s}]}'],
			},
		})
		const command = result.functions['test:items'] as string[]
		expect(command[0]).toContain('minecraft:damage=5')
		expect(command[0]).toContain('minecraft:enchantments={levels:')
		expect(command[0]).not.toContain('diamond_sword{Damage')
	})

	test('converts 1.21 loot conditions and attribute commands', async () => {
		const result = await createUpgrader('1.20.6', '1.21')({
			loot_tables: {
				'test:loot': {
					pools: [{ rolls: 1, conditions: [{ condition: 'minecraft:random_chance_with_looting', chance: 0.1, looting_multiplier: 0.05 }] }],
				},
			},
			functions: {
				'test:attribute': ['attribute @s minecraft:generic.attack_damage modifier add 123e4567-e89b-12d3-a456-426614174000 boost 1 addition'],
			},
		})
		const loot: any = result.loot_tables['test:loot']
		expect(loot.pools[0].conditions[0]).toMatchObject({
			condition: 'minecraft:random_chance_with_enchanted_bonus',
			enchantment: 'minecraft:looting',
			unenchanted_chance: 0.1,
		})
		expect((result.functions['test:attribute'] as string[])[0]).toContain('upgrader:123e4567-e89b-12d3-a456-426614174000 1 addition')
	})

	test('simplifies recipe ingredients and attribute IDs for 1.21.2', async () => {
		const result = await createUpgrader('1.21.1', '1.21.2')({
			recipes: {
				'test:recipe': { type: 'minecraft:crafting_shapeless', ingredients: [{ item: 'minecraft:stone' }, { tag: 'minecraft:planks' }], result: { id: 'minecraft:stick' } },
			},
			functions: { 'test:attribute': ['attribute @s minecraft:generic.attack_damage base set 2'] },
		})
		expect((result.recipes['test:recipe'] as any).ingredients).toEqual(['minecraft:stone', '#minecraft:planks'])
		expect((result.functions['test:attribute'] as string[])[0]).toContain('minecraft:attack_damage')
	})
})

describe('1.21.4 through 1.21.11', () => {
	test('updates custom model data', async () => {
		const result = await createUpgrader('1.21.3', '1.21.4')({
			item_modifiers: { 'test:model': { function: 'minecraft:set_custom_model_data', value: 7 } },
			functions: { 'test:model': ['give @s stone[custom_model_data=7]'] },
		})
		expect(result.item_modifiers['test:model']).toMatchObject({ floats: { values: [7], mode: 'replace_all' } })
		expect((result.functions['test:model'] as string[])[0]).toContain('custom_model_data={floats:[7]}')
	})

	test('migrates tooltip and advancement formats', async () => {
		const result = await createUpgrader('1.21.4', '1.21.5')({
			loot_tables: {
				'test:components': {
					components: {
						'minecraft:enchantments': { levels: { 'minecraft:sharpness': 1 }, show_in_tooltip: false },
					},
				},
			},
			advancements: { 'test:root': { display: { background: 'textures/gui/advancements/backgrounds/stone.png' } } },
		})
		const components = (result.loot_tables['test:components'] as any).components
		expect(components['minecraft:enchantments']).toEqual({ 'minecraft:sharpness': 1 })
		expect(components['minecraft:tooltip_display'].hidden_components).toContain('minecraft:enchantments')
		expect((result.advancements['test:root'] as any).display.background).toBe('gui/advancements/backgrounds/stone')
	})

	test('migrates biome environment attributes and gamerules', async () => {
		const result = await createUpgrader('1.21.10', '1.21.11')({
			'worldgen/biome': {
				'test:biome': { effects: { fog_color: 12638463, water_color: 4159204, music: { sound: 'test:music', min_delay: 1, max_delay: 2 } } },
			},
			functions: { 'test:rules': ['gamerule doDaylightCycle false', 'worldborder set 100 5'] },
		})
		const biome: any = result['worldgen/biome']['test:biome']
		expect(biome.attributes['minecraft:visual/fog_color']).toBe('#c0d8ff')
		expect(biome.effects.fog_color).toBeUndefined()
		expect(result.functions['test:rules']).toEqual(['gamerule minecraft:advance_time false', 'worldborder set 100 5s'])
	})
})

describe('26.x migrations', () => {
	test('updates 26.1 feature and tag names', async () => {
		const result = await createUpgrader('1.21.11', '26.1')({
			'worldgen/configured_feature': {
				'test:rock': { type: 'minecraft:forest_rock' },
			},
			functions: { 'test:tags': ['execute if block ~ ~ ~ #minecraft:bamboo_plantable_on run say ok'] },
		})
		expect((result['worldgen/configured_feature']['test:rock'] as any).type).toBe('minecraft:block_blob')
		expect((result.functions['test:tags'] as string[])[0]).toContain('#minecraft:supports_bamboo')
	})

	test('updates 26.2 entity predicates', async () => {
		const result = await createUpgrader('26.1.2', '26.2')({
			predicates: {
				'test:player': {
					condition: 'minecraft:entity_properties', entity: 'this', predicate: {
						type: 'minecraft:player',
						type_specific: { type: 'minecraft:player', looking_at: { type: 'minecraft:ender_dragon' } },
					},
				},
			},
		})
		const predicate: any = result.predicates['test:player']
		expect(predicate.predicate['minecraft:entity_type']).toBe('minecraft:player')
		expect(predicate.predicate['minecraft:type_specific/player'].looking_at['minecraft:entity_type']).toBe('minecraft:ender_dragon')
	})

	test('moves configured features and converts 26.3 loot syntax', async () => {
		const result = await createUpgrader('26.2', '26.3-snapshot-4')({
			'worldgen/configured_feature': {
				'test:feature': { type: 'minecraft:simple_block', config: { to_place: { type: 'minecraft:simple_state_provider', state: { Name: 'minecraft:stone' } } } },
			},
			loot_tables: {
				'test:loot': {
					pools: [{ rolls: 1, conditions: [{ condition: 'minecraft:random_chance', chance: 0.5 }], entries: [{ type: 'minecraft:item', name: 'minecraft:stone', functions: [{ function: 'minecraft:set_count', count: 2 }] }] }],
				},
			},
		})
		expect(result['worldgen/configured_feature']['test:feature']).toBeUndefined()
		expect(result['worldgen/feature']['test:feature']).toMatchObject({ type: 'minecraft:simple_block', to_place: { type: 'minecraft:simple_state_provider' } })
		const pool: any = (result.loot_tables['test:loot'] as any).pools[0]
		expect(pool.condition.type).toBe('minecraft:all_of')
		expect(pool.condition.terms[0].type).toBe('minecraft:random_chance')
		expect(pool.entries[0].modifier[0].type).toBe('minecraft:set_count')
	})

	test('updates Snapshot 6 noise format', async () => {
		const result = await createUpgrader('26.3-snapshot-5', '26.3-snapshot-6')({
			'worldgen/noise': { 'test:noise': { firstOctave: -3, amplitudes: [1, 0.5] } },
			'worldgen/density_function': { 'test:gradient': { type: 'minecraft:y_clamped_gradient', from_y: 0, to_y: 10, from_value: 0, to_value: 1 } },
		})
		expect(result['worldgen/noise']['test:noise']).toEqual({ base_octave: -3, octave_count: 2, amplitude_modifiers: [1, 0.5], normalize: 'legacy', base_amplitude: 1 })
		expect(result['worldgen/density_function']['test:gradient']).toMatchObject({ type: 'minecraft:gradient', axis: 'y', tiling: 'clamp_to_edge' })
	})
})
