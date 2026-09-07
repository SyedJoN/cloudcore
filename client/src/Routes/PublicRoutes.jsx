import PublicOnlyRoute from "../Components/Layouts/PublicOnlyLayout";
import Login from "../Pages/Login";
import Register from "../Pages/Register";

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
