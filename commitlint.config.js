// 这一行是一个 JSDoc 注释，指定了这个配置文件的类型为 import('cz-git').UserConfig，这样在编辑器中就可以获得类型提示和自动补全功能，帮助开发者更方便地编写和维护这个配置文件。
/** @type {import('cz-git').UserConfig} */

export default {
  extends: ['@commitlint/config-conventional'], // 这是一个预设的配置，包含了常见的提交信息规范， @commitlint/config-conventional 是一个基于 Angular 规范的预设配置，适用于大多数项目。
  parserPreset: 'conventional-changelog-conventionalcommits', // 这是一个解析器预设，指定了如何解析提交信息， conventional-changelog-conventionalcommits 是一个基于 Conventional Commits 规范的解析器预设。简单理解就是它会按照 Conventional Commits 规范来解析提交信息，确保提交信息符合规范的格式。
  prompt: {
    settings: {},
    // 以下是一些自定义的提示信息，可以根据需要进行修改, 这些提示信息会在使用 commitizen 进行提交时显示，帮助开发者按照规范编写提交信息。
    messages: {
      skip: ':skip', // 跳过当前步骤
      max: 'upper %d chars', // 最大字符数提示
      min: '%d chars at least', // 最小字符数提示
      emptyWarning: 'can not be empty', // 不能为空的警告提示
      upperLimitWarning: 'over limit', // 超出限制的警告提示
      lowerLimitWarning: 'below limit'
    },
    // 以下是一些自定义的提交类型，可以根据需要进行修改，这些类型会在使用 commitizen 进行提交时显示，帮助开发者选择合适的提交类型。
    types: [
      { value: 'feat', name: 'feat:     ✨  A new feature', emoji: '✨ ' },
      { value: 'fix', name: 'fix:      🐛  A bug fix', emoji: '🐛 ' },
      { value: 'docs', name: 'docs:     📝  Documentation only changes', emoji: '📝 ' },
      {
        value: 'style',
        name: 'style:    💄  Changes that do not affect the meaning of the code',
        emoji: '💄 '
      },
      {
        value: 'refactor',
        name: 'refactor: 📦️   A code change that neither fixes a bug nor adds a feature',
        emoji: '📦️ '
      },
      {
        value: 'perf',
        name: 'perf:     🚀  A code change that improves performance',
        emoji: '🚀 '
      },
      {
        value: 'test',
        name: 'test:     🚨  Adding missing tests or correcting existing tests',
        emoji: '🚨 '
      },
      {
        value: 'build',
        name: 'build:    🛠   Changes that affect the build system or external dependencies',
        emoji: '🛠 '
      },
      {
        value: 'ci',
        name: 'ci:       🎡  Changes to our CI configuration files and scripts',
        emoji: '🎡 '
      },
      {
        value: 'chore',
        name: "chore:    🔨  Other changes that don't modify src or test files",
        emoji: '🔨 '
      },
      { value: 'revert', name: 'revert:   ⏪️  Reverts a previous commit', emoji: ':rewind:' }
    ],
    useEmoji: true, // 
    confirmColorize: true, // 是否在确认提交信息时使用颜色
    emojiAlign: 'center',
  },
  // 以下是一些自定义的提交信息问题，可以根据需要进行修改，这些问题会在使用 commitizen 进行提交时显示，帮助开发者按照规范编写提交信息。简单理解就是这些问题会引导开发者按照规范的格式编写提交信息，确保提交信息的质量和一致性。
  questions: {
    scope: {
      description: 'What is the scope of this change (e.g. component or file name)'
    },
    subject: {
      description: 'Write a short, imperative tense description of the change'
    },
    body: {
      description: 'Provide a longer description of the change'
    },
    isBreaking: {
      description: 'Are there any breaking changes?'
    },
    breakingBody: {
      description:
        'A BREAKING CHANGE commit requires a body. Please enter a longer description of the commit itself'
    },
    breaking: {
      description: 'Describe the breaking changes'
    },
    isIssueAffected: {
      description: 'Does this change affect any open issues?'
    },
    issuesBody: {
      description:
        'If issues are closed, the commit requires a body. Please enter a longer description of the commit itself'
    },
    issues: {
      description: 'Add issue references (e.g. "fix #123", "re #123".)'
    }
  }
}


// 汉化
// /** @type {import('cz-git').UserConfig} */
// module.exports = {
//     rules: {
//         // @see: https://commitlint.js.org/#/reference-rules
//     },
//     prompt: {
//         alias: { fd: 'docs: fix typos' },
//         messages: {
//             type: '选择你要提交的类型 :',
//             scope: '选择一个提交范围（可选）:',
//             customScope: '请输入自定义的提交范围 :',
//             subject: '填写简短精炼的变更描述 :\n',
//             body: '填写更加详细的变更描述（可选）。使用 "|" 换行 :\n',
//             breaking: '列举非兼容性重大的变更（可选）。使用 "|" 换行 :\n',
//             footerPrefixesSelect: '选择关联issue前缀（可选）:',
//             customFooterPrefix: '输入自定义issue前缀 :',
//             footer: '列举关联issue (可选) 例如: #31, #I3244 :\n',
//             generatingByAI: '正在通过 AI 生成你的提交简短描述...',
//             generatedSelectByAI: '选择一个 AI 生成的简短描述:',
//             confirmCommit: '是否提交或修改commit ?'
//         },
//         types: [
//             { value: '特性', name: '特性:     新增功能' },
//             { value: '修复', name: '修复:     修复缺陷' },
//             { value: '文档', name: '文档:     文档变更' },
//             { value: '格式', name: '格式:     代码格式（不影响功能，例如空格、分号等格式修正）' },
//             { value: '重构', name: '重构:     代码重构（不包括 bug 修复、功能新增）' },
//             { value: '性能', name: '性能:     性能优化' },
//             { value: '测试', name: '测试:     添加疏漏测试或已有测试改动' },
//             { value: '构建', name: '构建:     构建流程、外部依赖变更（如升级 npm 包、修改 webpack 配置等）' },
//             { value: '集成', name: '集成:     修改 CI 配置、脚本' },
//             { value: '回退', name: '回退:     回滚 commit' },
//             { value: '其他', name: '其他:     对构建过程或辅助工具和库的更改（不影响源文件、测试用例）' }
//         ],
//         useEmoji: false,
//         emojiAlign: 'center',
//         useAI: false,
//         aiNumber: 1,
//         themeColorCode: '',
//         scopes: [],
//         allowCustomScopes: true,
//         allowEmptyScopes: true,
//         customScopesAlign: 'bottom',
//         customScopesAlias: '以上都不是？我要自定义',
//         emptyScopesAlias: '跳过',
//         upperCaseSubject: false,
//         markBreakingChangeMode: false,
//         allowBreakingChanges: ['feat', 'fix'],
//         breaklineNumber: 100,
//         breaklineChar: '|',
//         skipQuestions: [],
//         issuePrefixes: [
//             // 如果使用 gitee 作为开发管理
//             { value: 'link', name: 'link:     链接 ISSUES 进行中' },
//             { value: 'closed', name: 'closed:   标记 ISSUES 已完成' }
//         ],
//         customIssuePrefixAlign: 'top',
//         emptyIssuePrefixAlias: '跳过',
//         customIssuePrefixAlias: '自定义前缀',
//         allowCustomIssuePrefix: true,
//         allowEmptyIssuePrefix: true,
//         confirmColorize: true,
//         maxHeaderLength: Infinity,
//         maxSubjectLength: Infinity,
//         minSubjectLength: 0,
//         scopeOverrides: undefined,
//         defaultBody: '',
//         defaultIssues: '',
//         defaultScope: '',
//         defaultSubject: ''
//     }
// }