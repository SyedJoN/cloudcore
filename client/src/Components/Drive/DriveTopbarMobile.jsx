import DriveHeaderMobile from "./DriveHeaderMobile";
import DriveToolbarMobile from "./DriveToolbarMobile";

export default function DriveTopBarMobile(props) {
  const { inDirectory } = props;

  return (
    <div
      key={inDirectory ? "toolbar" : "header"}
      className="gd-mobile-topbar-transition"
    >
      {inDirectory ? (
        <DriveToolbarMobile {...props} />
      ) : (
        <DriveHeaderMobile {...props} />
      )}
    </div>
  );
}