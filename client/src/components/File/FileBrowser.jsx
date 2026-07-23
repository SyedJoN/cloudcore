import React, { useEffect, useState } from "react";
import { deleteFile, fetchUserFiles } from "../../../apis/fileApi";
import "./FileBrowser.css";
import { getFileIcon } from "../../../Utils/displayUtils";

const BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL;

function FileBrowser() {
  const [usersWithFiles, setUsersWithFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [error, setError] = useState("");

  const getUserWithFiles = async () => {
    const data = await fetchUserFiles();
    setUsersWithFiles(data);
  };

  useEffect(() => {
    getUserWithFiles();
  }, []);

  const handleSelectChange = (id) => {
    setSelectedFiles((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const clearSelection = () => {
    setSelectedFiles(new Set());
  };

  const handleSelectAll = (user) => {
    const fileIds = user.files?.map((file) => file._id) || [];
    const allSelected = fileIds.every((id) => selectedFiles.has(id));

    setSelectedFiles((prev) => {
      const newSet = new Set(prev);

      if (allSelected) {
        fileIds.forEach((id) => newSet.delete(id));
      } else {
        fileIds.forEach((id) => newSet.add(id));
      }

      return newSet;
    });
  };

  async function handleDelete(fileIds) {
    try {
      await Promise.all(
        fileIds.map(async (id) => {
          const url = `${BASE_URL}/file/${id}`;
          await deleteFile(url);
        }),
      );

      setUsersWithFiles((prevUsers) =>
        prevUsers
          .map((user) => ({
            ...user,
            files: user.files?.filter((file) => !fileIds.includes(file._id)),
          }))
          .filter((user) => user.files && user.files.length > 0),
      );

      clearSelection();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="file-browser">
      {error && <div className="error-banner">{error}</div>}

      <div className="table-container">
        <table className="user-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Files</th>
              <th className="actions-col">Actions</th>
            </tr>
          </thead>

          <tbody>
            {usersWithFiles.length === 0 ? (
              <tr>
                <td colSpan={3} className="empty-state">
                  No users found
                </td>
              </tr>
            ) : (
              usersWithFiles.map((user) => (
                <tr key={user._id}>
                  {/* USER INFO */}
                  <td className="user-cell">
                    <div className="user-name">{user.name}</div>
                    <div className="user-email">{user.email}</div>
                  </td>

                  {/* FILES */}
                  <td>
                    <ul className="file-list">
                      {user.files?.map((file) => (
                        <li key={file._id} className="file-item">
                          <input
                            type="checkbox"
                            checked={selectedFiles.has(file._id)}
                            onChange={() => handleSelectChange(file._id)}
                          />

                          <a
                            href={`/file/${file._id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="file-link"
                          >
                            <span style={{ fontSize: 13, flexShrink: 0 }}>
                              {getFileIcon(file.name)}
                            </span>{" "}
                            {file.name}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </td>

                  {/* ACTIONS */}
                  <td className="actions-cell">
                    <label className="select-all">
                      <input
                        type="checkbox"
                        checked={
                          user.files &&
                          user.files.every((file) =>
                            selectedFiles.has(file._id),
                          )
                        }
                        onChange={() => handleSelectAll(user)}
                      />
                      Select all
                    </label>

                    <button
                      className="delete-btn"
                      onClick={() => handleDelete([...selectedFiles])}
                      disabled={selectedFiles.size === 0}
                    >
                      Delete ({selectedFiles.size})
                    </button>

                    <button
                      className="clear-btn"
                      onClick={clearSelection}
                      disabled={selectedFiles.size === 0}
                    >
                      Clear
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default FileBrowser;
