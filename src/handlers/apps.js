const { createApp, deleteApp } = require('../services/apps');

function getChannelId(view) {
  try {
    return JSON.parse(view.private_metadata || '{}').channelId || null;
  } catch {
    return null;
  }
}

async function notifyUser(client, channelId, userId, text) {
  if (!channelId || !userId) {
    return;
  }

  await client.chat.postEphemeral({
    channel: channelId,
    user: userId,
    text,
  });
}

module.exports = (app) => {
  app.view('add_app_modal', async ({ ack, view, body, client }) => {
    const name = view.state.values.app_name.app_name_input.value?.trim();

    if (!name) {
      await ack({
        response_action: 'errors',
        errors: {
          app_name: 'Please enter an app or service name',
        },
      });
      return;
    }

    await ack();

    const channelId = getChannelId(view);

    try {
      const appRow = await createApp(name);

      console.log('App created:', appRow);

      await notifyUser(
        client,
        channelId,
        body.user.id,
        `:white_check_mark: App *${appRow.name}* was added.`,
      );
    } catch (error) {
      console.error('[apps] Failed to create app:', error.message || error);

      const isDuplicate = error.code === '23505' || /duplicate|unique/i.test(error.message || '');

      try {
        await notifyUser(
          client,
          channelId,
          body.user.id,
          isDuplicate
            ? `:warning: An app named *${name}* already exists.`
            : ':warning: Failed to add the app. Please try again.',
        );
      } catch (notifyError) {
        console.error('[apps] Failed to notify user:', notifyError.message);
      }
    }
  });

  app.view('delete_app_modal', async ({ ack, view, body, client }) => {
    await ack();

    const channelId = getChannelId(view);
    const appId = view.state.values.app.app_select.selected_option.value;
    const appName = view.state.values.app.app_select.selected_option.text?.text || 'selected app';

    try {
      const deleted = await deleteApp(appId);

      console.log('App deleted:', deleted);

      await notifyUser(
        client,
        channelId,
        body.user.id,
        `:white_check_mark: App *${deleted.name}* was deleted.`,
      );
    } catch (error) {
      console.error('[apps] Failed to delete app:', error.message || error);

      const isInUse =
        error.code === '23503' || /foreign key|violates foreign key/i.test(error.message || '');

      try {
        await notifyUser(
          client,
          channelId,
          body.user.id,
          isInUse
            ? `:warning: Cannot delete *${appName}* because it is used by existing deployment requests.`
            : ':warning: Failed to delete the app. Please try again.',
        );
      } catch (notifyError) {
        console.error('[apps] Failed to notify user:', notifyError.message);
      }
    }
  });
};
