import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google';
import "./App.css"
import App from './App.jsx'

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

if (!clientId) {
  throw new Error("Missing Google Client ID in env");
}
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={clientId}>
    <App />
    </GoogleOAuthProvider>
  </StrictMode>,
)
