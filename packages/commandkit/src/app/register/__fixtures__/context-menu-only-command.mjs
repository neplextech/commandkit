export const command = {
  name: 'inspect',
  description: 'Inspect content from a context menu command.',
};

export const metadata = {
  nameAliases: {
    user: 'Inspect User',
    message: 'Inspect Message',
  },
};

export const userContextMenu = async () => {};
export const messageContextMenu = async () => {};
