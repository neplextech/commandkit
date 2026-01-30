# Contributing to CommandKit

Firstly, thank you for considering contributing to CommandKit! Whether
you're looking to fix bugs, add new features, or just ask questions,
your input is valuable to us. Before actually opening a pull request,
we recommend that you first open an issue (or check existing ones) to
discuss the feature/bug you intend to add/fix.

## Setup

### Prerequisites

1. Ensure you have `Node.js` and `pnpm` installed.
   - Node.js: [Download here](https://nodejs.org/)
   - pnpm: Install via `npm install -g pnpm` if you haven't.

### Fork & Clone

1. Fork the repository to your own GitHub account.
2. Clone your fork to your local machine:

```bash
git clone https://github.com/your_username/commandkit.git
```

### Installing Dependencies

Since we use `pnpm` workspaces, it's essential to use `pnpm` for
installing dependencies.

```bash
cd commandkit
pnpm install # Make sure to run this from the root directory
```

### Workflow

1. Create a new branch for your work:

```bash
git checkout -b your-feature-or-bugfix
```

2. Make your changes. Please make sure to use the
   [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
   extension for consistent formatting and comments wherever
   necessary. Alternatively, you can run `pnpm format` after you've
   made your changes.

3. Ensure that your changes don't break any existing functionality.
   You can test the functionality of your code depending on where
   you've made changes:
   1. If you've made changes to the CommandKit package, you can use
      the "apps/test-bot" project to test your own bot. Just make sure
      to create a new `.env` file with the template from the
      `.env.example` file provided. This also requires you to build
      the CommandKit package (at `packages/commandkit`) locally (after
      you make your changes) because it's symlinked with pnpm
      workspaces.
   2. If you've made changes to the docs, you can run `pnpm dev`
      inside "apps/website" to spin up a local development server.

4. Run `pnpm check-types` and `pnpm prettier:check` from the root
   directory to ensure all type checking and formatting is valid.

5. Commit your changes:

```bash
git commit -m "Describe your change here"
```

6. Push your changes to your fork:

```bash
git push origin your-feature-or-bugfix
```

7. Open a pull request in the main project repository (`main` branch).
   Describe your changes and any relevant information.

## Submitting Issues

When submitting a new issue, please provide a detailed description of
the problem, steps to reproduce it, and any relevant screenshots or
error messages.

---

Thank you for making CommandKit better! We appreciate your effort and
look forward to collaborating with you.
