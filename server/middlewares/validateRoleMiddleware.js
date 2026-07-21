export const validateSuperAdmin = (req, res, next) => {
if (req.user.role === "superuser") return next();
res.status(403).json({error: "Unauthorized"})
}
export const validateAdmin = (req, res, next) => {
if (req.user.role === "superuser" || req.user.role === "admin") return next();
res.status(403).json({error: "Unauthorized"})
}
export const validateManager = (req, res, next) => {
if (req.user.role !== "user") return next();
res.status(403).json({error: "Unauthorized"})
}
