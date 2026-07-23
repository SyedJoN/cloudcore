

function GithubLoginBtn({ setServerError }) {

  const params = new URLSearchParams({
    client_id: import.meta.env.VITE_GITHUB_CLIENT_ID,
    redirect_uri: "http://localhost:4000/auth/github/callback",
    scope: "read:user user:email",
  });

  return (
    <a
      style={{ textDecoration: "none" }}
      href={`https://github.com/login/oauth/authorize?${params}`}
    >
      <div className="git-div">
        <div className="git-svg">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.387.6.113.82-.26.82-.577v-2.234c-3.338.726-4.033-1.61-4.033-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.746.082-.73.082-.73 1.205.084 1.84 1.237 1.84 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.775.418-1.305.76-1.605-2.665-.304-5.466-1.332-5.466-5.932 0-1.31.468-2.382 1.235-3.22-.124-.303-.536-1.523.117-3.176 0 0 1.008-.322 3.3 1.23a11.52 11.52 0 013.003-.403c1.018.005 2.043.138 3.003.403 2.29-1.552 3.297-1.23 3.297-1.23.655 1.653.243 2.873.12 3.176.77.838 1.234 1.91 1.234 3.22 0 4.61-2.805 5.625-5.475 5.922.43.372.815 1.103.815 2.222v3.293c0 .32.218.694.825.576C20.565 21.796 24 17.3 24 12c0-6.63-5.37-12-12-12z" />
          </svg>
        </div>

        <span className="github-text">Continue with GitHub</span>
        <div className="github-overlay"></div>
      </div>
    </a>
  );
}

export default GithubLoginBtn;
