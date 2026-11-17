
export async function fetchGithubUser(code) {
  const tokenResponse = await fetch(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${process.env.SERVER_URL}/auth/github/callback`,
      }),
    }
  );

  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok || !tokenData.access_token) {
    throw new Error(
      tokenData.error_description || "Failed to authenticate with GitHub"
    );
  }

  const accessToken = tokenData.access_token;

  // Fetch GitHub profile
  const userResponse = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
    },
  });

  const githubUser = await userResponse.json();

  if (!userResponse.ok) {
    throw new Error(githubUser.message || "Failed to fetch GitHub profile");
  }

  // Fetch GitHub emails
  const emailResponse = await fetch("https://api.github.com/user/emails", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
    },
  });

  const userEmails = await emailResponse.json();

  if (!emailResponse.ok) {
    throw new Error(
      userEmails.message || "Failed to fetch GitHub email"
    );
  }

  // Ensure response is an array
  if (!Array.isArray(userEmails)) {
    throw new Error("Invalid response from GitHub email API");
  }

  const primaryEmail =
    userEmails.find((e) => e.primary && e.verified)?.email ||
    userEmails.find((e) => e.verified)?.email ||
    null;

  return {
    ...githubUser,
    email: primaryEmail,
  };
}
