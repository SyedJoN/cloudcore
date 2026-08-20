import { UseAvatar } from "../../Hooks/useAvatar";
import RowActions from "./RowActions";
export default function HomeRoute({
  owner,
  avatar,
  lastModified,
  size,
  ...actionProps
}) {
  return (
    <>
      <div className="gd-list-row-cell md:text-[11px]">
       <UseAvatar name={owner} avatar={avatar} size={24}/> {owner}
      </div>

      <div className="gd-list-row-cell md:text-[11px]">
        {lastModified}
      </div>

      <div className="gd-list-row-cell md:text-[11px]">
        {size}
      </div>

      <RowActions {...actionProps} />
    
    </>
  );
}