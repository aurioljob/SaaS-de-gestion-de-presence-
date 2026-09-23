import { supabase } from '../config/supabase.js';

const activeChannels = new Map();

function createChannel(name, configure) {
  const previous = activeChannels.get(name);
  if (previous) supabase.removeChannel(previous);

  const channel = configure(supabase.channel(name));
  activeChannels.set(name, channel);
  return channel;
}

export function subscribeToAttendance(companyId, callback) {
  return createChannel(`attendance-${companyId}`, (channel) => channel
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'attendance',
      filter: `company_id=eq.${companyId}`,
    }, (payload) => callback(payload))
    .subscribe());
}

export function subscribeToEvents(companyId, callback) {
  const channel = supabase
    .channel(`events-${companyId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'attendance_events',
    }, (payload) => callback(payload))
    .subscribe();
  return channel;
}

export function subscribeToNotifications(userId, callback) {
  const channel = supabase
    .channel(`notifications-${userId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`,
    }, (payload) => callback(payload))
    .subscribe();
  return channel;
}

export function unsubscribe(channel) {
  if (!channel) return;
  for (const [name, activeChannel] of activeChannels) {
    if (activeChannel === channel) activeChannels.delete(name);
  }
  supabase.removeChannel(channel);
}