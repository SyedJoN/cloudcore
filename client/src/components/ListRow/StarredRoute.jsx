import { useLocation } from "react-router-dom";
import RowActions from "./RowActions";
import { UseAvatar } from "../../Hooks/useAvatar";

export default function StarredRoute({
  owner,
  avatar,
  lastModifiedAt,
  modifiedBy,
  size,
  locationDetails,
  locationIcon,
  navigate,
  ...actionProps
}) {
  const location = useLocation();

  return (
    <>
      <div className="gd-list-row-cell md:text-[11px]">
        <UseAvatar name={owner} avatar={avatar} size={24} fontSize={14} /> {owner}
      </div>

        <div className="gd-list-row-cell md:text-[11px]">
        {lastModifiedAt} {modifiedBy ? modifiedBy : ''}
      </div>

      <div className="gd-list-row-cell md:text-[11px]">{size}</div>

      <div
        onClick={(e) => {
          e.stopPropagation();

          if (location.pathname === locationDetails.pathId) {
            return;
          }

          navigate(locationDetails.pathId);
        }}
        className="gd-location-btn md:text-[11px]"
      >
        <span className="pr-2">{locationIcon}</span> {locationDetails.name}
      </div>

      <RowActions {...actionProps} />
    </>
  );
}
