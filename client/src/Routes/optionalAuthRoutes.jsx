import OptionalAuth from "../Components/Layouts/OptionalAuthLayout";
import FileViewPage from "../Pages/FileViewPage";
import Home from "../Pages/Home";
import CookiePolicy from "../Pages/CookiePolicy";
import Licenses from "../Pages/Licenses";
import PrivacyPolicy from "../Pages/PrivacyPolicy";
import TermsAndConditions from "../Pages/TermsAndConditions";

export const optionalAuthRoutes = [
  {
    element: <OptionalAuth />,
    children: [
      {
        path: "/",
        element: <Home />,
      },
      {
        path: "/file/:fileId",
        element: <FileViewPage route='direct'/>,
      },
        {
        path: "/privacy",
        element: <PrivacyPolicy />,
      },
      {
        path: "/terms",
        element: <TermsAndConditions />,
      },
      {
        path: "/cookies",
        element: <CookiePolicy />,
      },
      {
        path: "/licenses",
        element: <Licenses />,
      },
    ],
  },
];
