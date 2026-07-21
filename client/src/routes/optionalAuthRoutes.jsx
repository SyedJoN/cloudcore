import OptionalAuth from "../components/OptionalAuthLayout";
import FileViewPage from "../FileViewPage";
import Home from "../Pages/Home";

export const optionalAuthRoutes = [
  {
    element: <OptionalAuth />,
    children: [
      {
        path: "/main",
        element: <Home />,
      },
      {
        path: "/file/:fileId",
        element: <FileViewPage />,
      },
    ],
  },
];
