import Protected from "../AuthLayout";
import DirectoryView from "../DirectoryView";
import UsersPage from "../UsersPage";

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
