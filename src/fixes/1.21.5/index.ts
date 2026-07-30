import { Fix } from '../../Fix'
import { functionFix, idPath, isObject, jsonFix, renameKey, replaceJsonStrings, walkJson } from '../Helpers'

const TooltipComponents: Record<string, string | undefined> = {
	attribute_modifiers: 'modifiers',
	dyed_color: 'rgb',
	can_place_on: 'predicates',
	can_break: 'predicates',
	enchantments: 'levels',
	stored_enchantments: 'levels',
	jukebox_playable: 'song',
	unbreakable: undefined,
}

function fixTextComponent(value: any) {
	if (!isObject(value)) return
	if (isObject(value.hoverEvent)) {
		const event = value.hoverEvent
		const action = idPath(event.action)
		if (action === 'show_text') renameKey(event, 'contents', 'value')
		if (action === 'show_item') {
			if (typeof event.contents === 'string') event.id = event.contents
			else if (isObject(event.contents)) Object.assign(event, event.contents)
			delete event.contents
		}
		if (action === 'show_entity' && isObject(event.contents)) {
			const contents = event.contents
			if (contents.id !== undefined) event.uuid = contents.id
			if (contents.type !== undefined) event.id = contents.type
			if (contents.name !== undefined) event.name = contents.name
			delete event.contents
		}
		if (event.value !== undefined && action !== 'show_text') {
			event.contents ??= event.value
			delete event.value
		}
		value.hover_event = event
		delete value.hoverEvent
	}
	if (isObject(value.clickEvent)) {
		const event = value.clickEvent
		const action = idPath(event.action)
		if (action === 'open_url') renameKey(event, 'value', 'url')
		if (action === 'run_command' || action === 'suggest_command') renameKey(event, 'value', 'command')
		if (action === 'change_page' && event.value !== undefined) {
			event.page = Math.max(1, Number.parseInt(event.value, 10) || 1)
			delete event.value
		}
		value.click_event = event
		delete value.clickEvent
	}
}

function fixComponentMap(map: any, warn: (message: string) => unknown) {
	if (!isObject(map)) return
	const hidden: string[] = []
	let hideTooltip = false
	for (const key of Object.keys(map)) {
		const path = key.replace(/^minecraft:/, '')
		if (path === 'hide_tooltip') {
			hideTooltip = true
			delete map[key]
			continue
		}
		if (path === 'hide_additional_tooltip') {
			delete map[key]
			warn('hide_additional_tooltip has no exact automatic equivalent. Verify tooltip_display.hidden_components.')
			continue
		}
		const component = map[key]
		if (isObject(component) && component.show_in_tooltip === false) hidden.push(`minecraft:${path}`)
		if (isObject(component) && 'show_in_tooltip' in component) delete component.show_in_tooltip
		if (path in TooltipComponents && isObject(component)) {
			const inline = TooltipComponents[path]
			if (inline !== undefined && component[inline] !== undefined) map[key] = component[inline]
			else if (inline === undefined) map[key] = {}
		}
	}
	if (hideTooltip || hidden.length > 0) {
		const tooltipKey = Object.keys(map).some(key => key.startsWith('minecraft:')) ? 'minecraft:tooltip_display' : 'tooltip_display'
		const tooltip = isObject(map[tooltipKey]) ? map[tooltipKey] : {}
		if (hideTooltip) tooltip.hide_tooltip = true
		if (hidden.length > 0) tooltip.hidden_components = [...new Set([...(tooltip.hidden_components ?? []), ...hidden])]
		map[tooltipKey] = tooltip
	}
}

function variantSpawnConditions(data: any) {
	if (!isObject(data) || data.spawn_conditions !== undefined) return
	const biomes = data.biomes ?? data.biome
	if (biomes === undefined) return
	data.spawn_conditions = [{ priority: 0, condition: { type: 'minecraft:biome', biomes } }]
	delete data.biome
	delete data.biomes
}

const Json = jsonFix(({ data }, category, ctx) => {
	walkJson(data, value => {
		if (!isObject(value)) return
		fixTextComponent(value)
		fixComponentMap(value.components, ctx.warn)
		// Component patches are also commonly stored directly in this object.
		if (Object.keys(value).some(key => key.replace(/^minecraft:/, '') in TooltipComponents || /hide_(?:additional_)?tooltip$/.test(key))) fixComponentMap(value, ctx.warn)

		for (const [key, component] of Object.entries(value)) {
			const path = key.replace(/^minecraft:/, '')
			if (path === 'weapon' && isObject(component)) {
				renameKey(component, 'damage_per_attack', 'item_damage_per_attack')
				renameKey(component, 'can_disable_blocking', 'disable_blocking_for_seconds')
			}
		}
	})

	if (category === 'advancements' && isObject(data.display) && typeof data.display.background === 'string') {
		data.display.background = data.display.background.replace(/^textures\//, '').replace(/\.png$/, '')
	}
	if (['cat_variant', 'chicken_variant', 'cow_variant', 'frog_variant', 'pig_variant', 'wolf_variant'].includes(category)) variantSpawnConditions(data)
	if (category === 'wolf_variant' && isObject(data)) {
		if (data.assets === undefined && (data.wild_texture || data.tame_texture || data.angry_texture)) {
			data.assets = { wild: data.wild_texture, tame: data.tame_texture, angry: data.angry_texture }
		}
		delete data.wild_texture
		delete data.tame_texture
		delete data.angry_texture
	}
	if (category === 'pig_variant' && isObject(data)) renameKey(data, 'texture', 'asset_id')
	if (category === 'recipes' && ['crafting_transmute', 'smithing_trim'].includes(idPath(data.type) ?? '')) {
		const required = idPath(data.type) === 'crafting_transmute' ? ['base'] : ['base', 'template', 'addition']
		if (required.some(key => data[key] === undefined)) ctx.warn(`Recipe now requires ${required.join(', ')}; missing values could not be inferred.`)
	}

	replaceJsonStrings(data, value => value === '#minecraft:dead_bush_may_place_on' ? '#minecraft:dry_vegetation_may_place_on' : value)
})

const Functions = functionFix((line, _file, ctx) => {
	let result = line
		.replace(/\bhorse\.saddle\b/g, 'saddle')
		.replace(/\bFallDistance\s*:/g, 'fall_distance:')
		.replace(/#minecraft:dead_bush_may_place_on\b/g, '#minecraft:dry_vegetation_may_place_on')
	// JSON is valid SNBT. Remove the legacy string wrapper around common text components.
	result = result.replace(/\b(custom_name|item_name)='(\{[^'\n]*\})'/g, (_match, key, json) => `${key}=${json.replaceAll('\\\'', "'")}`)
	if (/\b(?:ArmorItems|HandItems|body_armor_item|SpawnX|SpawnY|SpawnZ|SpawnDimension|SpawnAngle)\s*:/.test(result)) {
		ctx.warn('Legacy entity equipment or respawn NBT needs a structural 1.21.5 conversion; verify this command manually.')
	}
	return result
})

export const Fixes215 = Fix.version('1.21.4', '1.21.5', Fix.groupProblems(
	Fix.packFormat(71),
	Json,
	Fix.when('functions', Functions),
))
