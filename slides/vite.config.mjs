export default {
  plugins: [{
    name: 'slidev-empty-code-rule-compat',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('/@slidev/client/styles/code.css')) return
      // UnoCSS 66.10.5 duplicates applied declarations when its empty-rule
      // cleanup rewrites this sheet. Removing this no-op rule first avoids it.
      return code.replace(/\.slidev-code \.slidev-code-highlighted\s*\{\s*\}/g, '')
    },
  }],
}
