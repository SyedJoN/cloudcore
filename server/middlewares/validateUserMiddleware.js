export const validateDeletedUser = (req, res, next) => {
if (req.user.isDeleted !== true) return next();
res.clearCookie("sid");
res.status(403).json({error: "Unauthorized"})
}