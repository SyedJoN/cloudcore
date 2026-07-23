import OptionalAuth from "../components/Layouts/OptionalAuthLayout";
import FileViewPage from "../Pages/FileViewPage";
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
