export type Project = {
  name: string;
  description: string;
  tags: string[];
  href: string;
};

export const projects: Project[] = [
  {
    name: 'zj-rrissh.github.io',
    description: '一个使用 React、TypeScript 和 Vite 构建的个人技术博客，支持 Markdown 文章和明暗主题。',
    tags: ['React', 'TypeScript', 'Vite'],
    href: 'https://github.com/zj-rrissh/zj-rrissh.github.io',
  },
];
