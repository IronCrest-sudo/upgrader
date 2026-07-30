import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'

export default tseslint.config(
	{
		ignores: ['dist/**', 'node_modules/**', 'vite.config.mjs'],
	},
	eslint.configs.recommended,
	...tseslint.configs.recommended,
	{
		files: ['src/**/*.{ts,tsx}', 'test/**/*.ts'],
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
			},
		},
		rules: {
			'@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-namespace': 'off',
			'@typescript-eslint/no-unused-expressions': 'off',
			'@typescript-eslint/no-unused-vars': 'off',
			'no-case-declarations': 'off',
			'no-unused-vars': 'off',
			'no-useless-escape': 'off',
			'preserve-caught-error': 'off',
			'no-fallthrough': 'warn',
			'prefer-const': 'warn',
			'prefer-object-spread': 'warn',
		},
	},
)
