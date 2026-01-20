import jwt from 'jsonwebtoken';

export const adminMiddleware=(req,res,next)=>{
    const token = req.cookies?.jwt;
    if(!token){
        return res.status(403).json({
            message:"Unauthorized.No token provided"
        });
    }

    try{
        const decoded=jwt.verify(token,process.env.JWT_SECRET);
        if(decoded.role!=="Admin"){
            return res.status(403).json({
                message:"Forbidden.Admin access required"
            });
        }
        req.userId=decoded.userId;
        next();



    }catch(error){
        return res.status(401).json({
            message:"Unauthorized.Invalid token"
        });
    }
}