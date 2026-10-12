import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { handleGoogleRedirect } from './gcal'
import './index.css'

// Вернулись со страницы входа Google — забираем доступ к календарю из адреса
handleGoogleRedirect()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Офлайн-режим и установка на телефон
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
  })
}
