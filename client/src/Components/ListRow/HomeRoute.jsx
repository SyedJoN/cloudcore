import { UseAvatar } from "../../Hooks/useAvatar";
import { IconDots } from "../Icons/Icons";
import RowActions from "./RowActions";

export default function HomeRoute({
  owner,
  avatar,
  size,
  myActivityType,
  myActivityTime,
  locationDetails,
  locationIcon,
  navigate,
  ...actionProps
}) {
  return (
    <>
      <div className="gd-list-row-cell md:text-[11px]">
        {myActivityTime !== null
          ? `You ${myActivityType.toLowerCase()} · ${myActivityTime}  `
          : ""}
      </div>
      <div className="gd-list-row-cell md:text-[11px]">
        <UseAvatar name={owner} avatar={avatar} size={24} fontSize={14} />{" "}
        <span>{owner}</span>
      </div>

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
