import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

const isExperienceAlias = /^\/experience\/?$/.test(window.location.pathname)

if (isExperienceAlias) {
  window.location.replace(`/experience/index.html${window.location.search}${window.location.hash}`)
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
