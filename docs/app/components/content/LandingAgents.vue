<script setup lang="ts">
import { tokens } from "../../utils/tokens";
import { TOOLS } from "../../utils/tools";

const { copied, copy } = useCopied();

interface Line {
  /** A shell line gets the prompt; the rest is JSON and goes through the tokenizer. */
  readonly shell?: boolean;
  readonly text: string;
}

const LINES: readonly Line[] = [
  { shell: true, text: "pi install npm:@agntn/curves" },
  { shell: true, text: "omp install @agntn/curves" },
  { text: "" },
  { text: "{" },
  { text: '  "mcpServers": {' },
  { text: '    "curves": { "command": "npx", "args": ["-y", "@agntn/curves", "mcp"] }' },
  { text: "  }" },
  { text: "}" },
];

/** What the copy button hands out: the MCP config alone, ready to paste. */
const CONFIG = LINES.filter((line) => !line.shell && line.text !== "")
  .map((line) => line.text)
  .join("\n");
</script>

<template>
  <section class="tool-console landing-agents" aria-label="The MCP config and the extension installs">
    <span class="console-cross console-cross-tl" aria-hidden="true">+</span>
    <span class="console-cross console-cross-br" aria-hidden="true">+</span>
    <header class="console-bar">
      <span class="console-title"><span class="console-tag">File</span>mcp.json</span>
      <span class="console-meta">stdio</span>
      <span class="console-mark" aria-hidden="true" />
    </header>
    <div class="console-ruler" aria-hidden="true" />

    <div class="agents-body">
      <p class="console-label console-rule-title">
        <span>Hosts <span aria-hidden="true">[ Pi, OMP, any MCP client ]</span></span>
        <span class="console-mark" aria-hidden="true" />
        <UButton
          color="neutral"
          variant="subtle"
          :icon="copied === 'config' ? 'i-lucide-check' : 'i-lucide-copy'"
          :label="copied === 'config' ? 'copied' : 'copy'"
          :aria-label="copied === 'config' ? 'Copied' : 'Copy the MCP config'"
          @click="copy('config', CONFIG)"
        />
      </p>
      <!-- prettier-ignore -->
      <pre
        class="console-snippet console-lines"
      ><code><span v-for="(line, index) in LINES" :key="index"><template v-if="line.shell"><span class="agents-prompt">$ </span>{{ line.text }}</template><span v-for="(token, part) in line.shell ? [] : tokens(line.text)" v-else :key="part" :class="token.cls">{{ token.text }}</span></span></code></pre>
    </div>

    <footer class="console-footer console-footer-plain">
      <span>{{ TOOLS.join(" · ") }}</span>
    </footer>
  </section>
</template>

<style scoped>
.agents-body {
  display: grid;
  gap: 10px;
  padding: 18px 20px 20px;
}
.agents-body > .console-rule-title {
  margin: 0;
}
.agents-body > pre {
  margin: 0;
}
.agents-prompt {
  color: var(--ui-text-dimmed);
}
@media (width < 400px) {
  .agents-body {
    padding-inline: 14px;
  }
}
</style>
