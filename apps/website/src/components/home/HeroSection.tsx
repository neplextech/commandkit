import Link from '@docusaurus/Link';
import { BookOpen, Code, Github } from 'lucide-react';
import React from 'react';
import { themeColors } from './theme';

export default function HeroSection(): React.JSX.Element {
  return (
    <section className="relative z-10 w-72 h-96 mx-auto text-center mt-32 mb-48 lg:mb-32 md:mb-16 flex items-center justify-center flex-col md:flex-row-reverse md:gap-2 md:text-left md:mt-12 md:w-[700px] lg:w-[850px]">
      <img
        src="/img/logo.png"
        alt="CommandKit logo"
        className="md:w-[250px] lg:w-[280px] mb-10 md:mb-0 select-none drop-shadow-2xl"
        width={250}
        height={250}
        draggable={false}
      />

      <div className="relative">
        <p className="text-4xl font-bold mb-5 md:text-5xl lg:text-6xl relative">
          Let{' '}
          <span
            className={`text-transparent bg-clip-text bg-gradient-to-r ${themeColors.gradients.primary} relative`}
          >
            CommandKit
          </span>{' '}
          handle it for you!
        </p>
        <p className="lg:text-lg text-gray-600 dark:text-gray-300">
          The discord.js meta-framework for building powerful, modular, and
          extensible Discord bots with ease.
        </p>

        <div className="flex items-center justify-center gap-3 mt-10 md:justify-start [&>a]:text-white [&>a]:hover:text-white">
          <Link
            to="/docs/guide/getting-started/introduction"
            className={`font-semibold bg-gradient-to-r ${themeColors.gradients.purple} hover:from-[#9a60f7] hover:to-[#7e33f6] py-2 px-4 rounded-full shadow-lg hover:shadow-xl flex items-center gap-2`}
          >
            <BookOpen className="w-4 h-4" />
            Guide
          </Link>
          <Link
            to="/docs/api-reference/commandkit/"
            className={`font-semibold bg-gradient-to-r ${themeColors.gradients.blue} hover:from-blue-600 hover:to-blue-700 py-2 px-4 rounded-full shadow-lg hover:shadow-xl flex items-center gap-2`}
          >
            <Code className="w-4 h-4" />
            API <span className="hidden md:inline">Reference</span>
          </Link>
          <Link
            href="https://github.com/neplextech/commandkit"
            className={`font-semibold bg-gradient-to-r ${themeColors.gradients.pink} hover:from-[#f06292] hover:to-[#e91e63] py-2 px-4 rounded-full shadow-lg hover:shadow-xl flex items-center gap-2`}
          >
            <Github className="w-4 h-4" />
            GitHub
          </Link>
        </div>
      </div>
    </section>
  );
}
