import PublicOnlyRoute from "../Components/Layouts/PublicOnlyLayout";
import CookiePolicy from "../Pages/CookiePolicy";
import Licenses from "../Pages/Licenses";
import Login from "../Pages/Login";
import PrivacyPolicy from "../Pages/PrivacyPolicy";
import Register from "../Pages/Register";
import TermsAndConditions from "../Pages/TermsAndConditions";

export const publicRoutes = [
  {
    element: <PublicOnlyRoute />,
    children: [
      {
        path: "/login",
        element: <Login />,
      },
      {
        path: "/register",
        element: <Register />,
      },
    
    ],
  },
];
