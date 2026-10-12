import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const SUPABASE = 'qtguhxlhiujcfywxnftu.supabase.co'

/**
 * Политика безопасности (CSP): браузер запускает только скрипты самого приложения
 * и ходит в сеть только к Supabase и Google. Даже если в данные попадёт чужой код,
 * браузер его не выполнит и никуда не отправит.
 * Только для сборки: в режиме разработки Vite вставляет свои служебные скрипты.
 */
function contentSecurityPolicy(): Plugin {
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    `connect-src 'self' https://${SUPABASE} wss://${SUPABASE} https://www.googleapis.com https://fonts.googleapis.com https://fonts.gstatic.com`,
    "manifest-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
  return {
    name: 'content-security-policy',
    apply: 'build',
    // Сразу после кодировки страницы — до любых скриптов и стилей
    transformIndexHtml: html =>
      html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />` +
          '\n    <meta name="referrer" content="strict-origin-when-cross-origin" />',
      ),
  }
}

// На GitHub Pages сайт живёт по адресу /one-percent/
export default defineConfig({
  base: '/one-percent/',
  plugins: [react(), contentSecurityPolicy()],
})
