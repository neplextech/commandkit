export const command = {
  name: 'report',
  description: 'Report content to moderators.',
  options: [
    {
      name: 'reason',
      description: 'Why this content should be reported.',
      type: 3,
      required: false,
    },
  ],
};

export const metadata = {
  nameAliases: {
    user: 'Report User',
    message: 'Report Message',
  },
};

export const chatInput = async () => {};
export const userContextMenu = async () => {};
export const messageContextMenu = async () => {};
