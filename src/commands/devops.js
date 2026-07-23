module.exports = (app) => {
  app.command('/dv-release', async ({ ack, respond }) => {
    // Ack immediately — Slack requires a response within ~3s
    await ack();

    console.log('[dv-release] Command received');

    try {
      // respond() works without the bot being in the channel
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
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Open Requests',
                },
                action_id: 'list_open_deployment_requests',
              },
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Completed Requests',
                },
                action_id: 'list_completed_deployment_requests',
              },
            ],
          },
        ],
      });
    } catch (error) {
      console.error('[dv-release] Command failed:', error.data?.error || error.message);

      try {
        await respond({
          response_type: 'ephemeral',
          text: ':warning: Something went wrong running `/dv-release`. Please try again in a moment.',
        });
      } catch (respondError) {
        console.error('[dv-release] Failed to send error message:', respondError.message);
      }
    }
  });
};
