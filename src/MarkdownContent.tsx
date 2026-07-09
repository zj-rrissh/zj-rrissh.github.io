import type { ReactNode } from 'react';

type Block =
  | { type: 'heading'; level: 2 | 3 | 4; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'quote'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'code'; code: string; language: string }
  | { type: 'hr' };

type InlineToken =
  | { type: 'code'; text: string; index: number; length: number }
  | { type: 'link'; text: string; href: string; index: number; length: number }
  | { type: 'image'; text: string; href: string; index: number; length: number }
  | { type: 'strong'; text: string; index: number; length: number }
  | { type: 'em'; text: string; index: number; length: number };

export function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="article-body">
      {parseBlocks(content).map((block, index) => renderBlock(block, index))}
    </div>
  );
}

function parseBlocks(content: string): Block[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = line.match(/^```(\w+)?\s*$/);
    if (fence) {
      const code: string[] = [];
      index += 1;

      while (index < lines.length && !lines[index].startsWith('```')) {
        code.push(lines[index]);
        index += 1;
      }

      blocks.push({ type: 'code', code: code.join('\n'), language: fence[1] ?? '' });
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      blocks.push({
        type: 'heading',
        level: Math.min(Math.max(heading[1].length + 1, 2), 4) as 2 | 3 | 4,
        text: heading[2],
      });
      index += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote: string[] = [];

      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^>\s?/, ''));
        index += 1;
      }

      blocks.push({ type: 'quote', text: quote.join(' ') });
      continue;
    }

    // 分割线：--- / *** / ___
    if (/^(-|\*|_){3,}\s*$/.test(line)) {
      blocks.push({ type: 'hr' });
      index += 1;
      continue;
    }

    if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      const ordered = /^\d+\.\s+/.test(line);
      const items: string[] = [];
      const itemPattern = ordered ? /^\d+\.\s+/ : /^[-*]\s+/;

      while (index < lines.length && itemPattern.test(lines[index])) {
        items.push(lines[index].replace(itemPattern, ''));
        index += 1;
      }

      blocks.push({ type: 'list', ordered, items });
      continue;
    }

    const paragraph: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^```/.test(lines[index]) &&
      !/^(#{1,4})\s+/.test(lines[index]) &&
      !/^>\s?/.test(lines[index]) &&
      !/^[-*]\s+/.test(lines[index]) &&
      !/^\d+\.\s+/.test(lines[index])
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }

    blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
  }

  return blocks;
}

function renderBlock(block: Block, index: number) {
  if (block.type === 'heading') {
    const Tag = `h${block.level}` as 'h2' | 'h3' | 'h4';
    return <Tag key={index}>{renderInline(block.text)}</Tag>;
  }

  if (block.type === 'paragraph') {
    return <p key={index}>{renderInline(block.text)}</p>;
  }

  if (block.type === 'quote') {
    return <blockquote key={index}>{renderInline(block.text)}</blockquote>;
  }

  if (block.type === 'hr') {
    return <hr key={index} />;
  }

  if (block.type === 'code') {
    return (
      <pre key={index}>
        <code>{block.code}</code>
      </pre>
    );
  }

  const ListTag = block.ordered ? 'ol' : 'ul';
  return (
    <ListTag key={index}>
      {block.items.map((item, itemIndex) => (
        <li key={itemIndex}>{renderInline(item)}</li>
      ))}
    </ListTag>
  );
}

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let index = 0;

  while (index < text.length) {
    const token = findNextToken(text, index);

    if (!token) {
      nodes.push(text.slice(index));
      break;
    }

    if (token.index > index) {
      nodes.push(text.slice(index, token.index));
    }

    nodes.push(renderToken(token, nodes.length));
    index = token.index + token.length;
  }

  return nodes;
}

function findNextToken(text: string, start: number): InlineToken | null {
  const source = text.slice(start);
  const candidates: Array<InlineToken | null> = [
    findToken(source, start, /`([^`]+)`/, (match, index) => ({
      type: 'code',
      text: match[1],
      index,
      length: match[0].length,
    })),
    findToken(source, start, /!\[([^\]]*)\]\(([^)]+)\)/, (match, index) => ({
      type: 'image',
      text: match[1],
      href: match[2],
      index,
      length: match[0].length,
    })),
    findToken(source, start, /\[([^\]]+)\]\(([^)]+)\)/, (match, index) => ({
      type: 'link',
      text: match[1],
      href: match[2],
      index,
      length: match[0].length,
    })),
    findToken(source, start, /\*\*([^*]+)\*\*/, (match, index) => ({
      type: 'strong',
      text: match[1],
      index,
      length: match[0].length,
    })),
    findToken(source, start, /\*([^*]+)\*/, (match, index) => ({
      type: 'em',
      text: match[1],
      index,
      length: match[0].length,
    })),
  ];

  return candidates
    .filter((candidate): candidate is InlineToken => Boolean(candidate))
    .sort((left, right) => left.index - right.index)[0] ?? null;
}

function findToken(
  source: string,
  start: number,
  pattern: RegExp,
  build: (match: RegExpMatchArray, index: number) => InlineToken,
) {
  const match = source.match(pattern);
  return match && typeof match.index === 'number' ? build(match, start + match.index) : null;
}

function renderToken(token: InlineToken, key: number) {
  if (token.type === 'code') {
    return <code key={key}>{token.text}</code>;
  }

  if (token.type === 'image') {
    return (
      <img
        key={key}
        src={token.href}
        alt={token.text}
        loading="lazy"
        className="article-image"
      />
    );
  }

  if (token.type === 'link') {
    const isExternal = /^https?:\/\//.test(token.href);
    return (
      <a key={key} href={token.href} target={isExternal ? '_blank' : undefined} rel={isExternal ? 'noreferrer' : undefined}>
        {token.text}
      </a>
    );
  }

  if (token.type === 'strong') {
    return <strong key={key}>{renderInline(token.text)}</strong>;
  }

  return <em key={key}>{renderInline(token.text)}</em>;
}
