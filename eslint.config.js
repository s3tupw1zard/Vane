const tseslint = require("typescript-eslint");
const nextPlugin = require("@next/eslint-plugin-next");
const reactHooks = require("eslint-plugin-react-hooks");

const config = [
	...tseslint.configs.recommended,
	{
		plugins: {
			"@next/next": nextPlugin,
			"react-hooks": reactHooks
		},
		rules: {
			"@next/next/no-img-element": "off",
			"react-hooks/rules-of-hooks": "error",
			"react-hooks/exhaustive-deps": "warn",
			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/no-unused-vars": "warn",
			"@typescript-eslint/no-require-imports": "off",
			"@typescript-eslint/no-empty-object-type": "off",
			"@typescript-eslint/no-unused-expressions": "off",
			"@typescript-eslint/no-non-null-asserted-optional-chain": "off",
			"prefer-const": "warn"
		}
	},
	{
		ignores: [
			"integrations/**",
			"node_modules/**",
			".next/**",
			"out/**",
			"build/**",
			"next-env.d.ts",
			"*.config.js",
			"*.config.mjs",
			"*.config.ts",
			".prettierrc.js"
		]
	}
];

module.exports = config;
