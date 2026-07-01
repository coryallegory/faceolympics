import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
export default [{ignores:['dist/**','node_modules/**','dist/mediapipe/**']},js.configs.recommended,...tseslint.configs.recommended,{files:['src/**/*.ts'],languageOptions:{globals:{...globals.browser,...globals.es2022}},rules:{'no-empty':'off','@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_'}]}}];
