import Protected from "../components/Layouts/AuthLayout";
import DirectoryView from "../Pages/DirectoryView";
import UsersPage from "../Pages/UsersPage";

export const protectedRoutes = [
  {
    element: <Protected />,
    children: [
      {
        path: "/",
        element: <DirectoryView />,
      },
      {
        path: "/directory/:dirId",
        element: <DirectoryView />,
      },
      {
        path: "/home",
        element: <DirectoryView />,
      },
      {
        path: "/users",
        element: <UsersPage />,
      },
      {
        path: "/shared",
        element: <DirectoryView />,
      },
      {
        path: "/trash",
        element: <DirectoryView />,
      },
      {
        path: "/trash/directory/:dirId",
        element: <DirectoryView />,
      },
    ],
  },
];
