import detectIndent from 'detect-indent'
import type { JSZipObject } from 'jszip'
import JSZip from 'jszip'
import stripJsonComments from 'strip-json-comments'
import type { FixConfig, FixContext } from './Fix'
import { Fixes } from './fixes'
import type { VersionOrAuto } from './Version'
import { Version } from './Version'

/** Logical registry names used by fixes. Legacy plural names stay canonical here
 * so the existing migrations remain source compatible. Paths are selected per
 * Minecraft version when packs are read and written. */
export const categories = [
	'advancements',
	'banner_pattern',
	'cat_sound_variant',
	'cat_variant',
	'chat_type',
	'chicken_sound_variant',
	'chicken_variant',
	'cow_sound_variant',
	'cow_variant',
	'damage_type',
	'decorated_pot_pattern',
	'dialog',
	'dimension',
	'dimension_type',
	'enchantment',
	'enchantment_provider',
	'frog_variant',
	'instrument',
	'item_modifiers',
	'jukebox_song',
	'loot_tables',
	'number_provider',
	'painting_variant',
	'pig_sound_variant',
	'pig_variant',
	'predicates',
	'recipes',
	'slot_source',
	'tags/banner_pattern',
	'tags/biome',
	'tags/blocks',
	'tags/cat_variant',
	'tags/damage_type',
	'tags/dialog',
	'tags/enchantment',
	'tags/entity_types',
	'tags/fluids',
	'tags/functions',
	'tags/game_events',
	'tags/instrument',
	'tags/items',
	'tags/painting_variant',
	'tags/point_of_interest_type',
	'tags/potion',
	'tags/recipe',
	'tags/slot_source',
	'tags/structure',
	'tags/timeline',
	'tags/villager_trade',
	'tags/worldgen/biome',
	'tags/worldgen/configured_structure_feature',
	'tags/worldgen/flat_level_generator_preset',
	'tags/worldgen/placed_feature',
	'tags/worldgen/structure',
	'tags/worldgen/world_preset',
	'test_environment',
	'sulfur_cube_archetype',
	'test_instance',
	'timeline',
	'trade_set',
	'trim_material',
	'trim_pattern',
	'trial_spawner',
	'villager_trade',
	'wolf_sound_variant',
	'wolf_variant',
	'world_clock',
	'zombie_nautilus_variant',
	'worldgen/biome',
	'worldgen/carver',
	'worldgen/configured_carver',
	'worldgen/configured_feature',
	'worldgen/configured_structure_feature',
	'worldgen/configured_surface_builder',
	'worldgen/density_function',
	'worldgen/feature',
	'worldgen/flat_level_generator_preset',
	'worldgen/material_condition',
	'worldgen/material_rule',
	'worldgen/multi_noise_biome_source_parameter_list',
	'worldgen/noise_settings',
	'worldgen/noise',
	'worldgen/placed_feature',
	'worldgen/processor_list',
	'worldgen/structure',
	'worldgen/structure_set',
	'worldgen/template_pool',
	'worldgen/world_preset',
] as const

const ModernDirectories: Record<string, string> = {
	advancements: 'advancement',
	item_modifiers: 'item_modifier',
	loot_tables: 'loot_table',
	predicates: 'predicate',
	recipes: 'recipe',
	structures: 'structure',
	functions: 'function',
	'tags/blocks': 'tags/block',
	'tags/entity_types': 'tags/entity_type',
	'tags/fluids': 'tags/fluid',
	'tags/functions': 'tags/function',
	'tags/game_events': 'tags/game_event',
	'tags/items': 'tags/item',
}

const LegacyDirectories = Object.fromEntries(Object.entries(ModernDirectories).map(([legacy, modern]) => [modern, legacy]))

export type PackFile = {
	name: string,
	data: any,
	indent?: string,
	/** Original path relative to the data pack root. */
	path?: string,
	error?: string,
	deleted?: boolean,
}

export type PackStatus = 'loaded' | 'upgrading' | 'upgraded' | 'writing' | 'done' | 'error'

export type PackError = {
	message: string,
	files: string[],
}

export type Pack = {
	id: string,
	name: string,
	root: JSZip,
	status: PackStatus,
	meta: PackFile,
	target?: Version,
	data: {
		[category: string]: PackFile[],
	},
}

export namespace Pack {
	export async function fromZip(file: File): Promise<Pack[]> {
		const buffer = await file.arrayBuffer()
		const zip = await JSZip.loadAsync(buffer)

		const metaFiles = zip.filter(path => path.endsWith('pack.mcmeta') && !path.startsWith('__MACOSX/'))
		if (metaFiles.length === 0) {
			throw new Error('Cannot find any "pack.mcmeta" files.')
		}
		return Promise.all(metaFiles.map(metaFile => {
			const rootPath = metaFile.name.replace(/\/?pack.mcmeta$/, '')
			const name = rootPath.length === 0
				? file.name.replace(/\.zip$/, '')
				: rootPath.split('/').pop()!
			return loadPack(name, zip.folder(rootPath)!)
		}))
	}

	async function loadPack(name: string, root: JSZip): Promise<Pack> {
		const metaObject = root.file('pack.mcmeta')
		if (!metaObject) throw new Error('Cannot read "pack.mcmeta".')
		const pack: Pack = {
			id: hexId(),
			name,
			root,
			status: 'loaded',
			data: {},
			meta: {
				name: 'pack',
				path: 'pack.mcmeta',
				...await loadJson(metaObject),
			},
		}
		await Promise.all(categories.map(async category => {
			pack.data[category] = await loadCategory(root.folder('data')!, category)
		}))
		pack.data.functions = await loadFunctions(root.folder('data')!)
		return pack
	}

	function directoryAliases(category: string) {
		return [...new Set([category, ModernDirectories[category], LegacyDirectories[category]].filter((v): v is string => typeof v === 'string'))]
	}

	function targetDirectory(category: string, target: Version) {
		return Version.atLeast(target, '1.21') ? (ModernDirectories[category] ?? category) : (LegacyDirectories[category] ?? category)
	}

	async function loadCategory(root: JSZip, category: string): Promise<PackFile[]> {
		const aliases = directoryAliases(category).map(escapeRegExp).join('|')
		const matcher = new RegExp(`^([^/]+)/(${aliases})/(.*)\\.json$`)
		const files: { name: string, path: string, file: JSZipObject }[] = []
		root.forEach((path, file) => {
			const match = path.match(matcher)
			if (match?.[1] && match[3] && !file.dir) {
				files.push({ name: `${match[1]}:${match[3]}`, path: `data/${path}`, file })
			}
		})
		return Promise.all(files.map(async ({ name, path, file }) => {
			try {
				const parsed = await loadJson(file)
				return { name, path, ...parsed }
			} catch (e: any) {
				return { name, path, data: undefined, error: e.message }
			}
		}))
	}

	async function loadJson(file: JSZipObject) {
		let text = await loadText(file)
		const indent = detectIndent(text).indent
		try {
			text = text.replaceAll('\u200B', '').replaceAll('\u200C', '').replaceAll('\u200D', '').replaceAll('\uFEFF', '')
			text = text.split('\n').map(l => l.replace(/^([^"/]+)\/\/.*/, '$1')).join('\n')
			return { data: JSON.parse(stripJsonComments(text)), indent }
		} catch (e: any) {
			throw new Error(`Cannot parse file "${file.name}": ${e.message}.`)
		}
	}

	async function loadFunctions(root: JSZip): Promise<PackFile[]> {
		const matcher = /^([^/]+)\/(functions|function)\/(.*)\.mcfunction$/
		const files: { name: string, path: string, file: JSZipObject }[] = []
		root.forEach((path, file) => {
			const match = path.match(matcher)
			if (match?.[1] && match[3] && !file.dir) {
				files.push({ name: `${match[1]}:${match[3]}`, path: `data/${path}`, file })
			}
		})
		return Promise.all(files.map(async ({ name, path, file }) => ({
			name,
			path,
			data: (await loadText(file)).split('\n'),
		})))
	}

	async function loadText(file: JSZipObject) {
		return await file.async('text')
	}

	export async function toZip(pack: Pack) {
		if (pack.status !== 'upgraded') {
			throw new Error(`Cannot download pack with status ${pack.status}.`)
		}
		if (!pack.target) throw new Error('Cannot determine the target version.')
		categories.forEach(category => {
			writeCategory(pack, category, pack.data[category] ?? [])
		})
		writeFunctions(pack, pack.data.functions ?? [])
		writeJson(pack.root, 'pack.mcmeta', pack.meta.data, pack.meta.indent)
		const blob = await pack.root.generateAsync({ type: 'blob', compression: 'DEFLATE' })
		const url = URL.createObjectURL(blob)
		pack.status = 'done'
		return url
	}

	function writeCategory(pack: Pack, category: string, data: PackFile[]) {
		const root = pack.root.folder('data')!
		const directory = targetDirectory(category, pack.target!)
		data.forEach(({ name, data, indent, path: originalPath, error, deleted }) => {
			const separator = name.indexOf(':')
			const namespace = separator === -1 ? 'minecraft' : name.slice(0, separator)
			const id = separator === -1 ? name : name.slice(separator + 1)
			const path = `${namespace}/${directory}/${id}.json`
			if (originalPath && originalPath !== `data/${path}`) pack.root.remove(originalPath)
			if (deleted) {
				root.remove(path)
			} else if (!error) {
				writeJson(root, path, data, indent)
			}
		})
	}

	function writeFunctions(pack: Pack, functions: PackFile[]) {
		const root = pack.root.folder('data')!
		const directory = targetDirectory('functions', pack.target!)
		functions.forEach(({ name, data, path: originalPath, error, deleted }) => {
			const separator = name.indexOf(':')
			const namespace = separator === -1 ? 'minecraft' : name.slice(0, separator)
			const id = separator === -1 ? name : name.slice(separator + 1)
			const path = `${namespace}/${directory}/${id}.mcfunction`
			if (originalPath && originalPath !== `data/${path}`) pack.root.remove(originalPath)
			if (deleted) {
				root.remove(path)
			} else if (!error) {
				writeText(root, path, data.join('\n'))
			}
		})
	}

	function writeJson(zip: JSZip, path: string, data: any, indent?: string) {
		const text = JSON.stringify(data, null, indent || '\t') + '\n'
		writeText(zip, path, text)
	}

	function writeText(zip: JSZip, path: string, data: any) {
		zip.file(path, data)
	}

	/** Move every legacy registry directory, including binary structures and
	 * registries unknown to this version of the upgrader. */
	export async function useModernDirectories(pack: Pack, ctx: FixContext) {
		const files: { path: string, target: string, file: JSZipObject }[] = []
		pack.root.folder('data')!.forEach((path, file) => {
			if (file.dir) return
			const parts = path.split('/')
			if (parts.length < 3) return
			const category = parts[1] === 'tags' && parts.length >= 4 ? `tags/${parts[2]}` : parts[1]
			const modern = ModernDirectories[category]
			if (!modern) return
			const consumed = category.startsWith('tags/') ? 3 : 2
			const target = [...parts.slice(0, category.startsWith('tags/') ? 1 : 1), ...modern.split('/'), ...parts.slice(consumed)].join('/')
			files.push({ path, target, file })
		})

		for (const { path, target, file } of files) {
			const root = pack.root.folder('data')!
			const conflict = root.file(target) !== null
			if (conflict) {
				ctx.warn(`Both legacy and modern data pack paths exist; kept ${target} and removed ${path}.`)
			} else {
				root.file(target, await file.async('uint8array'), {
					date: file.date,
					comment: file.comment,
					unixPermissions: file.unixPermissions,
					dosPermissions: file.dosPermissions,
				})
			}
			root.remove(path)
			const oldFullPath = `data/${path}`
			const newFullPath = `data/${target}`
			Object.values(pack.data).flat().forEach(packFile => {
				if (packFile.path !== oldFullPath) return
				if (conflict) packFile.deleted = true
				else packFile.path = newFullPath
			})
		}
	}

	export async function upgrade(pack: Pack, config: UpgradeConfig) {
		if (pack.status !== 'loaded') {
			throw new Error(`Cannot upgrade pack with status '${pack.status}'.`)
		}

		const detectedFormat = Version.readPackFormat(pack.meta.data.pack)
		if (!detectedFormat) throw new Error('Cannot find a valid pack format in pack.mcmeta.')
		let source: Version
		if (config.source === 'auto') {
			const detectedVersion = Version.autoDetect(detectedFormat)
			if (detectedVersion === undefined) {
				source = Version.autoDetectOrFallback(detectedFormat)
				config.onWarning(`No matching version found for pack format ${Version.formatName(detectedFormat)}, using fallback ${source}`)
			} else {
				source = detectedVersion
			}
		} else {
			if (!Version.samePackFormat(detectedFormat, Version.packFormat(config.source))) {
				throw new Error(`Found pack format ${Version.formatName(detectedFormat)}, which does not match version ${config.source}`)
			}
			source = config.source
		}
		const target = config.target
		if (Version.order(target, source)) {
			throw new Error(`Invalid version range: ${source} > ${target}`)
		}
		pack.target = target

		const ctx: FixContext = {
			warn: config.onWarning,
			prompt: config.onPrompt,
			source: () => source,
			target: () => target,
			config: (key: keyof FixConfig) => config.features[key],
			read: (category: string, name: string) => {
				return pack.data[category]?.find(f =>
					f.error === undefined &&
					f.name.replace(/^minecraft:/, '') === name.replace(/^minecraft:/, ''))
			},
			create: (category: string, name: string, data: any) => {
				(pack.data[category] ??= []).push({
					name,
					indent: pack.meta.indent,
					data,
				})
			},
		}

		await Fixes(pack, ctx)
		pack.status = 'upgraded'
	}
}

type UpgradeConfig = {
	features: FixConfig,
	source: VersionOrAuto,
	target: Version,
	onPrompt: FixContext['prompt'],
	onWarning: (message: string, files?: string[]) => unknown,
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const dec2hex = (dec: number) => ('0' + dec.toString(16)).slice(-2)

export function hexId(length = 12) {
	const arr = new Uint8Array(length / 2)
	window.crypto.getRandomValues(arr)
	return Array.from(arr, dec2hex).join('')
}

export function MockPack(): Pack {
	const id = hexId()
	return {
		id,
		name: `Pack${id}`,
		root: new JSZip(),
		status: 'loaded',
		meta: {
			name: 'pack.mcmeta',
			data: { pack: { pack_format: 8, description: '' } },
		},
		data: Object.fromEntries([...categories, 'functions'].map(category => [category, []])),
	}
}
