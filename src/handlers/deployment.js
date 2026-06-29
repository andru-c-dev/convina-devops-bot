module.exports = (app) => {
  app.action('create_deployment_request', async ({ ack, body, client }) => {
    await ack();

    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'deployment_request_modal',
        title: { type: 'plain_text', text: 'Deployment Request' },
        submit: { type: 'plain_text', text: 'Submit' },
        close: { type: 'plain_text', text: 'Cancel' },
        blocks: [
          {
            type: 'input',
            block_id: 'service',
            label: { type: 'plain_text', text: 'Service' },
            element: {
              type: 'plain_text_input',
              action_id: 'service_input',
              placeholder: { type: 'plain_text', text: 'e.g. api, frontend, worker' },
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
            block_id: 'branch',
            label: { type: 'plain_text', text: 'Branch' },
            element: {
              type: 'plain_text_input',
              action_id: 'branch_input',
              placeholder: { type: 'plain_text', text: 'e.g. main, release/1.0' },
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
  });

  app.view('deployment_request_modal', async ({ ack, view, body }) => {
    await ack();

    const values = view.state.values;
    const request = {
      service: values.service.service_input.value,
      environment: values.environment.environment_select.selected_option.value,
      branch: values.branch.branch_input.value,
      description: values.description.description_input.value,
      requestedBy: body.user.id,
    };

    console.log('Deployment request submitted:', request);
    // TODO: notify a channel, trigger CI/CD, persist to DB, etc.
  });
};
