import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { posts, type Post } from './data/posts';
import { projects } from './data/projects';
import { thoughts } from './data/thoughts';
import { MarkdownContent } from './MarkdownContent';

type NavPath = '/' | '/archive' | '/showcase' | '/thoughts';
type RoutePath = NavPath | `/posts/${string}`;
type Theme = 'light' | 'dark';

const navItems: Array<{ label: string; path: NavPath }> = [
  { label: '首页', path: '/' },
  { label: '归档', path: '/archive' },
  { label: '展示', path: '/showcase' },
  { label: '想法', path: '/thoughts' },
];

const socialLinks = [
  { label: 'GitHub', href: 'https://github.com/zj-rrissh', icon: 'github' },
  { label: 'QQ Mail', href: 'mailto:2740903463@qq.com', icon: 'qq' },
];

const redirectStorageKey = 'rrissh:redirect-path';

function normalizePath(pathname: string): RoutePath {
  if (pathname === '/archive' || pathname === '/showcase' || pathname === '/thoughts') {
    return pathname;
  }

  if (pathname.startsWith('/posts/') && pathname.length > '/posts/'.length) {
    return pathname as `/posts/${string}`;
  }

  return '/';
}

function getSortedPosts() {
  return [...posts].sort(
    (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime(),
  );
}

function getInitialTheme(): Theme {
  return localStorage.getItem('theme') === 'dark' ? 'dark' : 'light';
}

function getInitialRoute(): RoutePath {
  const redirectedPath = sessionStorage.getItem(redirectStorageKey);

  if (redirectedPath) {
    sessionStorage.removeItem(redirectStorageKey);
    window.history.replaceState({}, '', redirectedPath);
    return normalizePath(redirectedPath);
  }

  return normalizePath(window.location.pathname);
}

function App() {
  const [route, setRoute] = useState<RoutePath>(getInitialRoute);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const sortedPosts = useMemo(() => getSortedPosts(), []);
  const latestPosts = sortedPosts;
  const currentPost = route.startsWith('/posts/')
    ? sortedPosts.find((post) => post.slug === route.slice('/posts/'.length))
    : undefined;

  useEffect(() => {
    const handlePopState = () => {
      setRoute(normalizePath(window.location.pathname));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  function navigate(path: RoutePath) {
    if (path === route) {
      return;
    }

    window.history.pushState({}, '', path);
    setRoute(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleRouteClick(event: MouseEvent<HTMLAnchorElement>, path: RoutePath) {
    event.preventDefault();
    navigate(path);
  }

  return (
    <main className="page-shell">
      <header className="site-header" aria-label="站点导航">
        <a className="brand" href="/" onClick={(event) => handleRouteClick(event, '/')} aria-label="前往首页">
          {/* <span className="brand-mark" aria-hidden="true">R</span> */}
          <span className="brand-text shuffle-parent" aria-label="Rrissh">
            {[
              ['R', '7'],
              ['r', '#'],
              ['i', '1'],
              ['s', '$'],
              ['s', '%'],
              ['h', 'H'],
            ].map(([char, scramble]) => (
              <span className="shuffle-char-wrapper" key={char + scramble} aria-hidden="true">
                <span className="shuffle-strip">
                  <span className="shuffle-char">{char}</span>
                  <span className="shuffle-char">{scramble}</span>
                </span>
              </span>
            ))}
          </span>
        </a>

        <div className="header-actions">
          <nav className="nav-links" aria-label="主导航">
            {navItems.map((item) => (
              <a
                key={item.path}
                className={item.path === route ? 'nav-link is-active' : 'nav-link'}
                href={item.path}
                onClick={(event) => handleRouteClick(event, item.path)}
              >
                {item.label}
              </a>
            ))}
          </nav>

          <button
            className="theme-toggle"
            type="button"
            onClick={() => setTheme((currentTheme) => (currentTheme === 'light' ? 'dark' : 'light'))}
            aria-label={theme === 'light' ? '切换到夜晚模式' : '切换到白天模式'}
            aria-pressed={theme === 'dark'}
          >
            <span className="theme-toggle-track" aria-hidden="true">
              <span className="theme-toggle-thumb" />
            </span>
          </button>
        </div>
      </header>

      {route === '/' && <HomePage latestPosts={latestPosts} onNavigate={navigate} />}
      {route === '/archive' && <ArchivePage posts={sortedPosts} onNavigate={navigate} />}
      {route === '/showcase' && <ShowcasePage />}
      {route === '/thoughts' && <ThoughtsPage />}
      {route.startsWith('/posts/') && <PostPage post={currentPost} onNavigate={navigate} />}
    </main>
  );
}

function HomeProfile() {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <div className="profile-line">
        <button
          className="avatar-toggle"
          type="button"
          aria-expanded={expanded}
          aria-label={expanded ? '收起个人信息' : '展开个人信息'}
          onClick={() => setExpanded((s) => !s)}
        >
          <img className="avatar" src="/avatar.png" alt="Rrissh avatar" />
        </button>
        {expanded && <h2>rrissh</h2>}
      </div>

      {expanded && (
        <p className="hero-copy">
          记录和分享一些技术文章、开源项目以及零碎的想法。喜欢折腾各种工具和技术，偶尔写写东西，欢迎交流。
        </p>
      )}
    </>
  );
}

function HomePage({
  latestPosts,
  onNavigate,
}: {
  latestPosts: Post[];
  onNavigate: (path: RoutePath) => void;
}) {
  const [copiedEmail, setCopiedEmail] = useState(false);
  const copyTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (copyTimer.current) {
        window.clearTimeout(copyTimer.current);
      }
    };
  }, []);

  async function handleEmailClick(event: MouseEvent<HTMLAnchorElement>, href: string) {
    event.preventDefault();
    const email = href.replace(/^mailto:/, '');
    const copied = await copyText(email);

    if (!copied) {
      window.location.href = href;
      return;
    }

    setCopiedEmail(true);

    if (copyTimer.current) {
      window.clearTimeout(copyTimer.current);
    }

    copyTimer.current = window.setTimeout(() => {
      setCopiedEmail(false);
    }, 1800);
  }

  return (
    <>
      <section className="hero" aria-label="个人信息">
        <HomeProfile />

        <div className="link-row" aria-label="个人链接">
          {socialLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target={link.href.startsWith('http') ? '_blank' : undefined}
              rel="noreferrer"
              aria-label={link.label}
              onClick={link.icon === 'qq' ? (event) => handleEmailClick(event, link.href) : undefined}
            >
              {link.icon === 'github' && (
                <svg
                  className="social-icon"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  role="img"
                >
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.387.6.113.82-.262.82-.583
                    0-.288-.01-1.051-.015-2.062-3.338.726-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.73.083-.73
                    1.205.085 1.84 1.238 1.84 1.238 1.07 1.835 2.807 1.305 3.492.997.108-.776.418-1.305.76-1.605-2.665-.305-5.467-1.333-5.467-5.933
                    0-1.31.468-2.38 1.236-3.22-.124-.303-.536-1.523.117-3.176 0 0 1.008-.322 3.301 1.23.96-.267 1.98-.4 3-.405 1.02.005 2.04.138 3 .405
                    2.29-1.552 3.296-1.23 3.296-1.23.656 1.653.244 2.873.12 3.176.77.84 1.235 1.91 1.235 3.22
                    0 4.61-2.807 5.624-5.48 5.922.43.37.815 1.103.815 2.222 0 1.606-.015 2.898-.015 3.293
                    0 .322.21.698.825.58C20.565 21.796 24 17.297 24 12c0-6.63-5.37-12-12-12Z" />
                </svg>
              )}
              {link.icon === 'qq' && (
                <svg
                  className="social-icon social-icon-mail"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  role="img"
                >
                  <path d="M4.75 5.25h14.5c1.24 0 2.25 1.01 2.25 2.25v9c0 1.24-1.01 2.25-2.25 2.25H4.75A2.25 2.25 0 0 1 2.5 16.5v-9c0-1.24 1.01-2.25 2.25-2.25Z" />
                  <path d="m4 7 8 5.65L20 7" />
                  <path d="m4.25 17 5.18-4.4" />
                  <path d="m19.75 17-5.18-4.4" />
                </svg>
              )}
            </a>
          ))}
          <span className={copiedEmail ? 'copy-status is-visible' : 'copy-status'} role="status" aria-live="polite">
            {copiedEmail ? '复制成功' : ''}
          </span>
        </div>
      </section>

      <section className="section-block" aria-labelledby="latest-posts-title">
        <div className="section-heading">
          <div>
            {/* <p className="eyebrow">Latest</p> */}
            {/* <h2 id="latest-posts-title">最近文章</h2> */}
          </div>
          {/* <button className="text-action" type="button" onClick={() => onNavigate('/archive')}>
            查看全部
          </button> */}
        </div>

        <PostList posts={latestPosts} onNavigate={onNavigate} compact />
      </section>
    </>
  );
}

function ArchivePage({
  posts,
  onNavigate,
}: {
  posts: Post[];
  onNavigate: (path: RoutePath) => void;
}) {
  return (
    <section className="page-section" aria-labelledby="archive-title">
      <p className="eyebrow">Archive</p>
      {/* <h1 id="archive-title">归档</h1> */}
      {/* <p className="page-lead">所有文章按时间倒序排列，方便回看不同阶段写下的技术记录和随笔。</p> */}
      <PostList posts={posts} onNavigate={onNavigate} timeline />
    </section>
  );
}

function PostPage({
  post,
  onNavigate,
}: {
  post: Post | undefined;
  onNavigate: (path: RoutePath) => void;
}) {
  if (!post) {
    return (
      <section className="page-section article-page" aria-labelledby="post-not-found-title">
        <p className="eyebrow">Not found</p>
        <h1 id="post-not-found-title">文章不存在</h1>
        <p className="page-lead">这篇文章可能已经移动或还没有发布。</p>
        <button className="text-action article-back" type="button" onClick={() => onNavigate('/archive')}>
          返回归档
        </button>
      </section>
    );
  }

  return (
    <article className="page-section article-page">
      <button className="text-action article-back" type="button" onClick={() => onNavigate('/archive')}>
        返回归档
      </button>
      <p className="eyebrow">{post.tags.join(' / ')}</p>
      <h1>{post.title}</h1>
      <div className="article-meta">
        <time dateTime={post.date}>{formatDate(post.date)}</time>
        <span>{post.readingTime}</span>
      </div>
      <MarkdownContent content={post.content} />
    </article>
  );
}

function ShowcasePage() {
  return (
    <section className="page-section showcase" aria-labelledby="showcase-title">
      <p className="eyebrow">Showcase</p>
      {/* <h1 id="showcase-title">展示</h1>
      <p className="page-lead">
        这里会逐步整理开源项目、工具实验和一些值得留下的作品。现在先保留一片安静的位置，
        等真正想展示的东西出现。
      </p> */}
      <div className="project-list">
        {projects.map((project) => (
          <article className="project-item" key={project.href}>
            <p className="post-topic">{project.tags.join(' / ')}</p>
            <h2>
              <a href={project.href} target="_blank" rel="noreferrer">
                {project.name}
              </a>
            </h2>
            <p>{project.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ThoughtsPage() {
  return (
    <section className="page-section" aria-labelledby="thoughts-title">
      <p className="eyebrow">Notes</p>
      {/* <h1 id="thoughts-title">想法</h1>
      <p className="page-lead">短札、计划和一些还没长成文章的念头，先放在这里。</p> */}
      <ol className="thought-list">
        {thoughts.map((thought) => (
          <li key={thought.date + thought.title}>
            <time dateTime={thought.date}>{formatDate(thought.date)}</time>
            <div>
              <h2>{thought.title}</h2>
              <p>{thought.content}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function PostList({
  posts,
  onNavigate,
  dense = false,
  compact = false,
  timeline = false,
}: {
  posts: Post[];
  onNavigate: (path: RoutePath) => void;
  dense?: boolean;
  compact?: boolean;
  timeline?: boolean;
}) {
  const className = [
    'post-list',
    dense ? 'is-dense' : '',
    compact ? 'is-compact' : '',
    timeline ? 'is-timeline' : '',
  ].filter(Boolean).join(' ');

  function handlePostClick(event: MouseEvent<HTMLAnchorElement>, slug: string) {
    event.preventDefault();
    onNavigate(`/posts/${slug}`);
  }

  if (timeline) {
    return (
      <div className={className}>
        {posts.map((post) => (
          <article className="timeline-item" key={post.title}>
            <div className="timeline-date">
              <time dateTime={post.date}>{formatDate(post.date)}</time>
            </div>
            <div className="timeline-line" aria-hidden="true">
              <span className="timeline-dot" />
            </div>
            <div className="timeline-content">
              <p className="post-topic">{post.tags.join(' / ')}</p>
              <h2>
                <a href={`/posts/${post.slug}`} onClick={(event) => handlePostClick(event, post.slug)}>
                  {post.title}
                </a>
              </h2>
              <p>{post.excerpt}</p>
              <div className="post-meta">
                <span>{post.readingTime}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    );
  }

  return (
    <div className={className}>
      {posts.map((post) => (
        <article className="post-item" key={post.title}>
          <div>
            {!compact && <p className="post-topic">{post.tags.join(' / ')}</p>}
            <h2>
              <a href={`/posts/${post.slug}`} onClick={(event) => handlePostClick(event, post.slug)}>
                {post.title}
              </a>
            </h2>
            {compact && (
              <div className="compact-post-meta">
                <time dateTime={post.date}>{formatDate(post.date)}</time>
                <span>{post.tags.slice(0, 2).join(' / ')}</span>
              </div>
            )}
            {!compact && <p>{post.excerpt}</p>}
          </div>
          {!compact && (
            <div className="post-meta">
              <time dateTime={post.date}>{formatDate(post.date)}</time>
              <span>{post.readingTime}</span>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(date));
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the textarea fallback.
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }
}

export default App;
