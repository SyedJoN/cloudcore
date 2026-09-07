export function redirectToGoogleDriveAuth(dirId = "") {
  const params = new URLSearchParams({
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    redirect_uri: "http://localhost:4000/auth/google-drive/callback",
    response_type: "code",
    access_type: "offline", // allows refresh token
    scope: "https://www.googleapis.com/auth/drive",
    prompt: "consent", // forces consent screen to get refresh token
  });
  if (dirId) {
    params.append("dirId", dirId);
  }
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}
