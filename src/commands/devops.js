const { ensureBotInChannel } = require('../utils/channel');

module.exports = (app) => {
  app.command('/devops', async ({ ack, respond, client, command, context }) => {
    await ack();

    try {
      const inChannel = await ensureBotInChannel({
        client,
        channelId: command.channel_id,
        respond,
        botUserId: context.botUserId,
      });

      if (!inChannel) {
        return;
      }

      await respond({
        response_type: 'ephemeral',
        text: 'DevOps actions',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*What would you like to do?*',
            },
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Create Deployment Request',
                },
                style: 'primary',
                action_id: 'create_deployment_request',
              },
            ],
          },
        ],
      });
    } catch (error) {
      console.error('[devops] Command failed:', error.data?.error || error.message);

      try {
        await respond({
          response_type: 'ephemeral',
          text: ':warning: Something went wrong running `/devops`. Please try again in a moment.',
        });
      } catch (respondError) {
        console.error('[devops] Failed to send error message:', respondError.message);
      }
    }
  });
};
