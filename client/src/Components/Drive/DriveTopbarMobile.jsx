import DriveHeaderMobile from "./DriveHeaderMobile";
import DriveToolbarMobile from "./DriveToolbarMobile";


/**
 * Renders ONE bar at a time, like the Google Drive app:
 *  - at a root view (no folder open)  -> main header (menu, search, avatar)
 *  - inside any folder                -> folder bar (back, name, search, ⋮)
 *
 * Pass the union of both components' props.
 */
export default function DriveTopBarMobile(props) {
  const { crumbs = [] } = props;
  const inDirectory = crumbs.some((c) => c && Object.keys(c).length > 0);

  return inDirectory ? (
    <DriveToolbarMobile {...props} />
  ) : (
    <DriveHeaderMobile {...props} />
  );
}