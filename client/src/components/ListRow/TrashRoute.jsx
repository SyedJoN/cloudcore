import { useLocation, useNavigate } from "react-router-dom";
import RowActions from "./RowActions";

export default function TrashRoute({
  owner,
  trashedTime,
  size,
  locationDetails,
  locationIcon,
  navigate,
  ...actionProps
}) {
  const location = useLocation();

  return (
    <>
      <div className="gd-list-row-cell md:text-[11px]">{owner}</div>

      <div className="gd-list-row-cell md:text-[11px]">{trashedTime}</div>

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
