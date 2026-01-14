<div align="center">
    <img src="https://raw.githubusercontent.com/neplextech/commandkit/main/apps/website/static/img/ckit_logo.svg" width="60%" />
    <br />
    <a href="https://neplextech.com/discord"><img src="https://img.shields.io/discord/1055188344188973066?color=5865F2&logo=discord&logoColor=white" alt="support server" /></a>
    <a href="https://www.npmjs.com/package/create-commandkit"><img src="https://img.shields.io/npm/v/create-commandkit?maxAge=3600" alt="npm version" /></a>
    <a href="https://www.npmjs.com/package/create-commandkit"><img src="https://img.shields.io/npm/dt/create-commandkit?maxAge=3600" alt="npm downloads" /></a>
</div>

# create-commandkit

create-commandkit is a CLI utility to quickly instantiate a Discord bot with CommandKit.

## Features

- Interactive, beautiful command-line interface 🖥️
- Supports CommonJS and ES Modules 📦
- Dynamic template system with examples from GitHub 🚀
- Support for all major package managers (npm, pnpm, yarn, bun, deno) 📦
- TypeScript and JavaScript support 🔧

## Documentation

You can find the full documentation [here](https://commandkit.dev).

## Usage

### Basic Usage

```sh
npx create-commandkit@latest
```

### With Project Name

```sh
npx create-commandkit@latest my-bot
```

### Using Examples

```sh
# Use a curated example
npx create-commandkit@latest --example with-database

# Use a custom GitHub repository
npx create-commandkit@latest --example "https://github.com/user/repo"

# Use a specific path within a repository
npx create-commandkit@latest --example "https://github.com/user/repo" --example-path "examples/bot"
```

### CLI Options

- `-h, --help` - Show all available options
- `-V, --version` - Output the version number
- `-e, --example <name-or-url>` - An example to bootstrap the app with
- `--example-path <path>` - Specify the path to the example separately
- `--use-npm` - Use npm as package manager
- `--use-pnpm` - Use pnpm as package manager
- `--use-yarn` - Use yarn as package manager
- `--use-bun` - Use bun as package manager
- `--use-deno` - Use deno as package manager
- `--skip-install` - Skip installing packages
- `--no-git` - Skip git initialization
- `--yes` - Use defaults for all options
- `--list-examples` - List all available examples from the official repository

### Available Examples

<!-- BEGIN_AVAILABLE_EXAMPLES -->
- `basic-js` - [examples/basic-js](https://github.com/neplextech/commandkit/tree/main/examples/basic-js)
- `basic-ts` - [examples/basic-ts](https://github.com/neplextech/commandkit/tree/main/examples/basic-ts)
- `deno-ts` - [examples/deno-ts](https://github.com/neplextech/commandkit/tree/main/examples/deno-ts)
- `with-ai` - [examples/with-ai](https://github.com/neplextech/commandkit/tree/main/examples/with-ai)
- `with-leveling-system` - [examples/with-leveling-system](https://github.com/neplextech/commandkit/tree/main/examples/with-leveling-system)
- `with-workflow` - [examples/with-workflow](https://github.com/neplextech/commandkit/tree/main/examples/with-workflow)
- `without-cli` - [examples/without-cli](https://github.com/neplextech/commandkit/tree/main/examples/without-cli)
<!-- END_AVAILABLE_EXAMPLES -->

### Examples

```sh
# Create a basic TypeScript bot, skip installation
npx create-commandkit@latest --example basic-ts --skip-install

# Create a bot with all defaults (no prompts)
npx create-commandkit@latest --yes

# Create a bot from custom repository
npx create-commandkit@latest --example "https://github.com/username/my-commandkit-template"

# Create a bot with pnpm
npx create-commandkit@latest --use-pnpm

# List all available examples
npx create-commandkit@latest --list-examples
```

## Support and Suggestions

Submit any queries or suggestions in our [Discord community](https://neplextech.com/discord).