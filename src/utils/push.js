// Infrastructure de notifications push
// Prêt pour OneSignal — active-le quand tu auras un compte

let permission = 'default';

export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.warn('Notifications non supportées');
    return false;
  }

  if (Notification.permission === 'granted') {
    permission = 'granted';
    return true;
  }

  if (Notification.permission === 'denied') {
    permission = 'denied';
    return false;
  }

  const result = await Notification.requestPermission();
  permission = result;
  return result === 'granted';
}

export async function showLocalNotification(title, options = {}) {
  if (permission !== 'granted') return;
  const reg = await navigator.serviceWorker?.ready;
  if (reg) {
    reg.showNotification(title, {
      body: options.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: options.tag || 'pointify',
      data: { url: options.url || '/my-dashboard' },
    });
  } else {
    new Notification(title, { body: options.body });
  }
}

// Exemple d'appel après un pointage réussi :
// showLocalNotification('Pointage enregistré', { body: 'Arrivée à 08:03', tag: 'check-in' });