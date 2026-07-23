import { useState } from "react";
import { getColor } from "../../Utils/getProfileColor";

export function UseAvatar({ name, avatar, size = 36 }) {
  const [hasImgError, setHasImgError] = useState(false);

  const avatarEl =
    avatar && !hasImgError ? (
      <img
        src={avatar}
        alt={name}
        onError={() => setHasImgError(true)}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          display: "block",
        }}
      />
    ) : (
      <span
        className="gd-avatar"
        style={{
          width: size,
          height: size,
          fontSize: 18,
          fontWeight: 100,
          background: getColor(name),
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        {name?.charAt(0)?.toUpperCase()}
      </span>
    );

  return avatarEl;
}