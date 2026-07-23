const { listApps } = require('../services/apps');
const {
  createDeploymentRequest,
  updateDeploymentRequest,
  getDeploymentRequest,
  listOpenDeploymentRequests,
  listCompletedDeploymentRequests,
} = require('../services/deploymentRequests');

function ticketLabel(ticket) {
  return `DEP-${ticket.ticket_number}`;
}

function formatBatchDate(isoDate) {
  const normalized = String(isoDate).slice(0, 10);
  const date = new Date(`${normalized}T00:00:00`);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatBatchRange(startIso, endIso) {
  if (!startIso || !endIso) {
    return 'N/A';
  }

  const startNormalized = String(startIso).slice(0, 10);
  const endNormalized = String(endIso).slice(0, 10);

  const start = new Date(`${startNormalized}T00:00:00`);
  const end = new Date(`${endNormalized}T00:00:00`);

  const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
  const startDay = start.getDate();
  const endDay = end.getDate();
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();

  if (startNormalized === endNormalized) {
    return formatBatchDate(startNormalized);
  }

  if (startYear === endYear && startMonth === endMonth) {
    return `${startMonth} ${startDay} - ${endDay}, ${startYear}`;
  }

  if (startYear === endYear) {
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${startYear}`;
  }

  return `${formatBatchDate(startNormalized)} - ${formatBatchDate(endNormalized)}`;
}

function getTicketBatchLabel(ticket) {
  if (ticket.batch_start && ticket.batch_end) {
    return formatBatchRange(ticket.batch_start, ticket.batch_end);
  }

  // Fallback for older rows that still only have free-text `batch`
  return ticket.batch || 'N/A';
}

function getTicketAppName(ticket) {
  return ticket.apps?.name || ticket.service || 'N/A';
}

function formatStatus(status) {
  const styles = {
    pending: { emoji: ':large_blue_circle:', label: 'PENDING' },
    approved: { emoji: ':large_green_circle:', label: 'APPROVED' },
    rejected: { emoji: ':red_circle:', label: 'REJECTED' },
    deployed: { emoji: ':large_green_circle:', label: 'DEPLOYED' },
    cancelled: { emoji: ':white_circle:', label: 'CANCELLED' },
    completed: { emoji: ':white_check_mark:', label: 'COMPLETED' },
  };

  const style = styles[status] || { emoji: ':large_blue_circle:', label: String(status).toUpperCase() };
  return `${style.emoji}  *\`${style.label}\`*`;
}

function buildTicketBlocks(ticket, { showActions = false, actionSource = 'detail' } = {}) {
  const label = ticketLabel(ticket);
  const isCompleted = ticket.status === 'completed';
  const requestedBy = ticket.requested_by ? `<@${ticket.requested_by}>` : 'Unknown';

  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: [
          isCompleted
            ? `:white_check_mark: *Deployment request completed*`
            : `:bell: *New deployment request*`,
          `*Ticket:* \`${label}\``,
          `*App/Service:* ${getTicketAppName(ticket)}`,
          `*Environment:* ${ticket.environment}`,
          `*Batch:* \`${getTicketBatchLabel(ticket)}\``,
          `*Requested by:* ${requestedBy}`,
        ].join('\n'),
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Status*\n${formatStatus(ticket.status)}`,
      },
    },
  ];

  if (showActions && !isCompleted) {
    blocks.push({
      type: 'actions',
      block_id: `deployment_ticket_actions_${ticket.id}`,
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Mark as Completed' },
          style: 'primary',
          action_id: 'deployment_mark_completed',
          value: JSON.stringify({ id: ticket.id, source: actionSource }),
          confirm: {
            title: { type: 'plain_text', text: 'Mark as completed?' },
            text: {
              type: 'mrkdwn',
              text: `Mark ticket \`${label}\` as completed?`,
            },
            confirm: { type: 'plain_text', text: 'Yes, complete it' },
            deny: { type: 'plain_text', text: 'Cancel' },
          },
        },
      ],
    });
  }

  return blocks;
}

async function publishTicketToChannel(client, ticket, channelId) {
  const label = ticketLabel(ticket);
  const result = await client.chat.postMessage({
    channel: channelId,
    text: `New deployment request ${label} from <@${ticket.requested_by}>`,
    blocks: buildTicketBlocks(ticket, { showActions: true, actionSource: 'channel' }),
  });

  if (result.ts) {
    await updateDeploymentRequest(ticket.id, {
      message_ts: result.ts,
      channel_id: channelId,
    });
  }

  return result;
}

async function refreshChannelTicketMessage(client, ticket) {
  if (!ticket.channel_id || !ticket.message_ts) {
    return;
  }

  await client.chat.update({
    channel: ticket.channel_id,
    ts: ticket.message_ts,
    text: `Deployment request ${ticketLabel(ticket)} — ${ticket.status}`,
    blocks: buildTicketBlocks(ticket, {
      showActions: ticket.status !== 'completed',
      actionSource: 'channel',
    }),
  });
}

function buildRequestsListBlocks(
  tickets,
  {
    title,
    emptyMessage,
    showCompleteActions = false,
  } = {},
) {
  if (!tickets.length) {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: emptyMessage || ':information_source: *No requests found.*',
        },
      },
    ];
  }

  const headerRows = [
    '*Ticket* | *App* | *Env* | *Batch* | *Status*',
    '--- | --- | --- | --- | ---',
  ];

  const dataRows = tickets.map((ticket) => {
    const statusLabel = String(ticket.status || '').toUpperCase();
    return [
      `\`${ticketLabel(ticket)}\``,
      getTicketAppName(ticket),
      ticket.environment,
      getTicketBatchLabel(ticket),
      statusLabel,
    ].join(' | ');
  });

  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${title} (${tickets.length})`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: ['```', ...headerRows, ...dataRows, '```'].join('\n'),
      },
    },
  ];

  if (!showCompleteActions) {
    return blocks;
  }

  const actionable = tickets.slice(0, 8);

  for (const ticket of actionable) {
    const label = ticketLabel(ticket);
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${label}* · ${getTicketAppName(ticket)} · ${formatStatus(ticket.status)}`,
      },
      accessory: {
        type: 'button',
        text: { type: 'plain_text', text: 'Complete' },
        style: 'primary',
        action_id: 'deployment_mark_completed',
        value: JSON.stringify({ id: ticket.id, source: 'list' }),
        confirm: {
          title: { type: 'plain_text', text: 'Mark as completed?' },
          text: {
            type: 'mrkdwn',
            text: `Mark ticket \`${label}\` as completed?`,
          },
          confirm: { type: 'plain_text', text: 'Yes, complete it' },
          deny: { type: 'plain_text', text: 'Cancel' },
        },
      },
    });
  }

  if (tickets.length > actionable.length) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `_Showing actions for the first ${actionable.length} of ${tickets.length} open requests._`,
        },
      ],
    });
  }

  return blocks;
}

function buildOpenRequestsBlocks(tickets) {
  return buildRequestsListBlocks(tickets, {
    title: ':clipboard: *Open deployment requests*',
    emptyMessage: ':information_source: *No open deployment requests.*',
    showCompleteActions: true,
  });
}

function buildCompletedRequestsBlocks(tickets) {
  const blocks = buildRequestsListBlocks(tickets, {
    title: ':white_check_mark: *Completed deployment requests*',
    emptyMessage: ':information_source: *No completed deployment requests.*',
    showCompleteActions: false,
  });

  if (tickets.length) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: ':information_source: Showing only the *last 5* completed requests.',
        },
      ],
    });
  }

  return blocks;
}

function parseMarkCompletedValue(rawValue) {
  try {
    const parsed = JSON.parse(rawValue);
    if (parsed?.id) {
      return {
        ticketId: parsed.id,
        source: parsed.source || 'detail',
      };
    }
  } catch {
    // Legacy buttons stored a bare UUID
  }

  return {
    ticketId: rawValue,
    source: 'detail',
  };
}

module.exports = (app) => {
  app.action('create_deployment_request', async ({ ack, body, client }) => {
    await ack();

    const channelId = body.channel?.id || body.container?.channel_id || null;

    try {
      const apps = await listApps();

      if (!apps.length) {
        if (channelId) {
          await client.chat.postEphemeral({
            channel: channelId,
            user: body.user.id,
            text: ':warning: No apps are configured yet. Add rows to the `apps` table in Supabase, then try again.',
          });
        }
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
          callback_id: 'deployment_request_modal',
          private_metadata: JSON.stringify({ channelId }),
          title: { type: 'plain_text', text: 'Deployment Request' },
          submit: { type: 'plain_text', text: 'Submit' },
          close: { type: 'plain_text', text: 'Cancel' },
          blocks: [
            {
              type: 'input',
              block_id: 'app',
              label: { type: 'plain_text', text: 'App/Service' },
              element: {
                type: 'static_select',
                action_id: 'app_select',
                placeholder: { type: 'plain_text', text: 'Select an app' },
                options: appOptions,
              },
            },
            {
              type: 'input',
              block_id: 'environment',
              label: { type: 'plain_text', text: 'Environment' },
              element: {
                type: 'static_select',
                action_id: 'environment_select',
                placeholder: { type: 'plain_text', text: 'Select environment' },
                options: [
                  { text: { type: 'plain_text', text: 'Staging' }, value: 'staging' },
                  { text: { type: 'plain_text', text: 'Production' }, value: 'production' },
                ],
              },
            },
            {
              type: 'input',
              block_id: 'batch_start',
              label: { type: 'plain_text', text: 'Batch start' },
              element: {
                type: 'datepicker',
                action_id: 'batch_start_date',
                placeholder: { type: 'plain_text', text: 'Select start date' },
              },
            },
            {
              type: 'input',
              block_id: 'batch_end',
              label: { type: 'plain_text', text: 'Batch end' },
              element: {
                type: 'datepicker',
                action_id: 'batch_end_date',
                placeholder: { type: 'plain_text', text: 'Select end date' },
              },
            },
            {
              type: 'input',
              block_id: 'description',
              optional: true,
              label: { type: 'plain_text', text: 'Description' },
              element: {
                type: 'plain_text_input',
                action_id: 'description_input',
                multiline: true,
                placeholder: { type: 'plain_text', text: 'What is being deployed and why?' },
              },
            },
          ],
        },
      });
    } catch (error) {
      console.error('[deployment] Failed to open modal:', error.message || error);

      if (channelId) {
        try {
          await client.chat.postEphemeral({
            channel: channelId,
            user: body.user.id,
            text: ':warning: Could not load apps for the deployment form. Please try again.',
          });
        } catch (notifyError) {
          console.error('[deployment] Failed to notify user:', notifyError.message);
        }
      }
    }
  });

  app.view('deployment_request_modal', async ({ ack, view, body, client }) => {
    const values = view.state.values;
    const batchStart = values.batch_start.batch_start_date.selected_date;
    const batchEnd = values.batch_end.batch_end_date.selected_date;

    if (batchStart && batchEnd && batchEnd < batchStart) {
      await ack({
        response_action: 'errors',
        errors: {
          batch_end: 'End date must be on or after the start date',
        },
      });
      return;
    }

    await ack();

    let channelId = null;

    try {
      channelId = JSON.parse(view.private_metadata || '{}').channelId || null;
    } catch {
      channelId = null;
    }

    const request = {
      appId: values.app.app_select.selected_option.value,
      environment: values.environment.environment_select.selected_option.value,
      batchStart,
      batchEnd,
      description: values.description.description_input.value,
      requestedBy: body.user.id,
      channelId,
    };

    try {
      const ticket = await createDeploymentRequest(request);
      const label = ticketLabel(ticket);

      console.log('Deployment request created:', { id: ticket.id, label, ...request });

      if (channelId) {
        try {
          await publishTicketToChannel(client, ticket, channelId);
        } catch (notifyError) {
          console.error('[deployment] Failed to post channel message:', notifyError.data?.error || notifyError.message);

          // Fallback so the creator still gets feedback if the bot isn't in the channel
          await client.chat.postEphemeral({
            channel: channelId,
            user: body.user.id,
            text:
              `:warning: Ticket \`${label}\` was created, but I couldn't post it in this channel. ` +
              'Invite the bot with `/invite @Convina DevOps` (or add the app in channel Integrations), then try again.',
          });
        }
      }
    } catch (error) {
      console.error('[deployment] Failed to create request:', error.message || error);

      if (channelId) {
        try {
          await client.chat.postEphemeral({
            channel: channelId,
            user: body.user.id,
            text: ':warning: Failed to create the deployment request. Please try again.',
          });
        } catch (notifyError) {
          console.error('[deployment] Failed to notify user:', notifyError.message);
        }
      }
    }
  });

  app.action('list_open_deployment_requests', async ({ ack, respond }) => {
    await ack();

    try {
      const tickets = await listOpenDeploymentRequests({ limit: 20 });

      console.log('[deployment] Open requests listed:', tickets.length);

      await respond({
        replace_original: false,
        response_type: 'ephemeral',
        text: `Open deployment requests (${tickets.length})`,
        blocks: buildOpenRequestsBlocks(tickets),
      });
    } catch (error) {
      console.error('[deployment] Failed to list open requests:', error.message || error);

      await respond({
        replace_original: false,
        response_type: 'ephemeral',
        text: ':warning: Failed to load open deployment requests. Please try again.',
      });
    }
  });

  app.action('list_completed_deployment_requests', async ({ ack, respond }) => {
    await ack();

    try {
      const tickets = await listCompletedDeploymentRequests({ limit: 5 });

      console.log('[deployment] Completed requests listed:', tickets.length);

      await respond({
        replace_original: false,
        response_type: 'ephemeral',
        text: `Completed deployment requests (${tickets.length})`,
        blocks: buildCompletedRequestsBlocks(tickets),
      });
    } catch (error) {
      console.error('[deployment] Failed to list completed requests:', error.message || error);

      await respond({
        replace_original: false,
        response_type: 'ephemeral',
        text: ':warning: Failed to load completed deployment requests. Please try again.',
      });
    }
  });

  app.action('deployment_mark_completed', async ({ ack, body, respond, client }) => {
    await ack();

    const { ticketId, source } = parseMarkCompletedValue(body.actions?.[0]?.value);

    try {
      const existing = await getDeploymentRequest(ticketId);

      if (existing.status === 'completed') {
        if (source === 'list') {
          const tickets = await listOpenDeploymentRequests({ limit: 20 });
          await respond({
            replace_original: true,
            text: `Open deployment requests (${tickets.length})`,
            blocks: buildOpenRequestsBlocks(tickets),
          });
          return;
        }

        await respond({
          replace_original: true,
          text: `Ticket ${ticketLabel(existing)} is already completed`,
          blocks: buildTicketBlocks(existing, { showActions: false }),
        });
        return;
      }

      const ticket = await updateDeploymentRequest(ticketId, { status: 'completed' });

      console.log('Deployment request completed:', {
        id: ticket.id,
        label: ticketLabel(ticket),
      });

      try {
        await refreshChannelTicketMessage(client, ticket);
      } catch (updateError) {
        console.error(
          '[deployment] Failed to update channel message:',
          updateError.data?.error || updateError.message,
        );
      }

      if (source === 'list') {
        const tickets = await listOpenDeploymentRequests({ limit: 20 });
        await respond({
          replace_original: true,
          text: `Open deployment requests (${tickets.length})`,
          blocks: buildOpenRequestsBlocks(tickets),
        });
        return;
      }

      if (source === 'channel') {
        // Channel message already updated above
        return;
      }

      await respond({
        replace_original: true,
        text: `Completed deployment request ${ticketLabel(ticket)}`,
        blocks: buildTicketBlocks(ticket, { showActions: false }),
      });
    } catch (error) {
      console.error('[deployment] Failed to mark completed:', error.message || error);

      await respond({
        replace_original: false,
        response_type: 'ephemeral',
        text: ':warning: Failed to mark the ticket as completed. Please try again.',
      });
    }
  });
};
