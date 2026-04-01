import chalk from "chalk";

// ── Minimal Markdown renderer for terminal ──
// Renders markdown to styled terminal output without heavy dependencies.

export function renderMarkdown(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];

  let inCodeBlock = false;
  let codeLang = "";

  for (const line of lines) {
    // Fenced code blocks
    if (line.trimStart().startsWith("```")) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLang = line.trimStart().slice(3).trim();
        out.push(chalk.dim(`  ┌─ ${codeLang || "code"} ${"─".repeat(Math.max(0, 40 - (codeLang || "code").length))}`));
      } else {
        inCodeBlock = false;
        codeLang = "";
        out.push(chalk.dim("  └─" + "─".repeat(44)));
      }
      continue;
    }

    if (inCodeBlock) {
      out.push(chalk.cyan("  │ ") + line);
      continue;
    }

    // Headers
    const h3 = line.match(/^### (.+)/);
    if (h3) { out.push(chalk.bold.yellow("   " + h3[1])); continue; }
    const h2 = line.match(/^## (.+)/);
    if (h2) { out.push(chalk.bold.magenta("  " + h2[1])); continue; }
    const h1 = line.match(/^# (.+)/);
    if (h1) { out.push(chalk.bold.cyan(" " + h1[1])); continue; }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      out.push(chalk.dim("─".repeat(48)));
      continue;
    }

    // Bullet lists
    const bullet = line.match(/^(\s*)[*-] (.+)/);
    if (bullet) {
      out.push(bullet[1] + chalk.dim("• ") + renderInline(bullet[2]));
      continue;
    }

    // Numbered lists
    const numbered = line.match(/^(\s*)\d+\. (.+)/);
    if (numbered) {
      out.push(numbered[1] + chalk.dim("  ") + renderInline(numbered[2]));
      continue;
    }

    // Regular text
    out.push(renderInline(line));
  }

  return out.join("\n");
}

// ── Inline formatting ──

function renderInline(text: string): string {
  // Bold: **text** or __text__
  text = text.replace(/\*\*(.+?)\*\*/g, (_, m) => chalk.bold(m));
  text = text.replace(/__(.+?)__/g, (_, m) => chalk.bold(m));

  // Italic: *text* or _text_ (but not inside words with underscores)
  text = text.replace(/(?<!\w)\*(.+?)\*(?!\w)/g, (_, m) => chalk.italic(m));

  // Inline code: `text`
  text = text.replace(/`([^`]+)`/g, (_, m) => chalk.cyan(m));

  // Links: [text](url) → text (url)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) =>
    chalk.underline(label) + chalk.dim(` (${url})`)
  );

  return text;
}
