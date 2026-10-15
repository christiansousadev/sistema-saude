// servico de gestao de notificacoes do navegador e pwa

// VERIFICA SE O NAVEGADOR SUPORTA A API DE NOTIFICACOES
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

// RETORNA A PERMISSAO ATUAL DE NOTIFICACAO DO USUARIO
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported'
  return Notification.permission
}

// SOLICITA PERMISSAO DO USUARIO PARA ENVIO DE ALERTAS
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return 'denied'
  return await Notification.requestPermission()
}

// ENVIA UMA NOTIFICACAO LOCAL IMEDIATA VIA SERVICE WORKER OU API NATIVA
export async function sendLocalNotification(title: string, options?: NotificationOptions): Promise<boolean> {
  if (!isNotificationSupported()) return false

  let permission = Notification.permission
  if (permission === 'default') {
    permission = await Notification.requestPermission()
  }

  if (permission !== 'granted') return false

  const defaultOptions: NotificationOptions = {
    icon: '/globe.svg',
    badge: '/globe.svg',
    ...options,
  }

  // tenta disparar atraves do service worker ativo se disponivel
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready
      if (reg && reg.showNotification) {
        await reg.showNotification(title, defaultOptions)
        return true
      }
    } catch {
      // fallback para api direta de notificacao
    }
  }

  try {
    new Notification(title, defaultOptions)
    return true
  } catch {
    return false
  }
}
