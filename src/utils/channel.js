const CHANNEL_ACCESS_ERRORS = new Set(['not_in_channel', 'channel_not_found']);

function getSlackErrorCode(error) {
  return error?.data?.error;
}

async function isBotInChannel(client, channelId) {
  try {
    const { channel } = await client.conversations.info({ channel: channelId });
    return { inChannel: Boolean(channel?.is_member) };
  } catch (error) {
    const code = getSlackErrorCode(error);

    if (CHANNEL_ACCESS_ERRORS.has(code)) {
      return { inChannel: false };
    }

    if (code === 'missing_scope') {
      return { skipped: true };
    }

    throw error;
  }
}

async function tryJoinPublicChannel(client, channelId) {
  try {
    const { channel } = await client.conversations.info({ channel: channelId });
    if (channel?.is_private) {
      return false;
    }

    await client.conversations.join({ channel: channelId });
    return true;
  } catch (error) {
    const code = getSlackErrorCode(error);

    if (CHANNEL_ACCESS_ERRORS.has(code) || code === 'missing_scope') {
      return false;
    }

    throw error;
  }
}

function buildNotInChannelBlocks(botUserId) {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: ':warning: *I need to be added to this channel before I can help here.*',
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: [
          '*Option 1 — slash command*',
          `Run \`/invite <@${botUserId}>\` in this channel.`,
          '',
          '*Option 2 — channel settings*',
          'Open channel details → *Integrations* → *Add apps* → select this bot.',
        ].join('\n'),
      },
    },
  ];
}

async function ensureBotInChannel({ client, channelId, respond, botUserId }) {
  try {
    const membership = await isBotInChannel(client, channelId);

    if (membership.skipped) {
      console.warn(
        '[channel] Skipping membership check (missing OAuth scopes). ' +
          'Add channels:read and groups:read to enable it.',
      );
      return true;
    }

    if (membership.inChannel) {
      return true;
    }

    if (await tryJoinPublicChannel(client, channelId)) {
      return true;
    }

    await respond({
      response_type: 'ephemeral',
      text: 'This bot must be added to the channel before it can be used here.',
      blocks: buildNotInChannelBlocks(botUserId),
    });

    return false;
  } catch (error) {
    console.error('[channel] Membership check failed:', getSlackErrorCode(error) || error.message);

    try {
      await respond({
        response_type: 'ephemeral',
        text:
          ':warning: I could not verify channel access. ' +
          'If something does not work, add this bot with `/invite @YourBot`.',
      });
    } catch (respondError) {
      console.error('[channel] Failed to send fallback message:', respondError.message);
    }

    return true;
  }
}

module.exports = {
  ensureBotInChannel,
  buildNotInChannelBlocks,
};
