import globals from 'globals';
import pluginJs from '@eslint/js';
import pluginReact from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';


/** @type {import('eslint').Linter.Config[]} */
export default [
	{
		files: ['**/*.{js,mjs,cjs,jsx}'],
	},
	{
		languageOptions: {
			globals: {
				...globals.browser,
				jQuery: 'readonly',
				wp: 'readonly',
				wcSettings: 'readonly',
				PostcodeNl: 'readonly',
			},
		},
	},
	pluginJs.configs.recommended,
	pluginReact.configs.flat.recommended,
	reactHooks.configs['recommended-latest'],
	{
		rules: {
			'no-unused-vars': 'warn',
			'no-extra-semi': 'warn',
			'react/prop-types': 'off',
			'react/react-in-jsx-scope': 'off',
			'react-hooks/exhaustive-deps': [
				'warn',
				{
					additionalHooks: '^(useSelect|useSuspenseSelect)$',
				},
			],
			'semi': 'warn',
		},
	},
];
