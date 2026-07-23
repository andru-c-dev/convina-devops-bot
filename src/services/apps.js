const { supabase } = require('../db/supabase');

const TABLE = 'apps';

async function listApps() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, name')
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
}

async function getApp(id) {
  const { data, error } = await supabase.from(TABLE).select('id, name').eq('id', id).single();

  if (error) {
    throw error;
  }

  return data;
}

async function createApp(name) {
  const trimmed = String(name || '').trim();

  if (!trimmed) {
    const error = new Error('App name is required');
    error.code = 'validation_error';
    throw error;
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ name: trimmed })
    .select('id, name')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function updateApp(id, name) {
  const trimmed = String(name || '').trim();

  if (!trimmed) {
    const error = new Error('App name is required');
    error.code = 'validation_error';
    throw error;
  }

  const { data, error } = await supabase
    .from(TABLE)
    .update({ name: trimmed })
    .eq('id', id)
    .select('id, name')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function deleteApp(id) {
  const { data, error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id)
    .select('id, name')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

module.exports = {
  listApps,
  getApp,
  createApp,
  updateApp,
  deleteApp,
};
