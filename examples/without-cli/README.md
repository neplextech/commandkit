# CommandKit without CLI

This is an example of a CommandKit project without using the CLI.
Note that not using CLI has some drawbacks, such as not being able to use some plugins that require syntax transformation.

## To run this project

1. First, install dependencies:

```sh
pnpm install
```

2. Add your bot token to the `.env` file.

3. Then, run the project:

```sh
pnpm start
# or
COMMANDKIT_IS_CLI=true node src/index.js
```

> Note: You must set `COMMANDKIT_IS_CLI=true` environment variable when running the project without CLI. Not setting this variable will cause the project to fail with errors.

## Useful links

- [Documentation](https://commandkit.dev)
- [Discord](https://neplextech.com/discord)
