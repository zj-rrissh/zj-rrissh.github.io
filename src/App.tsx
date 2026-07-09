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

      {route.startsWith('/posts/') && <hr className="header-divider" />}

      {route === '/' && <HomePage latestPosts={latestPosts} onNavigate={navigate} />}
      {route === '/archive' && <ArchivePage posts={sortedPosts} onNavigate={navigate} />}
      {route === '/showcase' && <ShowcasePage />}
      {route === '/thoughts' && <ThoughtsPage />}
      {route.startsWith('/posts/') && <PostPage post={currentPost} onNavigate={navigate} />}
    </main>
  );
}

function HomePage({
  latestPosts,
  onNavigate,
}: {
  latestPosts: Post[];
  onNavigate: (path: RoutePath) => void;
}) {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const filteredPosts = selectedTag
    ? latestPosts.filter((post) => post.tags.includes(selectedTag))
    : latestPosts;

  const collections = useMemo(() => {
    const map = new Map<string, number>();
    latestPosts.forEach((post) => {
      post.tags.forEach((tag) => {
        map.set(tag, (map.get(tag) || 0) + 1);
      });
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [latestPosts]);

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

  function handlePostClick(event: MouseEvent<HTMLAnchorElement>, slug: string) {
    event.preventDefault();
    onNavigate(`/posts/${slug}`);
  }

  return (
    <div className="home-layout">
      {/* 左列：时间线 */}
      <div className="home-timeline" aria-hidden="true">
        <div className="home-timeline-bar" />
      </div>

      {/* 中列：文章流 + 合集 */}
      <div className="home-middle">
        <div className="home-article-stream">
          {filteredPosts.map((post) => (
            <article className="home-article-card" key={post.slug}>
              <time className="home-article-date" dateTime={post.date}>
                {formatDate(post.date)}
              </time>
              <h2 className="home-article-title">
                <a
                  href={`/posts/${post.slug}`}
                  onClick={(event) => handlePostClick(event, post.slug)}
                >
                  {post.title}
                </a>
              </h2>
              <p className="home-article-excerpt">{post.excerpt}</p>
            </article>
          ))}
        </div>

        <div className="home-stream-divider" aria-hidden="true" />

        <div className="home-collection">
          <h3 className="home-collection-title">分类合集</h3>
          <button
            className={'home-collection-item' + (selectedTag === null ? ' is-active' : '')}
            onClick={() => setSelectedTag(null)}
          >
            全部
            <span className="home-collection-count">{latestPosts.length}</span>
          </button>
          {collections.map(([tag, count]) => (
            <button
              key={tag}
              className={'home-collection-item' + (selectedTag === tag ? ' is-active' : '')}
              onClick={() => setSelectedTag(tag)}
            >
              {tag}
              <span className="home-collection-count">{count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 右列：侧边栏 */}
      <aside className="home-sidebar">
        <img className="sidebar-avatar" src="/avatar.png" alt="Rrissh avatar" />

        <div className="sidebar-friends">
          {/* <p className="sidebar-friends-label">友链</p> */}
          {socialLinks.map((link) => (
            <a
              key={link.href}
              className="sidebar-friend-link"
              href={link.href}
              target={link.href.startsWith('http') ? '_blank' : undefined}
              rel="noreferrer"
              onClick={link.icon === 'qq' ? (event) => handleEmailClick(event, link.href) : undefined}
            >
              {link.label}
            </a>
          ))}
          {copiedEmail && (
            <span className="sidebar-copy-status" role="status" aria-live="polite">
              复制成功
            </span>
          )}
        </div>
      </aside>
    </div>
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
    <section className="archive-page" aria-labelledby="archive-title">
      <p className="eyebrow">Archive</p>
      <ol className="archive-list">
        {posts.map((post) => (
          <li key={post.slug}>
            <a
              href={`/posts/${post.slug}`}
              onClick={(event) => {
                event.preventDefault();
                onNavigate(`/posts/${post.slug}`);
              }}
            >
              {post.title}
            </a>
          </li>
        ))}
      </ol>
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
      {/* <button className="text-action article-back" type="button" onClick={() => onNavigate('/archive')}>
        返回归档
      </button> */}
      <h2>{post.title}</h2>
      <div className="article-meta">
        <time dateTime={post.date}>{formatDate(post.date)}</time>
        <span>{post.readingTime}</span>
        <span>{post.tags.join(' / ')}</span>
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
