import { useState, useEffect, useRef } from "react";
import {
  deleteUserFromDB,
  fetchUsers,
  getCurrentUser,
  recoverUser,
  revokeUser,
  softDeleteUser,
  updateUser,
} from "../../apis/userApi.js";
import { useNavigate } from "react-router-dom";
import canAccess from "../../Utils/canAccess.js";
import CircularLoader from "../components/Loaders/CircularLoader.jsx";
import "../Styles/UsersPage.css";
import { getColor } from "../../Utils/getProfileColor.js";
import FileBrowser from "../components/File/FileBrowser.jsx";
import { Bars3Icon } from "@heroicons/react/24/solid";
import { useSidebar } from "../Contexts/SidebarContext.jsx";

const ROLE_OPTIONS = ["admin", "manager", "user"];

export default function UsersPage() {
  const { toggleSidebar } = useSidebar();
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState({});
  const [userData, setUserData] = useState([]);
  const [role, setRole] = useState({});
  const [isEditable, setIsEditable] = useState({});
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isFieldChanged, setIsFieldChanged] = useState(false);
  const [deletedUsers, setDeletedUsers] = useState([]);
  const [apiData, setApiData] = useState([]);
  const [showDeletedUsers, setShowDeletedUsers] = useState(false);
  const [hasError, setHasError] = useState(null);

  const [showFiles, setShowFiles] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef({});
  const dropdownRef = useRef(null);

  // ---------------- LOAD USERS ----------------
  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const data = await fetchUsers();

      if (!data.users?.length) return;
      setDeletedUsers(
        data.users
          .filter((u) => u.isDeleted)
          .map((user) => ({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            isLoggedIn: user.isLoggedIn,
            isDeleted: user.isDeleted,
          })),
      );

      setRole(
        data.users.reduce((acc, user) => {
          acc[user.id] = user.role;
          return acc;
        }, {}),
      );

      setUserData(
        data.users
          .filter((u) => !u.isDeleted)
          .map((user) => ({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            isLoggedIn: user.isLoggedIn,
            isDeleted: user.isDeleted,
          })),
      );
      setApiData(
        data.users
          .filter((u) => !u.isDeleted)
          .map((user) => ({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            isLoggedIn: user.isLoggedIn,
            isDeleted: user.isDeleted,
          })),
      );
    } catch (err) {
      console.log("err", err);
    } finally {
      setIsLoading(false);
    }
  };

  // ---------------- LOAD CURRENT USER ----------------
  const loadCurrentUser = async () => {
    try {
      const data = await getCurrentUser();
      if (!data) return navigate("/login");
      setCurrentUser(data);
    } catch {
      navigate("/login");
    }
  };

  useEffect(() => {
    loadUsers();
    loadCurrentUser();
  }, []);

  useEffect(() => {
    const editableId = Object.keys(isEditable)[0];

    const editedUser = userData.find((u) => u.id === editableId);
    const originalData = apiData.find((u) => u.id === editableId);

    const changed =
      editedUser?.name.trim() !== originalData?.name ||
      editedUser?.email.trim() !== originalData?.email ||
      (role[editableId] && role[editableId] !== originalData?.role);

    setIsFieldChanged(changed);
  }, [userData, role, isEditable]);

  // Auto focus first editable input
  useEffect(() => {
    const editableId = Object.keys(isEditable)[0];
    if (editableId && inputRef.current[editableId]) {
      inputRef.current[editableId].focus();
    }
  }, [isEditable]);

  // ---------------- ACTIONS ----------------

  const handleEdit = (id) => setIsEditable({ [id]: true });

  const handleCancel = () => {
    setIsEditable({});
    const editableId = Object.keys(isEditable)[0];

    const editedUser = userData.find((u) => u.id === editableId);
    const originalData = apiData.find((u) => u.id === editableId);

    const changed =
      editedUser?.name.trim() !== originalData?.name ||
      editedUser?.email.trim() !== originalData?.email ||
      (role[editableId] && role[editableId] !== originalData?.role);

    if (changed) {
      setUserData(apiData);
      setRole(
        apiData.reduce((acc, user) => {
          acc[user.id] = user.role;
          return acc;
        }, {}),
      );
    }
  };

  const handleChange = (e, id) => {
    const { name, value } = e.target;
    setUserData((prev) =>
      prev.map((u) => (u.id === id ? { ...u, [name]: value } : u)),
    );
  };

  const handleRoleChange = (e, id) => {
    setRole((prev) => ({ ...prev, [id]: e.target.value }));
  };

  const handleSubmit = async () => {
    const editableId = Object.keys(isEditable)[0];
    const editedUser = userData.find((u) => u.id === editableId);

    const payload = {
      ...editedUser,
      role: role[editableId],
    };

    const data = await updateUser(payload);
    setApiData((prev) =>
      prev.map((u) => (u.id === data.user.id ? { ...data.user } : u)),
    );
    setIsEditable({});
  };

  const softDelete = async (id) => {
    const user = userData.find((u) => u.id === id);
    if (!confirm(`Delete ${user.email}?`)) return;

    const data = await softDeleteUser(id);
    setUserData((prev) => prev.filter((u) => u.id !== id));

    setDeletedUsers((prev) => [...prev, data.user]);
  };

  const deleteUser = async (id) => {
    const user = deletedUsers.find((u) => u.id === id);
    if (!confirm(`Delete ${user.email} permanently from database?`)) return;

    await deleteUserFromDB(id);
    setDeletedUsers((prev) => prev.filter((u) => u.id !== id));
  };

  const handleRecover = async (id) => {
    const user = deletedUsers.find((u) => u.id === id);
    if (!confirm(`Reover ${user.email}?`)) return;

    const data = await recoverUser(id);

    setDeletedUsers((prev) => prev.filter((u) => u.id !== id));

    setUserData((prev) => [...prev, data.user]);
  };

  const logoutUser = async (id) => {
    await revokeUser(id);
    setUserData((prev) =>
      prev.map((u) => (u.id === id ? { ...u, isLoggedIn: false } : u)),
    );
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // ---------------- UI ----------------

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <aside className="sidebar">
        {/* <img src={currentUser.avatar}/> */}
        <div className="text-[var(--text-primary)] pl-5">
          <h2>{currentUser.role} Panel</h2>

          <ul>
            <li
              onClick={() => {
                setShowDeletedUsers(false);
                setShowFiles(false);
              }}
              className={`${!showDeletedUsers && !showFiles ? "active" : ""}`}
            >
              Users
            </li>
            {currentUser.role === "superuser" && (
              <li
                onClick={() => {
                  setShowDeletedUsers(true);
                  setIsEditable({});

                  setShowFiles(false);
                }}
                className={`${showDeletedUsers && !showFiles ? "active" : ""}`}
              >
                Deleted Users
              </li>
            )}
            {currentUser.role === "superuser" && (
              <li
                onClick={() => {
                  setShowFiles(true);
                  setShowDeletedUsers(false);
                  setIsEditable({});
                }}
                className={showFiles ? "active" : ""}
              >
                User Files
              </li>
            )}
          </ul>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main">
        {/* Topbar */}
        <div className="topbar">
          <div className="flex items-center">
            <h1>User Management</h1>
            <a
              className="hover:bg-[var(--btn-bg-medium)] md:hidden flex items-center decoration-0 p-2 rounded-full cursor-pointer"
              onClick={toggleSidebar}
            >
              <Bars3Icon width="25" height="25" color="var(--text-secondary)" />
            </a>
          </div>
          <div className="profile-section" ref={dropdownRef}>
            <div
              className="profile-trigger"
              onClick={() => setIsDropdownOpen((prev) => !prev)}
            >
              {currentUser.avatar && !hasError ? (
                <div className="avatar">
                  <img
                    alt={currentUser.name}
                    src={currentUser.avatar}
                    onError={() => setHasError(true)}
                  ></img>
                </div>
              ) : (
                <>
                  <span
                    className="dynamic-avatar"
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      width: 36,
                      height: 36,
                      padding: "8px",
                      borderRadius: "50px",
                      backgroundColor: getColor(currentUser.name),
                    }}
                  >
                    {currentUser.name?.charAt(0)}
                  </span>
                </>
              )}
              <div className="profile-info">
                <span className="profile-name">{currentUser.name}</span>
                <span className="profile-role">{currentUser.role}</span>
              </div>
            </div>

            {isDropdownOpen && (
              <div className="dropdown-menu">
                <div className="dropdown-item" onClick={() => navigate("/")}>
                  Home
                </div>
                <div
                  className="dropdown-item logout"
                  onClick={() => navigate("/login")}
                >
                  Logout
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Content Card */}
        <div className="card">
          {isLoading ? (
            <CircularLoader />
          ) : showFiles && currentUser.role === "superuser" ? (
            <FileBrowser />
          ) : !showDeletedUsers && currentUser.role !== "user" ? (
            <div className="table-wrapper">
              <table className="user-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody
                  
                >
                  {userData.length === 0 ? (
                    <tr >
                      <td colSpan={5}>No users found</td>
                    </tr>
                  ) : (
                    userData.map((user) => (
                      <tr className={`${!showDeletedUsers && userData.length > 0 ? "border-t border-[#eee]" : ""}`} key={user.id}>
                        <td>
                          <input
                            ref={(el) => (inputRef.current[user.id] = el)}
                            disabled={!isEditable[user.id]}
                            name="name"
                            value={user.name}
                            onChange={(e) => handleChange(e, user.id)}
                          />
                        </td>

                        <td>
                          <input
                            disabled={!isEditable[user.id]}
                            name="email"
                            value={user.email}
                            onChange={(e) => handleChange(e, user.id)}
                          />
                        </td>

                        <td>
                          <select
                            className="bg-[var(--surface-white)]"
                            value={role[user.id]}
                            disabled={
                              !canAccess(currentUser.role, user.role) ||
                              !isEditable[user.id]
                            }
                            onChange={(e) => handleRoleChange(e, user.id)}
                          >
                            {ROLE_OPTIONS.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td>
                          {user.isLoggedIn ? (
                            <span className="status online">● Online</span>
                          ) : (
                            <span className="status offline">● Offline</span>
                          )}
                        </td>

                        <td className="actions">
                          <button
                            type="button"
                            className="btn btn-warning"
                            onClick={() => logoutUser(user.id)}
                            disabled={
                              !user.isLoggedIn ||
                              !canAccess(currentUser.role, user.role)
                            }
                          >
                            Logout
                          </button>

                          {(currentUser.role === "admin" ||
                            currentUser.role === "superuser") && (
                            <>
                              <button
                                disabled={isEditable[user.id]}
                                className="btn btn-primary"
                                type="button"
                                onClick={() => handleEdit(user.id)}
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                className="btn btn-danger"
                                onClick={() => softDelete(user.id)}
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="user-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>

                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody
                
                >
                  {deletedUsers.length === 0 ? (
                    <tr className="flex flex-col">
                      <td colSpan={5}>No users found</td>
                    </tr>
                  ) : (
                    deletedUsers.map((user) => (
                      <tr   className={`${showDeletedUsers && deletedUsers.length > 0 ? "border-t border-[#eee]" : ""}`} key={user.id}>
                        <td>
                          <input
                            ref={(el) => (inputRef.current[user.id] = el)}
                            disabled={!isEditable[user.id]}
                            name="name"
                            value={user.name}
                            onChange={(e) => handleChange(e, user.id)}
                          />
                        </td>

                        <td>{user.email}</td>

                        <td>{user.role}</td>

                        <td className="actions">
                          <button
                            disabled={isEditable[user.id]}
                            className="btn btn-primary"
                            type="button"
                            onClick={() => handleRecover(user.id)}
                          >
                            Recover
                          </button>

                          <button
                            type="button"
                            className="btn btn-danger"
                            onClick={() => deleteUser(user.id)}
                          >
                            Delete Permanently
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {Object.keys(isEditable).length !== 0 && (
            <div className="footer-actions mt-4">
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => handleCancel()}
              >
                Cancel
              </button>
              <button
                disabled={!isFieldChanged}
                className="btn btn-success"
                type="button"
                onClick={handleSubmit}
              >
                Save
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
