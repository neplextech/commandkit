import Link from '@docusaurus/Link';
import {
  BarChart3,
  Brain,
  Calendar,
  Code2,
  Database,
  Globe,
  Server,
  Wrench,
} from 'lucide-react';
import React from 'react';

const plugins = [
  {
    icon: Brain,
    name: '@commandkit/ai',
    description:
      'Execute bot commands using large language models with natural language processing.',
    color: 'purple',
    docUrl: '/docs/guide/official-plugins/commandkit-ai',
  },
  {
    icon: BarChart3,
    name: '@commandkit/analytics',
    description:
      'Track bot usage, command performance, and user engagement with Posthog and Umami.',
    color: 'blue',
    docUrl: '/docs/guide/official-plugins/commandkit-analytics',
  },
  {
    icon: Database,
    name: '@commandkit/cache',
    description:
      'High-performance caching system for speedy data storage and retrieval.',
    color: 'green',
    docUrl: '/docs/guide/official-plugins/commandkit-cache',
  },
  {
    icon: Globe,
    name: '@commandkit/i18n',
    description:
      'Complete internationalization support for building global Discord applications.',
    color: 'indigo',
    docUrl: '/docs/guide/official-plugins/commandkit-i18n',
  },
  {
    icon: Code2,
    name: '@commandkit/legacy',
    description: 'Support for migrating from CommandKit v0 to CommandKit v1.',
    color: 'gray',
    docUrl: '/docs/guide/official-plugins/commandkit-legacy',
  },
  {
    icon: Server,
    name: '@commandkit/redis',
    description:
      'Redis integration for distributed caching and data persistence across bot instances.',
    color: 'red',
    docUrl: '/docs/guide/official-plugins/commandkit-redis',
  },
  {
    icon: Calendar,
    name: '@commandkit/tasks',
    description:
      'Scheduled task management and cron job system for automated bot operations.',
    color: 'pink',
    docUrl: '/docs/guide/official-plugins/commandkit-tasks',
  },
];

const iconColors = {
  purple: 'from-purple-500 to-purple-600',
  blue: 'from-blue-500 to-blue-600',
  green: 'from-green-500 to-green-600',
  orange: 'from-orange-500 to-orange-600',
  indigo: 'from-indigo-500 to-indigo-600',
  pink: 'from-pink-500 to-pink-600',
  cyan: 'from-cyan-500 to-cyan-600',
  gray: 'from-gray-500 to-gray-600',
  yellow: 'from-yellow-500 to-yellow-600',
  red: 'from-red-500 to-red-600',
};

export default function PluginsSection(): React.JSX.Element {
  return (
    <section className="relative z-10 py-20 bg-gray-50/50 dark:bg-gray-900/20">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Powerful Plugin Ecosystem</h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            Extend CommandKit with plugins that add specialized functionality to
            your Discord bots. From AI integration to analytics, CommandKit has
            you covered.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plugins.map((plugin, index) => {
            const IconComponent = plugin.icon;
            return (
              <Link
                key={index}
                to={plugin.docUrl}
                className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm hover:shadow-lg border border-gray-200/50 dark:border-gray-700/50 group no-underline hover:no-underline block"
              >
                <div className="mb-4">
                  <div
                    className={`w-12 h-12 bg-gradient-to-r ${iconColors[plugin.color]} rounded-lg flex items-center justify-center`}
                  >
                    <IconComponent className="w-6 h-6 text-white" />
                  </div>
                </div>

                <h3 className="text-lg font-semibold mb-2 font-mono text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400">
                  {plugin.name}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {plugin.description}
                </p>
              </Link>
            );
          })}
        </div>

        <div className="text-center mt-12">
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <Code2 className="w-5 h-5 text-gray-500" />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Build your own custom plugins!
              <a
                href="/docs/guide/creating-plugins/creating-runtime-plugin"
                className="ml-1 text-purple-600 hover:text-purple-700 dark:text-purple-400"
              >
                Learn how to create plugins
              </a>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
