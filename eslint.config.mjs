import js from '@eslint/js'
import nextPlugin from '@next/eslint-plugin-next'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/coverage/**',
      '**/*.d.ts',
      '**/*.tsbuildinfo',
      'pnpm-lock.yaml',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      '@next/next': nextPlugin,
    },
  },
  {
    files: ['**/*.{js,cjs,mjs,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        React: 'readonly',
        JSX: 'readonly',
      },
    },
  },
  {
    files: [
      'apps/**/*.{js,cjs,mjs,ts,tsx}',
      'app/**/*.{js,cjs,mjs,ts,tsx}',
      'components/**/*.{js,cjs,mjs,ts,tsx}',
      'lib/**/*.{js,cjs,mjs,ts,tsx}',
    ],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      '@next/next/no-html-link-for-pages': 'off',
      '@next/next/no-page-custom-font': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
    settings: {
      next: {
        rootDir: ['apps/dashboard/', 'apps/menu/', 'apps/kitchen/', 'apps/marketing/', 'apps/platform-admin/'],
      },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': 'off',
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@garsonless/db',
              allowTypeImports: true,
              message: 'The root DB entrypoint is type-only. Use @garsonless/db/server, @garsonless/db/browser or @garsonless/domain/* for runtime imports.',
            },
            {
              name: '@garsonless/db/server',
              importNames: ['createServiceClient'],
              message: 'Apps must use typed DB ports; the raw service-role client is private to @garsonless/db.',
            },
            {
              name: '@garsonless/db/browser',
              importNames: [
                'SERVICE_REQUEST_TYPES',
                'SERVICE_REQUEST_LABELS',
                'isServiceRequestType',
                'serviceRequestLabel',
                'applyReviewInvalidatingPatch',
                'calculateMarginPercent',
                'getDietaryClaimsConflict',
                'moveListItem',
                'normalizeMenuNumericText',
                'parseMenuNumericInput',
                'separateAllergenDeclarations',
                'toggleAllergenDeclaration',
              ],
              message: 'This policy belongs to @garsonless/domain/tables or @garsonless/domain/menu, not the DB browser boundary.',
            },
          ],
        },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: ['apps/dashboard/**/*.{js,cjs,mjs,ts,tsx}'],
    rules: {
      // Dashboard images are admin previews/uploads/QR artifacts where Next Image
      // optimization can change sizing or reject blob/data-style sources.
      '@next/next/no-img-element': 'off',
    },
  },
  {
    files: ['packages/ui/src/icons/index.tsx', 'src/icons/index.tsx'],
    rules: {
      '@typescript-eslint/triple-slash-reference': 'off',
    },
  },
  {
    files: ['**/public/sw.js'],
    languageOptions: {
      globals: globals.serviceworker,
    },
  },
  {
    files: ['**/*.config.{js,cjs,mjs,ts}', '**/scripts/**/*.{js,cjs,mjs,ts}'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
)
