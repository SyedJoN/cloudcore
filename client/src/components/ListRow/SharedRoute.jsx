import { UseAvatar } from "../../Hooks/useAvatar";
import { IconDots } from "../Icons/Icons";
import RowActions from "./RowActions";

export default function SharedRoute({
  owner,
  avatar,
  sharedWithMeTime,
  ...actionProps
}) {
  return (
    <>
      <div className="gd-list-row-cell md:text-[11px]">
        <UseAvatar name={owner} avatar={avatar} size={24} /> {owner}
      </div>

      <div className="gd-list-row-cell md:text-[11px]">{sharedWithMeTime}</div>

      <RowActions {...actionProps} />

    </>
  );
}
