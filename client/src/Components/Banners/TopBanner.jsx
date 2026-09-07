import { AlertCircle, CheckCircle, Info, TriangleAlert } from "lucide-react";

const variants = {
  error: {
    container:
      "border-red-200 bg-red-50 shadow-red-200/40",
    iconBg: "bg-red-100",
    iconColor: "text-red-600",
    title: "text-red-800",
    description: "text-red-700",
    button: "bg-red-600 hover:bg-red-700",
    icon: AlertCircle,
  },
  warning: {
    container:
      "border-yellow-200 bg-yellow-50 shadow-yellow-200/40",
    iconBg: "bg-yellow-100",
    iconColor: "text-yellow-600",
    title: "text-yellow-800",
    description: "text-yellow-700",
    button: "bg-yellow-600 hover:bg-yellow-700",
    icon: TriangleAlert,
  },
  success: {
    container:
      "border-green-200 bg-green-50 shadow-green-200/40",
    iconBg: "bg-green-100",
    iconColor: "text-green-600",
    title: "text-green-800",
    description: "text-green-700",
    button: "bg-green-600 hover:bg-green-700",
    icon: CheckCircle,
  },
  info: {
    container:
      "border-blue-200 bg-blue-50 shadow-blue-200/40",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    title: "text-blue-800",
    description: "text-blue-700",
    button: "bg-blue-600 hover:bg-blue-700",
    icon: Info,
  },
};

export default function TopBanner({
  variant = "error",
  title,
  message,
  buttonText = "Update Payment",
  onButtonClick,
}) {
  const style = variants[variant];
  const Icon = style.icon;

  return (
    <div
      className={`relative z-2 w-full max-w-full rounded-xl border px-5 py-1 ${style.container}`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full ${style.iconBg}`}
          >
            <Icon className={`h-5 w-5 ${style.iconColor}`} />
          </div>

          <div>
            <h3 className={`font-semibold ${style.title}`}>
              {title}
            </h3>
            <p className={`text-sm font-medium ${style.description}`}>
              {message}
            </p>
          </div>
        </div>

        {buttonText && (
          <button
            onClick={onButtonClick}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-all hover:scale-[1.02] active:scale-95 cursor-pointer ${style.button}`}
          >
            {buttonText}
          </button>
        )}
      </div>
    </div>
  );
}