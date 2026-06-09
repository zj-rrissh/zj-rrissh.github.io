export type Post = {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  readingTime: string;
  tags: string[];
  content: string;
};

type Frontmatter = {
  title?: string;
  excerpt?: string;
  date?: string;
  readingTime?: string;
  tags?: string;
};

const modules = import.meta.glob('../content/posts/*.md', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>;

export const posts: Post[] = Object.entries(modules)
  .map(([path, source]) => parsePost(path, source))
  .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());

export const topics = Array.from(new Set(posts.flatMap((post) => post.tags)));

function parsePost(path: string, source: string): Post {
  const slug = slugify(path.split('/').pop()?.replace(/\.md$/, '') ?? '');
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);

  if (!match) {
    throw new Error(`Missing frontmatter in ${path}`);
  }

  const frontmatter = parseFrontmatter(match[1]);
  const content = match[2].trim();

  return {
    slug,
    title: required(frontmatter.title, 'title', path),
    excerpt: required(frontmatter.excerpt, 'excerpt', path),
    date: required(frontmatter.date, 'date', path),
    readingTime: required(frontmatter.readingTime, 'readingTime', path),
    tags: required(frontmatter.tags, 'tags', path)
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
    content,
  };
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseFrontmatter(source: string): Frontmatter {
  return source.split(/\r?\n/).reduce<Frontmatter>((fields, line) => {
    const separator = line.indexOf(':');

    if (separator === -1) {
      return fields;
    }

    const key = line.slice(0, separator).trim() as keyof Frontmatter;
    const value = line.slice(separator + 1).trim();

    fields[key] = value;
    return fields;
  }, {});
}

function required(value: string | undefined, field: string, path: string) {
  if (!value) {
    throw new Error(`Missing ${field} in ${path}`);
  }

  return value;
}
