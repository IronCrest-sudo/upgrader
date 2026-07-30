import { Fix } from '../../Fix'

// 1.21.7 only adds data-driven content. The format bump is still important so
// packs can explicitly target 1.21.7 and 1.21.8.
export const Fixes217 = Fix.version('1.21.6', '1.21.7', Fix.packFormat(81))
