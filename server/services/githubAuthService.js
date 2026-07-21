
export async function fetchGithubUser(code) {
const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: "http://localhost:5173/auth/github/callback"
    }),
  });

  const tokenData = await tokenResponse.json();
  const accessToken = tokenData.access_token;

  // Fetch user info from GitHub
  const userResponse = await fetch("https://api.github.com/user", {
    headers: { Authorization: `token ${accessToken}` },
  });
  const githubUser = await userResponse.json();

 const emailResponse = await fetch("https://api.github.com/user/emails", {
    headers: { Authorization: `token ${accessToken}` },
  });
  const userEmails = await emailResponse.json();
  const primaryEmail = userEmails.find(e => e.primary)?.email || userEmails[0]?.email;
  return {...githubUser, email: primaryEmail}
}