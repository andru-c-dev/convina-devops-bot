const { supabase } = require('../db/supabase');

const TABLE = 'deployment_requests';

const TICKET_SELECT = `
  id,
  ticket_number,
  service,
  environment,
  batch_start,
  batch_end,
  description,
  requested_by,
  status,
  channel_id,
  message_ts,
  created_at,
  updated_at,
  app_id,
  apps (
    id,
    name
  )
`;

async function createDeploymentRequest({
  appId,
  environment,
  batchStart,
  batchEnd,
  description,
  requestedBy,
  channelId,
}) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      app_id: appId,
      environment,
      batch_start: batchStart,
      batch_end: batchEnd,
      description: description || null,
      requested_by: requestedBy,
      channel_id: channelId || null,
      status: 'pending',
    })
    .select(TICKET_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function updateDeploymentRequest(id, updates) {
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(TICKET_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function getDeploymentRequest(id) {
  const { data, error } = await supabase.from(TABLE).select(TICKET_SELECT).eq('id', id).single();

  if (error) {
    throw error;
  }

  return data;
}

async function listOpenDeploymentRequests({ limit = 20 } = {}) {
  const { data, error } = await supabase
    .from(TABLE)
    .select(TICKET_SELECT)
    .in('status', ['pending', 'approved'])
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data || [];
}

async function listCompletedDeploymentRequests({ limit = 20 } = {}) {
  const { data, error } = await supabase
    .from(TABLE)
    .select(TICKET_SELECT)
    .eq('status', 'completed')
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data || [];
}

module.exports = {
  createDeploymentRequest,
  updateDeploymentRequest,
  getDeploymentRequest,
  listOpenDeploymentRequests,
  listCompletedDeploymentRequests,
};
