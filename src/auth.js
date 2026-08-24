async function authentication(req,res,next){
    const apiKey= req.headers['x-api-key'];
    if(!apiKey){
        return res.status(401).json({
            error:'API key required'
        })
    }

    const user= await req.redis.get(`api_key:${apiKey}`);
    if(!user){
        return res.status(401).json({
            error:"Invalid api key"
        })
    }

    req.user=user;

    next();
}

module.exports=authentication;