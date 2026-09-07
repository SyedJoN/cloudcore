import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: `${import.meta.env.VITE_BACKEND_BASE_URL}/auth/google-drive/callback`
});

export async function fetchUserUsingIdToken(idToken) {
  try {
    const loginTicket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    return loginTicket.getPayload();
  } catch (error) {
    console.log(error);
    throw new Error("Failed to verify Google token");
  }
}
export async function fetchTokenForDrive(code) {
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  return { accessToken: tokens.access_token };
}
