const { listApps } = require('../services/apps');

module.exports = (app) => {
  app.command('/dv-add-app', async ({ ack, body, client, command }) => {
    await ack();

    try {
      await client.views.open({
        trigger_id: body.trigger_id,
        view: {
          type: 'modal',
          callback_id: 'add_app_modal',
          private_metadata: JSON.stringify({ channelId: command.channel_id }),
          title: { type: 'plain_text', text: 'Add App' },
          submit: { type: 'plain_text', text: 'Add' },
          close: { type: 'plain_text', text: 'Cancel' },
          blocks: [
            {
              type: 'input',
              block_id: 'app_name',
              label: { type: 'plain_text', text: 'App / Service name' },
              element: {
                type: 'plain_text_input',
                action_id: 'app_name_input',
                placeholder: { type: 'plain_text', text: 'e.g. Medsafe, API, Frontend' },
              },
            },
          ],
        },
      });
    } catch (error) {
      console.error('[apps] Failed to open add-app modal:', error.message || error);

      try {
        await client.chat.postEphemeral({
          channel: command.channel_id,
          user: body.user_id,
          text: ':warning: Could not open the Add App form. Please try again.',
        });
      } catch (notifyError) {
        console.error('[apps] Failed to notify user:', notifyError.message);
      }
    }
  });

  app.command('/dv-edit-app', async ({ ack, body, client, command, respond }) => {
    await ack();

    try {
      const apps = await listApps();

      if (!apps.length) {
        await respond({
          response_type: 'ephemeral',
          text: ':information_source: There are no apps to edit. Add one with `/dv-add-app` first.',
        });
        return;
      }

      const appOptions = apps.slice(0, 100).map((appRow) => ({
        text: {
          type: 'plain_text',
          text: appRow.name.slice(0, 75),
        },
        value: appRow.id,
      }));

      await client.views.open({
        trigger_id: body.trigger_id,
        view: {
          type: 'modal',
          callback_id: 'edit_app_modal',
          private_metadata: JSON.stringify({ channelId: command.channel_id }),
          title: { type: 'plain_text', text: 'Edit App' },
          submit: { type: 'plain_text', text: 'Save' },
          close: { type: 'plain_text', text: 'Cancel' },
          blocks: [
            {
              type: 'input',
              block_id: 'app',
              label: { type: 'plain_text', text: 'App / Service' },
              element: {
                type: 'static_select',
                action_id: 'app_select',
                placeholder: { type: 'plain_text', text: 'Select an app to rename' },
                options: appOptions,
              },
            },
            {
              type: 'input',
              block_id: 'app_name',
              label: { type: 'plain_text', text: 'New name' },
              element: {
                type: 'plain_text_input',
                action_id: 'app_name_input',
                placeholder: { type: 'plain_text', text: 'e.g. Medsafe, API, Frontend' },
              },
            },
          ],
        },
      });
    } catch (error) {
      console.error('[apps] Failed to open edit-app modal:', error.message || error);

      try {
        await respond({
          response_type: 'ephemeral',
          text: ':warning: Could not open the Edit App form. Please try again.',
        });
      } catch (respondError) {
        console.error('[apps] Failed to notify user:', respondError.message);
      }
    }
  });

  app.command('/dv-delete-app', async ({ ack, body, client, command, respond }) => {
    await ack();

    try {
      const apps = await listApps();

      if (!apps.length) {
        await respond({
          response_type: 'ephemeral',
          text: ':information_source: There are no apps to delete.',
        });
        return;
      }

      const appOptions = apps.slice(0, 100).map((appRow) => ({
        text: {
          type: 'plain_text',
          text: appRow.name.slice(0, 75),
        },
        value: appRow.id,
      }));

      await client.views.open({
        trigger_id: body.trigger_id,
        view: {
          type: 'modal',
          callback_id: 'delete_app_modal',
          private_metadata: JSON.stringify({ channelId: command.channel_id }),
          title: { type: 'plain_text', text: 'Delete App' },
          submit: { type: 'plain_text', text: 'Delete' },
          close: { type: 'plain_text', text: 'Cancel' },
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: ':warning: This permanently removes the app from the dropdown list.',
              },
            },
            {
              type: 'input',
              block_id: 'app',
              label: { type: 'plain_text', text: 'App / Service' },
              element: {
                type: 'static_select',
                action_id: 'app_select',
                placeholder: { type: 'plain_text', text: 'Select an app to delete' },
                options: appOptions,
              },
            },
          ],
        },
      });
    } catch (error) {
      console.error('[apps] Failed to open delete-app modal:', error.message || error);

      try {
        await respond({
          response_type: 'ephemeral',
          text: ':warning: Could not open the Delete App form. Please try again.',
        });
      } catch (respondError) {
        console.error('[apps] Failed to notify user:', respondError.message);
      }
    }
  });
};
