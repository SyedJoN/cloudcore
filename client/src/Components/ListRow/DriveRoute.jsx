import { UseAvatar } from "../../Hooks/useAvatar";
import RowActions from "./RowActions";

export default function DriveRoute({
  owner,
  avatar,
  lastModifiedAt,
  modifiedBy,
  size,
  ...actionProps
}) {
  return (
    <>
      <div className="gd-list-row-cell md:text-[11px]">
       <UseAvatar name={owner} avatar={avatar} size={24} fontSize={14}/> <span>{owner}</span>
      </div>

      <div className="gd-list-row-cell md:text-[11px]">
        {lastModifiedAt} {modifiedBy ? modifiedBy : ''}
      </div>

      <div className="gd-list-row-cell md:text-[11px]">
        {size}
      </div>
     

      <RowActions {...actionProps} />
   
    </>
  );
}