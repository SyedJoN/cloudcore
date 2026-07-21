import { GoogleLogin } from "@react-oauth/google";
import { useNavigate } from "react-router-dom";
import { fetchUserDetails } from "../../apis/authApi";
import { useAuth } from "../Contexts/AuthContext";
import { createSubscription } from "../../apis/subscriptionApi";

function GoogleLoginBtn({ setServerError, priceId }) {
  console.log("priceId", priceId);
  const navigate = useNavigate();
  const {setLoggedIn} = useAuth()

 
  return (
    <GoogleLogin
      onSuccess={async (credentialResponse) => {
        try {
          const response = await fetchUserDetails(
            credentialResponse.credential,
            setServerError,
          );
          if (response.status === 200) {
            
            setServerError("");
            setLoggedIn(true);

            if (priceId) {
              const data = await createSubscription({ priceId });
              if (data.message) {
                toast({ message: data.message, type: "warning" });
                return;
              }
              window.location.href = data.url;
              return;
            }
            navigate("/");
          }
        } catch (error) {
          const status = error.response?.status;

          if (status === 429) {
            setServerError("Too many requests. Please slow down.");
            return;
          }
          setServerError(error.message || "Error while fetching user details");
          setLoggedIn(false);
        }
        console.log("credentialResponse", credentialResponse);
      }}
      onError={(err) => {
        setServerError(err || "Error while logging google");
        console.log("Login Failed");
      }}
      useOneTap
      width={346}
      size="medium"
      text="continue_with"
      theme="outline"
    />
  );
}

export default GoogleLoginBtn;
