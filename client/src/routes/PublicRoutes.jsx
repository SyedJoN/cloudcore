import PublicOnlyRoute from "../components/PublicOnlyLayout";
import Login from "../Login";
import Register from "../Register";

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
