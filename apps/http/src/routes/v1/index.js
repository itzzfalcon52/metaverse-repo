import express from 'express';
import userRouter from './user.js';
import spaceRouter from './space.js';
import adminRouter from './admin.js';
import { SignupSchema } from '../../types/index.js';
import { SigninSchema } from '../../types/index.js';
import db from '@repo/db';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { userMiddleware } from '../../middlewares/user.js';
const router=express.Router();

const signToken = (id,role) => {
    return jwt.sign({ userId: id,role }, process.env.JWT_SECRET, { //we pass the user id as well as role in the jwt token which will be authorization token and can be accesed using beare token and jwt.verify
      expiresIn: process.env.JWT_EXPIRES_IN,
    });
  };
  
  /*
    CENTRALIZED TOKEN SENDER
    -----------------------
    WHY THIS FUNCTION EXISTS:
    - Avoids repeating token + cookie logic in signup/login/reset/update
    - Ensures consistent auth response structure
    - Handles both cookie + JSON token delivery
  */
  const createSendToken = (user, statusCode, res) => {
    // Create JWT token
    const token = signToken(user.id,user.role);
  
    /*
      Cookie configuration
      - expires: converts env value (days) → milliseconds → Date
      - httpOnly: JS cannot access cookie (XSS protection)
    */
    const cookieOptions = {
      expires: new Date(
        Date.now() +
          Number(process.env.JWT_COOKIE_EXPIRES_IN) * 24 * 60 * 60 * 1000
      ),
      httpOnly: true, //so that cookie cannot be modified by browser
      sameSite: "none", //CSRF protection
      secure: true, //cookie only sent over https
    };
  
    // Secure cookie only in production (HTTPS only)
    if (process.env.NODE_ENV === "production") cookieOptions.secure = true; //pn;y true in production
    console.log(token);
  
    // Attach JWT as cookie
    res.cookie("jwt", token, cookieOptions);
  
    // Remove password from output
    user.password = undefined;
  
    // Send response
    res.status(statusCode).json({
     
      token,
      
    });
  };

router.post("/signup",async(req,res)=>{
    const parsedData=SignupSchema.safeParse(req.body);
    if(!parsedData.success){
        return res.status(400).json({
            message:"Invalid request data",
            errors:parsedData.error.errors
        });
    }
    const hashedPassword=await bcrypt.hash(parsedData.data.password,10);
    try{
        const newUser=await db.user.create({
            data:{
                username:parsedData.data.username,
                password:hashedPassword,
              role:parsedData.data.type==="admin"?"Admin":"User"

            }
        })

        return res.status(200).json({
            userId:newUser.id
        });

      

    }catch(error){
        return res.status(400).json({
            message:"Signup failed"
        });
    }

}); 


router.post("/login",async (req,res)=>{
  const parsedData=SigninSchema.safeParse(req.body);
  if(!parsedData.success){
      return res.status(403).json({
          message:"Invalid request data",
          errors:parsedData.error.errors
      });
  }
  try{
    const user=await db.user.findUnique({
        where:{
            username:parsedData.data.username
        }
    });
    if(!user){
        return res.status(403).json({
            message:"User not found.please sign up"
        });
    }
    const isValid=await bcrypt.compare(parsedData.data.password,user.password);
    if(!isValid){
        return res.status(403).json({
            message:"Invalid credentials"
        });
    }
     // 3)if everything is ok,send token to db
  createSendToken(user, 200, res);



  }catch(error){
    console.error("LOGIN ERROR:", error);
      return res.status(400).json({
          message:"Login failed"
      });
  }
})

router.get("/elements", async (req, res) => {
    const elements = await db.element.findMany()

    res.json({elements: elements.map(e => ({
        id: e.id,
        imageUrl: e.imageUrl,
        width: e.width,
        height: e.height,
        static: e.static
    }))})
})


router.get("/me", userMiddleware, async (req, res) => {
  try {
    // Fetch the user from the database using the ID from the middleware
    const user = await db.user.findUnique({
      where: {
        id: req.user.userId, // `req.user` is populated by `userMiddleware`
      },
      select: {
        id: true,
        username: true,
        role: true, // Only return necessary fields
        avatarKey: true,
      },
    });

    // If the user is not found, return a 404 error
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Send the user data as a response
    res.status(200).json({
      success:true,
      user,
    });
  } catch (error) {
    console.error("Error in /me endpoint:", error);
    res.status(500).json({
      message: "An error occurred while fetching user data",
    });
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie("jwt", {
    httpOnly: true,
    sameSite: "Strict",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });

  res.json({ success: true });
});

router.use("/user",userRouter);
router.use("/space",spaceRouter);
router.use("/admin",adminRouter);

export default router;
