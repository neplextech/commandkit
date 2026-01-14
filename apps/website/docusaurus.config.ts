import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const UPPERCASE = new Set(['jsx', 'cli', 'api', 'ai']);

const maybeUpperCase = (str: string) => {
  const chunks = str.split(' ');
  return chunks
    .map((chunk) => {
      if (UPPERCASE.has(chunk.toLowerCase())) {
        return chunk.toUpperCase();
      }

      return chunk;
    })
    .join(' ');
};

const config: Config = {
  title: 'CommandKit',
  tagline:
    'The discord.js meta-framework with features such as AI-powered command handler, analytics, feature flags, and more.',
  favicon: 'img/favicon.ico',
  url: 'https://commandkit.dev',
  baseUrl: '/',
  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },
  presets: [
    [
      'classic',
      {
        docs: {
          lastVersion: 'current',
          versions: {
            current: {
              label: '1.x',
              // path: 'v1',
              badge: true,
              banner: 'none',
            },
            '0.1.10': {
              label: '0.1.10',
              path: 'v0',
              badge: true,
              banner: 'none',
            },
          },
          sidebarPath: './sidebars.ts',
          showLastUpdateAuthor: true,
          showLastUpdateTime: true,
          remarkPlugins: [
            [require('@docusaurus/remark-plugin-npm2yarn'), { sync: true }],
          ],
          editUrl:
            'https://github.com/neplextech/commandkit/tree/main/apps/website/',
          sidebarItemsGenerator: async (args) => {
            const items = await args.defaultSidebarItemsGenerator(args);

            const transform = (item: any) => {
              if (item.type === 'category') {
                return {
                  ...item,
                  label: UPPERCASE.has(item.label?.toLowerCase())
                    ? item.label.toUpperCase()
                    : maybeUpperCase(
                        item.label
                          .replace(/-/g, ' ')
                          .replace(/\b\w/g, (char) => char.toUpperCase()),
                      ),
                  items: item?.items?.map?.(transform),
                };
              }

              return item;
            };

            return items.map(transform);
          },
        },
        theme: {
          customCss: [
            './src/css/custom.css',
            './src/css/layout.css',
            './src/css/overrides.css',
          ],
        },
        sitemap: {
          lastmod: 'date',
          changefreq: 'weekly',
          priority: 0.5,
          ignorePatterns: ['/tags/**'],
          filename: 'sitemap.xml',
          createSitemapItems: async (params) => {
            const { defaultCreateSitemapItems, ...rest } = params;
            const items = await defaultCreateSitemapItems(rest);
            return items.filter((item) => !item.url.includes('/page/'));
          },
        },
      } satisfies Preset.Options,
    ],
  ],
  themeConfig: {
    docs: {
      sidebar: {
        hideable: false,
        autoCollapseCategories: true,
      },
    },
    algolia: {
      appId: 'S9ZEIJ6SBS',
      apiKey: '6f7582f462a448cf1f47a56901595e6e',
      indexName: 'commandkit-js',
      contextualSearch: true,
      insights: false,
    },
    colorMode: {
      defaultMode: 'dark',
    },
    navbar: {
      title: 'CommandKit',
      logo: {
        alt: 'CommandKit logo',
        src: 'img/logo_128.png',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'guide',
          position: 'left',
          label: 'Guide',
        },
        {
          type: 'docSidebar',
          sidebarId: 'api',
          position: 'left',
          label: 'API Reference',
        },
        {
          type: 'docsVersionDropdown',
          position: 'right',
          versions: {
            current: { label: '1.x' },
            '0.1.10': { label: '0.1.10' },
          },
        },
        {
          href: 'https://github.com/neplextech/commandkit',
          label: 'GitHub',
          position: 'right',
        },
        {
          href: 'https://neplextech.com/discord',
          label: 'Discord',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'light',
      copyright: `<a
        href="https://vercel.com?utm_source=commandkit&utm_campaign=oss"
        target="_blank"
        rel="noopener noreferrer"
        className="mx-auto"
      >
        <img
          src="https://vercel.com/button"
          alt="Deploy with Vercel"
          style="height: 32px"
        />
      </a>
      <br/>
      <br/>
      GPL-3.0-only © ${new Date().getFullYear()} <a href="https://neplextech.com?utm_source=commandkit" target="_blank" rel="noopener noreferrer">Neplex</a>.`,
    },
    prism: {
      theme: prismThemes.vsLight,
      darkTheme: prismThemes.dracula,
    },
    mermaid: {
      theme: {
        dark: 'dark',
        light: 'dark',
      },
    },
  } satisfies Preset.ThemeConfig,
  plugins: [
    function tailwindPlugin(context, options) {
      return {
        name: 'tailwind-plugin',
        configurePostCss(postcssOptions) {
          postcssOptions.plugins = [
            require('postcss-import'),
            require('tailwindcss'),
            require('autoprefixer'),
          ];
          return postcssOptions;
        },
      };
    },
    require('./src/plugins/llms-txt.js'),
    ['vercel-analytics', {}],
  ],
  markdown: {
    mermaid: true,
  },
  themes: ['@docusaurus/theme-mermaid'],
};

export default config;
